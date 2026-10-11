/**
 * 引擎状态机集成测试：在 Electron 环境跑真实引擎模块
 * 运行：npx esbuild scripts/engine-smoke.ts --bundle --platform=node --format=cjs --packages=external --outfile=scripts/out/engine-smoke.cjs && npx electron scripts/out/engine-smoke.cjs
 * 验证：启动校验、停止状态、暂停基线冻结、异常转 paused
 */
import { app, BrowserWindow, ipcMain } from 'electron'
import { readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { GradingEngine } from '../src/main/engine'
import { addRecord, getRecords } from '../src/main/record-store'
import { saveConfig } from '../src/main/store'
import type { AppConfig, JudgeRecord } from '../src/shared/types'

const TEST_USER_DATA = join(process.cwd(), 'scripts', 'out', 'engine-smoke-userdata')

const events: Array<{ type: string; state?: string; message?: string }> = []

const baseConfig = (): AppConfig => ({
  regions: {
    answer: { x: 0, y: 0, width: 200, height: 100 },
    action: { x: 0, y: 0, width: 200, height: 60 }
  },
  model: { baseUrl: 'https://example.com/v1', apiKey: '', model: 'test-model' },
  rule: { ruleText: '测试规则' },
  autoCount: 3
})

const writeConfig = (cfg: AppConfig): void => {
  saveConfig(cfg)
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

const results: Array<{ name: string; pass: boolean; detail: string }> = []

function check(name: string, pass: boolean, detail: string): void {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`)
}

async function run(): Promise<void> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      preload: join(__dirname, 'test-preload.cjs')
    }
  })
  await win.loadURL('about:blank')
  ipcMain.on('test:engine-event', (_e, data) => {
    events.push(data as { type: string })
  })
  const engine = new GradingEngine()
  const stateOf = (): string | undefined => events.at(-1)?.state ?? engine.getState()

  // 1. 启动校验：缺 answer
  writeConfig({ ...baseConfig(), regions: { action: baseConfig().regions.action } })
  let threw = ''
  try {
    engine.start({ mode: 'manual', count: 1 })
  } catch (e) {
    threw = e instanceof Error ? e.message : String(e)
  }
  check('start 缺答题区报错', threw === '请先框选答题区', `msg=${threw}`)

  // 2. 启动校验：缺 apiKey
  writeConfig(baseConfig())
  threw = ''
  try {
    engine.start({ mode: 'manual', count: 1 })
  } catch (e) {
    threw = e instanceof Error ? e.message : String(e)
  }
  check('start 缺 API Key 报错', threw === '请先配置模型 API Key', `msg=${threw}`)

  // 3. 启动校验：auto 缺操作区（带 apiKey 才能走到 action 校验）
  writeConfig({
    ...baseConfig(),
    regions: { answer: baseConfig().regions.answer },
    model: { ...baseConfig().model, apiKey: 'sk-fake' }
  })
  threw = ''
  try {
    engine.start({ mode: 'auto', count: 3 })
  } catch (e) {
    threw = e instanceof Error ? e.message : String(e)
  }
  check('start 自动模式缺操作区报错', threw === '自动模式需要先框选操作区', `msg=${threw}`)

  // 4. 运行 → 无有效模型服务 → 转 paused
  events.length = 0
  writeConfig({ ...baseConfig(), model: { ...baseConfig().model, apiKey: 'sk-fake' } })
  engine.start({ mode: 'auto', count: 3 })
  await sleep(4000)
  const states = events.filter((e) => e.type === 'state').map((e) => e.state)
  console.log(`    事件序列: ${states.join(' -> ')}`)
  check(
    '模型调用失败转 paused',
    stateOf() === 'paused',
    `state=${stateOf()} events=${states.join(',')}`
  )

  // 5. resume 后应恢复运行
  if (stateOf() === 'paused') {
    engine.resume()
    await sleep(2500)
    const statesAfterResume = events.filter((e) => e.type === 'state').map((e) => e.state)
    check(
      'resume 后引擎恢复运行',
      statesAfterResume.includes('judging') || statesAfterResume.includes('waiting-new'),
      `states=${statesAfterResume.slice(-4).join(',')}`
    )
  } else {
    check('resume 后引擎恢复运行', false, `前置条件不满足 state=${stateOf()}`)
  }

  // 6. 停止：最终状态 stopped 且消息含"已停止"
  engine.stop()
  await sleep(800)
  const lastStopEvent = [...events].reverse().find((e) => e.type === 'state' && e.state === 'stopped')
  check(
    '停止后状态为 stopped',
    stateOf() === 'stopped',
    `state=${stateOf()} message=${lastStopEvent?.message ?? ''}`
  )

  // 7. 手动模式正常完成：judge 失败 → paused → resume → 等新卷…（截屏可能无权限，只验证不崩溃）
  const manual = new GradingEngine()
  writeConfig({ ...baseConfig(), model: { ...baseConfig().model, apiKey: 'sk-fake' } })
  let startErr = ''
  try {
    manual.start({ mode: 'manual', count: 1 })
  } catch (e) {
    startErr = e instanceof Error ? e.message : String(e)
  }
  let manualState = manual.getState()
  console.log(`    手动模式 start 后状态: ${manualState} progress=${JSON.stringify(manual.getProgress())}`)
  for (let i = 0; i < 20; i++) {
    await sleep(500)
    manualState = manual.getState()
    if (manualState !== 'idle' || i === 19) {
      console.log(
        `    手动模式轮询 t=${((i + 1) * 0.5).toFixed(1)}s state=${manualState}`
      )
    }
    if (manualState !== 'idle' && manualState !== 'judging') break
  }
  manual.stop()
  check(
    '手动模式异常路径可恢复',
    manualState === 'paused' || manualState === 'stopped',
    `state=${manualState} startErr=${startErr}`
  )

  // 8. 判分记录持久化：写入后能从文件读回
  const fake: JudgeRecord = {
    id: 'smoke-1',
    time: '12:00:00',
    score: 88,
    items: [{ label: '1', response: 'ok', correct: true }],
    lowConfidence: false,
    confidence: 0.99,
    thumbnail: 'data:image/png;base64,AA=='
  }
  addRecord(fake)
  await sleep(1200)
  const onDisk = JSON.parse(
    readFileSync(join(TEST_USER_DATA, 'records.json'), 'utf-8')
  ) as JudgeRecord[]
  check(
    '判分记录持久化到文件',
    onDisk.length === 1 && onDisk[0].id === 'smoke-1' && getRecords().length === 1,
    `count=${onDisk.length}`
  )

  win.destroy()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  app.exit(failed > 0 ? 1 : 0)
}

app.whenReady().then(() => {
  rmSync(TEST_USER_DATA, { recursive: true, force: true })
  app.setPath('userData', TEST_USER_DATA)
  ipcMain.on('engine:event', () => {})
  void run()
})

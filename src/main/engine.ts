/**
 * 评卷引擎：逐张循环 截图 → 判分 → 提交 的状态机
 * - 手动模式：模型判分推送分数，提交由用户在五岳界面自行完成
 * - 自动模式：判分后点击聚焦输入框 → 键入分数 → 校验生效 → 回车提交
 * - 任何可恢复异常（低置信度、键入未生效、等卷超时）进入 paused，用户处理后继续
 */
import { screen } from 'electron'
import { broadcast } from './broadcast'
import { getConfig } from './store'
import { captureRegionBitmap, captureRegionDataUrl } from './capture'
import { diffRatio } from './pixel'
import { click, pressEnter, typeScore } from './injector'
import { judgePaper, planActions } from './llm'
import { addRecord } from './record-store'
import type { EngineEvent, EngineState, JudgeRecord, Region } from '../shared/types'

const POLL_MS = 500
/** 等待新卷超时（毫秒） */
const NEW_PAPER_TIMEOUT = 30_000
/** 判定「发生变化」的差异阈值 */
const CHANGE_THRESHOLD = 0.03
/** 判定「已稳定」的差异阈值 */
const SETTLE_THRESHOLD = 0.002
/** 稳定帧数 */
const SETTLE_FRAMES = 2
/** 键入生效校验：输入框区域最小差异 */
const TYPE_EFFECT_THRESHOLD = 0.01

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** 引擎内部中止信号 */
class AbortError extends Error {}

/** 可恢复异常：暂停并提示用户处理 */
class EnginePauseError extends Error {}

export interface EngineStartOptions {
  mode: 'manual' | 'auto'
  count: number
}

export class GradingEngine {
  private state: EngineState = 'idle'
  private abort = false
  private paused = false
  private done = 0
  private total = 0
  private mode: 'manual' | 'auto' = 'manual'
  private running = false
  /** 停止时中断进行中的模型请求 */
  private abortController = new AbortController()

  constructor() {}

  private emit(ev: EngineEvent): void {
    broadcast('engine:event', ev)
  }

  private setState(state: EngineState, message?: string): void {
    this.state = state
    this.emit({ type: 'state', state, message })
  }

  private checkAbort(): void {
    if (this.abort) throw new AbortError()
  }

  /** 悬挂直至恢复或中止 */
  private async waitWhilePaused(): Promise<void> {
    while (this.paused && !this.abort) {
      await sleep(200)
    }
    this.checkAbort()
  }

  getState(): EngineState {
    return this.state
  }

  getProgress(): { done: number; total: number } {
    return { done: this.done, total: this.total }
  }

  start(opts: EngineStartOptions): void {
    if (this.running) throw new Error('引擎已在运行中')
    const cfg = getConfig()
    if (!cfg.regions.answer) throw new Error('请先框选答题区')
    if (!cfg.model.apiKey) throw new Error('请先配置模型 API Key')
    if (opts.mode === 'auto' && !cfg.regions.action) {
      throw new Error('自动模式需要先框选操作区')
    }
    this.mode = opts.mode
    // 手动模式为单张判分：评一张即停，用户提交后点「评下一张」继续
    this.total = opts.mode === 'manual' ? 1 : opts.count
    this.done = 0
    this.abort = false
    this.paused = false
    this.abortController = new AbortController()
    this.running = true
    this.emit({ type: 'progress', done: 0, total: this.total })
    void this.loop()
  }

  stop(): void {
    this.abort = true
    this.paused = false
    // 中断进行中的模型请求，让循环立即退出
    this.abortController.abort()
  }

  /** 从 paused 恢复：当前卷视为已人工处理，继续等下一张 */
  resume(): void {
    if (!this.paused) throw new Error('引擎未处于暂停状态')
    this.paused = false
  }

  private async loop(): Promise<void> {
    let firstPaper = true
    try {
      while (!this.abort && this.done < this.total) {
        try {
          await this.waitWhilePaused()
          const cfg = getConfig()
          let paperImage: string
          if (firstPaper) {
            // 首张：点击开始时屏幕上即待评卷，直接截取
            this.setState('judging')
            paperImage = await captureRegionDataUrl(cfg.regions.answer!)
            firstPaper = false
          } else {
            this.setState('waiting-new')
            await this.waitForNewPaper(cfg.regions.answer!)
            this.setState('judging')
            paperImage = await captureRegionDataUrl(cfg.regions.answer!)
          }
          await this.waitWhilePaused()

          const result = await judgePaper(cfg.model, cfg.rule, paperImage, {
            signal: this.abortController.signal
          })
          const record: JudgeRecord = {
            id: `${Date.now()}-${this.done + 1}`,
            time: new Date().toLocaleTimeString('zh-CN'),
            score: result.score,
            items: result.items,
            lowConfidence: result.lowConfidence,
            confidence: result.confidence,
            thumbnail: paperImage
          }
          this.emit({ type: 'judged', record })
          addRecord(record)

          if (this.mode === 'auto') {
            if (result.lowConfidence) {
              throw new EnginePauseError(
                `识别置信度低（${(result.confidence * 100).toFixed(0)}%），请人工处理当前卷后点击继续`
              )
            }
            this.setState('submitting')
            await this.submitScore(result.score)
          }
          this.done++
          this.emit({ type: 'progress', done: this.done, total: this.total })
        } catch (e) {
          if (this.abort || e instanceof AbortError) break
          firstPaper = false
          const message = e instanceof Error ? e.message : String(e)
          this.emit({ type: 'error', message })
          // 可恢复异常：暂停悬挂，用户处理后 resume 继续等下一张
          this.setState('paused', message)
          await this.waitWhilePaused()
        }
      }
      this.checkAbort()
      this.setState(
        'stopped',
        this.mode === 'manual'
          ? `判分完成 ${this.done} 张，提交后点「评下一张」继续`
          : `评卷完成，共 ${this.done} 张`
      )
    } catch (e) {
      // 兜底：异常退出统一转 paused，保留进度
      const message = e instanceof Error ? e.message : String(e)
      this.setState('paused', message)
    } finally {
      this.running = false
    }
  }

  /** 轮询答题区：像素变化后连续稳定帧视为新卷就绪；超时转可恢复异常 */
  private async waitForNewPaper(region: Region): Promise<void> {
    const baseline = await captureRegionBitmap(region)
    let prev = baseline.buffer
    let changed = false
    let stableFrames = 0
    let activeMs = 0
    for (;;) {
      this.checkAbort()
      const pausedStart = this.paused
      if (pausedStart) {
        await sleep(200)
        continue
      }
      const t0 = Date.now()
      await sleep(POLL_MS)
      const cur = await captureRegionBitmap(region)
      const ratio = diffRatio(prev, cur.buffer)
      prev = cur.buffer
      activeMs += Date.now() - t0
      if (!changed) {
        if (ratio > CHANGE_THRESHOLD) {
          changed = true
          stableFrames = 0
        }
      } else if (ratio < SETTLE_THRESHOLD) {
        stableFrames++
        if (stableFrames >= SETTLE_FRAMES) return
      } else {
        stableFrames = 0
      }
      if (activeMs > NEW_PAPER_TIMEOUT) {
        throw new EnginePauseError('等待新卷超时（30 秒），请检查五岳界面是否已加载下一份')
      }
    }
  }

  /** 自动提交：模型看操作区截图规划操作序列，本地执行并校验画面变化 */
  private async submitScore(score: number): Promise<void> {
    const cfg = getConfig()
    const action = cfg.regions.action
    if (!action) throw new EnginePauseError('未框选操作区')

    const before = await captureRegionBitmap(action)
    const plan = await planActions(
      cfg.model,
      await captureRegionDataUrl(action),
      score,
      { signal: this.abortController.signal }
    )
    if (plan.actions.length === 0) {
      throw new EnginePauseError('模型未规划出任何操作，请检查操作区框选是否正确')
    }

    // 截图像素坐标 → 屏幕逻辑坐标（操作区截图为物理像素，除以 dpr）
    const dpr = screen.getPrimaryDisplay().scaleFactor
    for (const act of plan.actions) {
      this.checkAbort()
      if (act.type === 'click') {
        await click(action.x + act.x / dpr, action.y + act.y / dpr)
      } else if (act.type === 'type') {
        await typeScore(act.text)
      } else if (act.type === 'key' && act.key === 'enter') {
        await pressEnter()
      }
      await sleep(200)
    }
    this.checkAbort()
    await sleep(300)

    const after = await captureRegionBitmap(action)
    if (diffRatio(before.buffer, after.buffer) < TYPE_EFFECT_THRESHOLD) {
      throw new EnginePauseError('操作未生效（操作区画面无变化），请检查五岳窗口是否被遮挡或失焦')
    }
  }
}

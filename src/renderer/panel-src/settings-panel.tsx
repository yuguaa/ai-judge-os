/**
 * 设置面板：第三方模型接入、评分规则文本（题型无关）、权限状态
 * 配置与权限由本面板自行拉取与保存（面板窗口是独立渲染实例）
 */
import { useEffect, useState } from 'react'
import { CheckCircle2Icon, PlugZapIcon, RefreshCwIcon, XCircleIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ipc } from '@/lib/ipc'
import type { AppConfig, PermissionStatus } from '@shared/types'

/** 分组标题：渐变竖条 + 小标题 */
function SectionLabel(props: { children: React.ReactNode; hint?: string }): JSX.Element {
  return (
    <div className="flex items-baseline gap-2.5">
      <span className="h-3.5 w-[3px] self-center rounded-full bg-gradient-to-b from-[#3fe6a2] to-[#17865d]" />
      <h2 className="text-xs font-semibold tracking-wide text-white/85">{props.children}</h2>
      {props.hint && <span className="text-[11px] text-muted-foreground">{props.hint}</span>}
    </div>
  )
}

export function SettingsPanel(): JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [perms, setPerms] = useState<PermissionStatus | null>(null)
  const [permsChecking, setPermsChecking] = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    void ipc.getConfig().then(setConfig)
    void ipc.checkPerms().then(setPerms)
  }, [])

  if (!config) {
    return (
      <div className="flex items-center justify-center p-10 text-sm text-muted-foreground">
        载入配置…
      </div>
    )
  }

  const save = (next: AppConfig): void => {
    setConfig(next)
    void ipc.setConfig(next)
  }

  const updateModel = (patch: Partial<typeof config.model>): void => {
    save({ ...config, model: { ...config.model, ...patch } })
  }

  const refreshPerms = async (): Promise<void> => {
    setPermsChecking(true)
    try {
      setPerms(await ipc.checkPerms())
    } finally {
      setPermsChecking(false)
    }
  }

  const testModel = async (): Promise<void> => {
    setTesting(true)
    setTestResult(null)
    try {
      await ipc.modelTest()
      setTestResult({ ok: true, text: '连接成功，模型可用' })
    } catch (e) {
      setTestResult({
        ok: false,
        text: `失败：${e instanceof Error ? e.message : String(e)}`
      })
    } finally {
      setTesting(false)
    }
  }

  return (
    <div className="flex h-full flex-col gap-5 overflow-y-auto p-5">
      {/* 模型接入 */}
      <section className="flex flex-col gap-2.5">
        <SectionLabel hint="任意 OpenAI 兼容服务，需支持视觉输入">模型接入</SectionLabel>
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardContent className="flex flex-col gap-3.5 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="base-url" className="text-xs text-white/60">
                  Base URL
                </Label>
                <Input
                  id="base-url"
                  className="h-8 text-xs"
                  value={config.model.baseUrl}
                  onChange={(e) => updateModel({ baseUrl: e.target.value })}
                  placeholder="https://api.deepseek.com/v1"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="model-name" className="text-xs text-white/60">
                  模型名称
                </Label>
                <Input
                  id="model-name"
                  className="h-8 text-xs"
                  value={config.model.model}
                  onChange={(e) => updateModel({ model: e.target.value })}
                  placeholder="qwen-vl-max / glm-4v / gpt-4o-mini …"
                />
              </div>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="api-key" className="text-xs text-white/60">
                API Key
              </Label>
              <div className="flex gap-2">
                <Input
                  id="api-key"
                  className="h-8 text-xs"
                  type="password"
                  value={config.model.apiKey}
                  onChange={(e) => updateModel({ apiKey: e.target.value })}
                  placeholder="sk-…"
                />
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0 text-xs"
                  disabled={testing || !config.model.apiKey}
                  onClick={() => void testModel()}
                >
                  <PlugZapIcon data-icon="inline-start" className="size-3.5" />
                  {testing ? '测试中…' : '测试连接'}
                </Button>
              </div>
              {testResult && (
                <p
                  className={
                    testResult.ok
                      ? 'flex items-center gap-1 text-xs text-emerald-400'
                      : 'flex items-center gap-1 text-xs text-red-400'
                  }
                >
                  {testResult.ok ? (
                    <CheckCircle2Icon className="size-3.5" />
                  ) : (
                    <XCircleIcon className="size-3.5" />
                  )}
                  {testResult.text}
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 评分规则 */}
      <section className="flex min-h-0 flex-1 flex-col gap-2.5">
        <SectionLabel hint="题型、题号与答案、分值、判分标准，自由书写">评分规则</SectionLabel>
        <Textarea
          id="rule-text"
          className="min-h-0 flex-1 resize-none rounded-xl border-white/[0.07] bg-white/[0.02] font-mono text-xs leading-5"
          value={config.rule.ruleText}
          onChange={(e) => save({ ...config, rule: { ruleText: e.target.value } })}
        />
      </section>

      {/* 系统权限 */}
      <section className="flex flex-col gap-2.5">
        <SectionLabel>系统权限</SectionLabel>
        <Card className="border-white/[0.06] bg-white/[0.02]">
          <CardHeader className="pb-2 pt-4">
            <CardTitle className="text-xs text-white/85">macOS 权限状态</CardTitle>
            <CardDescription className="text-[11px] leading-4">
              缺失时到 系统设置 → 隐私与安全性 中为本应用开启，改完重启应用后点右侧按钮重新检测
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-5 pb-4 text-xs">
            <span
              className={`flex items-center gap-1.5 ${
                perms?.screenCapture ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {perms?.screenCapture ? (
                <CheckCircle2Icon className="size-3.5" />
              ) : (
                <XCircleIcon className="size-3.5" />
              )}
              屏幕录制
            </span>
            <span
              className={`flex items-center gap-1.5 ${
                perms?.accessibility ? 'text-emerald-400' : 'text-red-400'
              }`}
            >
              {perms?.accessibility ? (
                <CheckCircle2Icon className="size-3.5" />
              ) : (
                <XCircleIcon className="size-3.5" />
              )}
              辅助功能
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7 text-xs"
              disabled={permsChecking}
              onClick={() => void refreshPerms()}
            >
              <RefreshCwIcon data-icon="inline-start" className="size-3.5" />
              {permsChecking ? '检测中…' : '重新检测'}
            </Button>
          </CardContent>
        </Card>
      </section>
    </div>
  )
}

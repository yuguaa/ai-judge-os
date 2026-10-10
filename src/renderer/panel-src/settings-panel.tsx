/**
 * 设置面板：第三方模型接入、评分规则文本（题型无关）、权限状态
 * 配置与权限由本面板自行拉取与保存（面板窗口是独立渲染实例）
 */
import { useEffect, useState } from 'react'
import { PlugZapIcon, RefreshCwIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { ipc } from '@/lib/ipc'
import type { AppConfig, PermissionStatus } from '@shared/types'

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
    return <div className="p-6 text-sm text-muted-foreground">载入配置…</div>
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
    <div className="flex h-full flex-col gap-4 overflow-y-auto p-4">
      <section className="flex flex-col gap-2.5">
        <h2 className="text-xs font-medium text-muted-foreground">第三方模型（OpenAI 兼容协议）</h2>
        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1">
            <Label htmlFor="base-url" className="text-xs">
              Base URL
            </Label>
            <Input
              id="base-url"
              className="h-8"
              value={config.model.baseUrl}
              onChange={(e) => updateModel({ baseUrl: e.target.value })}
              placeholder="https://api.deepseek.com/v1"
            />
          </div>
          <div className="flex flex-col gap-1">
            <Label htmlFor="model-name" className="text-xs">
              模型名称（需支持视觉）
            </Label>
            <Input
              id="model-name"
              className="h-8"
              value={config.model.model}
              onChange={(e) => updateModel({ model: e.target.value })}
              placeholder="qwen-vl-max / glm-4v / gpt-4o-mini …"
            />
          </div>
        </div>
        <div className="flex flex-col gap-1">
          <Label htmlFor="api-key" className="text-xs">
            API Key
          </Label>
          <div className="flex gap-2">
            <Input
              id="api-key"
              className="h-8"
              type="password"
              value={config.model.apiKey}
              onChange={(e) => updateModel({ apiKey: e.target.value })}
              placeholder="sk-…"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-8 shrink-0"
              disabled={testing || !config.model.apiKey}
              onClick={() => void testModel()}
            >
              <PlugZapIcon data-icon="inline-start" />
              {testing ? '测试中…' : '测试连接'}
            </Button>
          </div>
          {testResult && (
            <p className={testResult.ok ? 'text-xs text-emerald-400' : 'text-xs text-red-400'}>
              {testResult.text}
            </p>
          )}
        </div>
      </section>

      <section className="flex min-h-0 flex-1 flex-col gap-1">
        <Label htmlFor="rule-text" className="text-xs">
          评分规则（题型、题号与答案、分值、判分标准，自由书写，不限题型）
        </Label>
        <Textarea
          id="rule-text"
          className="min-h-0 flex-1 resize-none font-mono text-xs leading-5"
          value={config.rule.ruleText}
          onChange={(e) => save({ ...config, rule: { ruleText: e.target.value } })}
        />
      </section>

      <Card className="border-muted">
        <CardHeader className="py-2.5">
          <CardTitle className="text-xs">系统权限</CardTitle>
          <CardDescription className="text-[11px]">
            缺失时到 系统设置 → 隐私与安全性 中为本应用开启，改完重启应用后点右侧按钮重新检测
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center gap-4 py-0 pb-2.5 text-xs">
          <span className={perms?.screenCapture ? 'text-emerald-400' : 'text-red-400'}>
            {perms?.screenCapture ? '✓' : '✗'} 屏幕录制
          </span>
          <span className={perms?.accessibility ? 'text-emerald-400' : 'text-red-400'}>
            {perms?.accessibility ? '✓' : '✗'} 辅助功能
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="ml-auto h-7"
            disabled={permsChecking}
            onClick={() => void refreshPerms()}
          >
            <RefreshCwIcon data-icon="inline-start" />
            {permsChecking ? '检测中…' : '重新检测'}
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

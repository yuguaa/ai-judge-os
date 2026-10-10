/**
 * 对话调试面板：数据源为主进程 chat 历史（拉取 + 广播同步）
 */
import { useEffect, useRef, useState } from 'react'
import { SendHorizontalIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ipc } from '@/lib/ipc'
import { useAppStore } from '@/lib/store'
import type { ChatMessage } from '@shared/types'

export function ChatPanel(): JSX.Element {
  const config = useAppStore((s) => s.config)
  const saveConfig = useAppStore((s) => s.saveConfig)
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [attachAnswer, setAttachAnswer] = useState(true)
  const [attachAction, setAttachAction] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void ipc.getChat().then(setChat)
    return ipc.onChatUpdated(setChat)
  }, [])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight })
  }, [chat, busy])

  const send = async (): Promise<void> => {
    const text = input.trim()
    if (!text || busy) return
    const images: string[] = []
    if (attachAnswer) {
      try {
        images.push(await ipc.captureRegion('answer'))
      } catch {
        // 未框选答题区时跳过附加
      }
    }
    if (attachAction) {
      try {
        images.push(await ipc.captureRegion('action'))
      } catch {
        // 未框选输入框时跳过附加
      }
    }
    const message: ChatMessage = {
      role: 'user',
      content: text,
      images: images.length ? images : undefined
    }
    setInput('')
    setBusy(true)
    try {
      // 历史消息只传文本，图片仅随最新消息，控制上下文体量；本地不 push，等主进程广播
      const history: ChatMessage[] = chat.map((m) => ({ role: m.role, content: m.content }))
      await ipc.chatSend([...history, message])
    } catch (e) {
      setChat((c) => [
        ...c,
        { role: 'assistant', content: `调用失败：${e instanceof Error ? e.message : String(e)}` }
      ])
    } finally {
      setBusy(false)
    }
  }

  const appendToRule = (): void => {
    const text = input.trim()
    if (!text || !config) return
    void saveConfig({ ...config, rule: { ruleText: `${config.rule.ruleText}\n${text}` } })
    setInput('')
  }

  return (
    <div className="flex h-full flex-col gap-2.5 p-3">
      <div className="flex items-center gap-4">
        <span className="text-xs font-medium text-muted-foreground">
          带截图与模型确认判分口径，结论可追加进规则
        </span>
      </div>

      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-2.5 overflow-y-auto pr-1">
        {chat.length === 0 && !busy && (
          <p className="py-10 text-center text-xs text-muted-foreground">
            先框选答题区，再把当前卷发给模型试判
          </p>
        )}
        {chat.map((m, i) => (
          <div
            key={i}
            className={
              m.role === 'user'
                ? 'ml-auto max-w-[85%] rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground'
                : 'mr-auto max-w-[85%] rounded-lg bg-muted px-3 py-2 text-sm'
            }
          >
            {m.images && (
              <div className="mb-2 flex flex-wrap gap-1.5">
                {m.images.map((src, j) => (
                  <img
                    key={j}
                    src={src}
                    alt={`附件${j + 1}`}
                    className="max-h-24 rounded border object-contain"
                  />
                ))}
              </div>
            )}
            <p className="whitespace-pre-wrap">{m.content}</p>
          </div>
        ))}
        {busy && (
          <div className="mr-auto rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            模型思考中…
          </div>
        )}
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <Switch id="chat-attach-answer" checked={attachAnswer} onCheckedChange={setAttachAnswer} />
          <Label htmlFor="chat-attach-answer" className="text-xs">
            附答题区
          </Label>
        </div>
        <div className="flex items-center gap-1.5">
          <Switch id="chat-attach-action" checked={attachAction} onCheckedChange={setAttachAction} />
          <Label htmlFor="chat-attach-action" className="text-xs">
            附操作区
          </Label>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Textarea
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="例：58 空学生写的是 legending，按规则应该判对还是判错？"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send()
          }}
        />
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            className="flex-1"
            disabled={busy || !input.trim()}
            onClick={() => void send()}
          >
            <SendHorizontalIcon data-icon="inline-start" />
            发送（⌘↩）
          </Button>
          <Button
            size="sm"
            variant="outline"
            disabled={!input.trim() || !config}
            onClick={appendToRule}
          >
            存入规则
          </Button>
        </div>
      </div>
    </div>
  )
}

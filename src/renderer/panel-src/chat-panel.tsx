/**
 * 对话调试面板：数据源为主进程 chat 历史（拉取 + 广播同步）
 * 助手回复可一键存入评分规则；截图附件的失败原因明确提示
 */
import { useEffect, useRef, useState } from 'react'
import { BookPlusIcon, ImageIcon, MessageSquareIcon, SendHorizontalIcon } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { ipc } from '@/lib/ipc'
import type { AppConfig, ChatMessage } from '@shared/types'

export function ChatPanel(): JSX.Element {
  const [config, setConfig] = useState<AppConfig | null>(null)
  const [chat, setChat] = useState<ChatMessage[]>([])
  const [busy, setBusy] = useState(false)
  const [input, setInput] = useState('')
  const [attachAnswer, setAttachAnswer] = useState(true)
  const [attachAction, setAttachAction] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void ipc.getChat().then(setChat)
    void ipc.getConfig().then(setConfig)
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
        toast.warning('答题区未框选，已跳过该截图')
      }
    }
    if (attachAction) {
      try {
        images.push(await ipc.captureRegion('action'))
      } catch {
        toast.warning('操作区未框选，已跳过该截图')
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

  const appendToRule = (content: string): void => {
    if (!config) return
    const next: AppConfig = {
      ...config,
      rule: { ruleText: `${config.rule.ruleText}\n${content}`.trim() }
    }
    setConfig(next)
    void ipc.setConfig(next)
    toast.success('已追加进评分规则')
  }

  return (
    <div className="flex h-full flex-col gap-3 p-5">
      <div ref={scrollRef} className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto pr-1">
        {chat.length === 0 && !busy && (
          <div className="flex flex-1 flex-col items-center justify-center gap-2.5 py-10 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl border border-white/[0.07] bg-white/[0.03]">
              <MessageSquareIcon className="size-5 text-white/35" />
            </div>
            <p className="max-w-56 text-xs leading-5 text-muted-foreground">
              先框选答题区，再把当前卷发给模型试判
            </p>
          </div>
        )}
        {chat.map((m, i) =>
          m.role === 'user' ? (
            <div
              key={i}
              className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-gradient-to-br from-[#2fc08f] to-[#18815f] px-3.5 py-2.5 text-[13px] leading-5 text-white shadow-[0_4px_14px_rgba(32,196,132,0.22),inset_0_1px_0_rgba(255,255,255,0.18)]"
            >
              {m.images && (
                <div className="mb-2 flex flex-wrap gap-1.5">
                  {m.images.map((src, j) => (
                    <img
                      key={j}
                      src={src}
                      alt={`附件${j + 1}`}
                      className="max-h-24 rounded-lg border border-white/15 object-contain"
                    />
                  ))}
                </div>
              )}
              <p className="whitespace-pre-wrap">{m.content}</p>
            </div>
          ) : (
            <div
              key={i}
              className="mr-auto flex max-w-[85%] flex-col gap-2 rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.035] px-3.5 py-2.5 text-[13px] leading-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]"
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              <button
                className="flex items-center gap-1 self-start rounded-md px-1.5 py-0.5 text-[11px] text-emerald-300/80 transition-colors hover:bg-emerald-400/10 hover:text-emerald-300"
                onClick={() => appendToRule(m.content)}
              >
                <BookPlusIcon className="size-3.5" />
                存入规则
              </button>
            </div>
          )
        )}
        {busy && (
          <div className="mr-auto flex items-center gap-2 rounded-2xl rounded-bl-md border border-white/[0.07] bg-white/[0.035] px-4 py-3">
            <span className="flex gap-1">
              <span className="size-1.5 animate-bounce rounded-full bg-white/40 [animation-delay:-0.3s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-white/40 [animation-delay:-0.15s]" />
              <span className="size-1.5 animate-bounce rounded-full bg-white/40" />
            </span>
            <span className="text-xs text-muted-foreground">模型思考中…</span>
          </div>
        )}
      </div>

      <div className="flex shrink-0 flex-col gap-2.5">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <Switch id="chat-attach-answer" checked={attachAnswer} onCheckedChange={setAttachAnswer} />
            <Label htmlFor="chat-attach-answer" className="flex items-center gap-1 text-xs text-white/60">
              <ImageIcon className="size-3.5" />
              附答题区
            </Label>
          </div>
          <div className="flex items-center gap-1.5">
            <Switch id="chat-attach-action" checked={attachAction} onCheckedChange={setAttachAction} />
            <Label htmlFor="chat-attach-action" className="flex items-center gap-1 text-xs text-white/60">
              <ImageIcon className="size-3.5" />
              附操作区
            </Label>
          </div>
        </div>

        <div className="rounded-xl border border-white/[0.07] bg-white/[0.025] p-1.5 transition-colors focus-within:border-primary/40">
          <Textarea
            rows={3}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="例：58 空学生写的是 legending，按规则应该判对还是判错？"
            className="min-h-0 resize-none border-0 bg-transparent text-[13px] shadow-none focus-visible:ring-0"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void send()
            }}
          />
          <div className="flex items-center justify-between px-1 pb-0.5">
            <span className="text-[11px] text-muted-foreground/70">⌘ + Enter 发送</span>
            <Button
              size="sm"
              className="h-7 px-3 text-xs"
              disabled={busy || !input.trim()}
              onClick={() => void send()}
            >
              <SendHorizontalIcon data-icon="inline-start" className="size-3.5" />
              发送
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * 对话历史：内存态，主进程为唯一数据源，变更后广播 chat:updated
 */
import type { ChatMessage } from '../shared/types'

const history: ChatMessage[] = []

export function getChatHistory(): ChatMessage[] {
  return history
}

export function appendChat(message: ChatMessage): void {
  history.push(message)
}

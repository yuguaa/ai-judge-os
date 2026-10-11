/**
 * 全局共享类型：主进程与渲染层共同引用
 */

/** 屏幕矩形（逻辑坐标，原点为主屏左上角） */
export interface Region {
  x: number
  y: number
  width: number
  height: number
}

/**
 * 评分规则：纯文本，题型无关
 * 用户以任意格式书写（题型、题号与答案、分值、判分标准），模型按文本理解执行
 */
export interface ScoringRule {
  ruleText: string
}

/** 模型接入配置（OpenAI 兼容协议） */
export interface ModelConfig {
  baseUrl: string
  apiKey: string
  model: string
}

/** 应用配置（持久化到 userData/config.json） */
export interface AppConfig {
  regions: {
    /** 答题区（答题卡裁剪区域，判分依据） */
    answer?: Region
    /** 操作区（给分板整体区域，自动模式下模型据此规划操作序列） */
    action?: Region
    /** 过程显示区（评卷过程实时渲染的屏幕区域） */
    process?: Region
  }
  model: ModelConfig
  rule: ScoringRule
  /** 自动模式评卷数量 */
  autoCount: number
}

/** 单步操作指令（坐标为操作区截图内的像素坐标） */
export type PlanAction =
  | { type: 'click'; x: number; y: number }
  | { type: 'type'; text: string }
  | { type: 'key'; key: 'enter' }

/** 操作序列规划结果 */
export interface ActionPlan {
  actions: PlanAction[]
}

/** 单条判定（label 为题号或规则中的条目标识，题型无关） */
export interface JudgeItem {
  label: string
  response: string
  correct: boolean
}

/** 判分结果 */
export interface JudgeResult {
  items: JudgeItem[]
  score: number
  lowConfidence: boolean
  confidence: number
}

/** 一张卷的判分留档 */
export interface JudgeRecord {
  id: string
  time: string
  score: number
  items: JudgeItem[]
  lowConfidence: boolean
  confidence: number
  /** 答题区截图 dataURL */
  thumbnail: string
}

/** 引擎状态 */
export type EngineState =
  | 'idle'
  | 'waiting-new'
  | 'judging'
  | 'submitting'
  | 'paused'
  | 'stopped'

/** 引擎事件（主进程 → 渲染层推送） */
export type EngineEvent =
  | { type: 'state'; state: EngineState; message?: string }
  | { type: 'progress'; done: number; total: number }
  | { type: 'judged'; record: JudgeRecord }

/** 聊天消息（渲染层 → 主进程 → 模型） */
export interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
  /** base64 dataURL 图片列表，仅 user 消息可带 */
  images?: string[]
}

/** 权限状态 */
export interface PermissionStatus {
  screenCapture: boolean
  accessibility: boolean
}

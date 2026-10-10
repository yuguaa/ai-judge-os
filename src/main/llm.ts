/**
 * 模型接入：OpenAI 兼容协议
 * - judgePaper：答题卡判分（规则文本驱动，题型无关，强制 JSON 输出）
 * - chat：调试对话（可携带图片）
 */
import OpenAI from 'openai'
import type {
  ActionPlan,
  ChatMessage,
  JudgeResult,
  ModelConfig,
  ScoringRule
} from '../shared/types'

function client(model: ModelConfig): OpenAI {
  if (!model.apiKey) throw new Error('未配置 API Key')
  return new OpenAI({ baseURL: model.baseUrl, apiKey: model.apiKey })
}

/** 请求选项：signal 用于停止评卷时中断进行中的模型调用 */
interface CallOptions {
  signal?: AbortSignal
}

function buildJudgeSystemPrompt(rule: ScoringRule): string {
  return [
    '你是阅卷助手。输入是答题卡/试卷的局部截图。',
    '请严格按照以下判分规则逐题识别作答并判分，规则与题型以文本为准：',
    '',
    '===== 判分规则 =====',
    rule.ruleText,
    '====================',
    '',
    '严格输出 JSON，格式：',
    '{"items":[{"label":"56","response":"immediately","correct":true}],',
    ' "score":13.5,',
    ' "confidence":0.95,',
    ' "lowConfidence":false}',
    '',
    '要求：',
    '- items 必须覆盖规则中列出的每一题，label 使用规则中的题号或条目标识',
    '- response 保留作答原样（含大小写与拼写），无法辨认时 response 留空并 correct=false',
    '- score 为按规则算得的总分；confidence 为整体识别把握 0~1',
    '- 卷面存在涂改时，按规则约定的涂改判定方式处理；无法确定时置 lowConfidence=true'
  ].join('\n')
}

function parseJsonLoose(text: string): unknown {
  // 剥离可能的 markdown 代码栅栏后解析
  const stripped = text
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/, '')
    .trim()
  return JSON.parse(stripped)
}

/** 判分：规则文本驱动，返回逐条判定与总分 */
export async function judgePaper(
  model: ModelConfig,
  rule: ScoringRule,
  imageDataUrl: string,
  options: CallOptions = {}
): Promise<JudgeResult> {
  const completion = await client(model).chat.completions.create(
    {
      model: model.model,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: buildJudgeSystemPrompt(rule) },
        {
          role: 'user',
          content: [
            { type: 'text', text: '请按规则判分，严格按约定 JSON 输出。' },
            { type: 'image_url', image_url: { url: imageDataUrl } }
          ]
        }
      ]
    },
    { signal: options.signal }
  )
  const raw = completion.choices[0]?.message?.content
  if (!raw) throw new Error('模型返回为空')
  const parsed = parseJsonLoose(raw) as Partial<JudgeResult>
  if (!Array.isArray(parsed.items) || typeof parsed.score !== 'number') {
    throw new Error(`模型输出格式异常：${raw.slice(0, 200)}`)
  }
  return {
    items: parsed.items.map((it) => ({
      label: String(it.label ?? ''),
      response: String(it.response ?? ''),
      correct: Boolean(it.correct)
    })),
    score: parsed.score,
    lowConfidence: Boolean(parsed.lowConfidence),
    confidence: Number(parsed.confidence ?? 1)
  }
}

/** 连接测试：最小请求验证 baseURL / key / model 可用 */
export async function testModel(model: ModelConfig): Promise<void> {
  await client(model).chat.completions.create({
    model: model.model,
    max_tokens: 1,
    messages: [{ role: 'user', content: 'ping' }]
  })
}

/** 操作规划：模型看操作区截图，输出录入得分并提交的操作序列 */
export async function planActions(
  model: ModelConfig,
  actionImageDataUrl: string,
  score: number,
  options: CallOptions = {}
): Promise<ActionPlan> {
  const completion = await client(model).chat.completions.create(
    {
      model: model.model,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: [
            '你是界面操作规划器。输入是评卷平台给分板操作区的截图。',
            '任务：规划把指定得分录入并提交的操作序列。',
            `需要录入的得分：${score}`,
            '严格输出 JSON：',
            '{"actions":[{"type":"click","x":120,"y":40},{"type":"type","text":"9"},{"type":"key","key":"enter"}]}',
            '要求：',
            '- 坐标 x/y 为截图内的像素坐标，必须精准落在分数输入框上',
            '- 标准流程：先 click 聚焦分数输入框，再 type 分数文本，最后 key enter 提交',
            '- 操作数量最少化，不要输出多余动作'
          ].join('\n')
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: `请规划录入 ${score} 分并提交的操作序列。` },
            { type: 'image_url', image_url: { url: actionImageDataUrl } }
          ]
        }
      ]
    },
    { signal: options.signal }
  )
  const raw = completion.choices[0]?.message?.content
  if (!raw) throw new Error('模型返回为空')
  const parsed = parseJsonLoose(raw) as Partial<ActionPlan>
  if (!Array.isArray(parsed.actions)) {
    throw new Error(`操作规划格式异常：${raw.slice(0, 200)}`)
  }
  return { actions: parsed.actions as ActionPlan['actions'] }
}

/** 调试对话：user 消息中的 images 转为 image_url parts */
export async function chat(model: ModelConfig, messages: ChatMessage[]): Promise<string> {
  const payload = messages.map((m) => {
    if (m.role === 'user' && m.images && m.images.length > 0) {
      return {
        role: m.role,
        content: [
          { type: 'text', text: m.content },
          ...m.images.map((url) => ({ type: 'image_url', image_url: { url } }))
        ]
      }
    }
    return { role: m.role, content: m.content }
  })
  const completion = await client(model).chat.completions.create({
    model: model.model,
    messages: payload as OpenAI.ChatCompletionMessageParam[]
  })
  const content = completion.choices[0]?.message?.content
  if (!content) throw new Error('模型返回为空')
  return content
}

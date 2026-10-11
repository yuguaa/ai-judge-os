// 浏览器 UI 调试用：注入 mock 的 window.api（不连接 Electron 主进程）
const state = {
  config: {
    regions: {
      answer: { x: 0, y: 0, width: 400, height: 240 },
      action: { x: 10, y: 10, width: 300, height: 100 },
      process: null
    },
    model: {
      baseUrl: 'https://api.deepseek.com/v1',
      apiKey: 'sk-mock-key',
      model: 'qwen-vl-max'
    },
    rule: {
      ruleText:
        '题型：英语语法填空，共 10 空，每空 1.5 分，满分 15 分。\n判分标准：全对得分；错答、漏答、多词判 0 分；大小写敏感。'
    },
    autoCount: 10
  },
  chat: [
    { role: 'user', content: '58 空学生写的是 legending，按规则应该判对还是判错？' },
    {
      role: 'assistant',
      content:
        '按规则 58 空参考答案为 legendary，legending 拼写有误，应判错。建议在规则中明确拼写错误一律判错。'
    }
  ],
  records: [
    {
      id: 'demo-1',
      time: '14:32:08',
      score: 12,
      items: [
        { label: '56', response: 'immediately', correct: true },
        { label: '57', response: 'which', correct: true },
        { label: '58', response: 'legending', correct: false },
        { label: '59', response: 'an', correct: true }
      ],
      lowConfidence: false,
      confidence: 0.93,
      thumbnail: ''
    },
    {
      id: 'demo-2',
      time: '14:35:41',
      score: 9,
      items: [
        { label: '60', response: 'has been', correct: true },
        { label: '61', response: 'build', correct: false },
        { label: '62', response: '', correct: false }
      ],
      lowConfidence: true,
      confidence: 0.61,
      thumbnail: ''
    }
  ],
  listeners: {}
}

const emit = (channel, payload) =>
  Object.values(state.listeners).forEach((set) => set.forEach((cb) => cb(payload)))

window.api = {
  platform: 'darwin',
  invoke: async (channel, payload) => {
    switch (channel) {
      case 'config:get':
        return state.config
      case 'config:set':
        state.config = payload
        return payload
      case 'perm:check':
        return { screenCapture: true, accessibility: true }
      case 'region:select':
        return { x: 40, y: 60, width: 360, height: 200 }
      case 'region:capture':
        return 'data:image/png;base64,iVBORw0KGgo='
      case 'engine:start': {
        emit('engine:event', { type: 'state', state: 'judging' })
        emit('engine:event', { type: 'progress', done: 0, total: payload.count })
        return undefined
      }
      case 'engine:stop':
        emit('engine:event', { type: 'state', state: 'stopped', message: '已停止评卷' })
        return undefined
      case 'engine:resume':
        return undefined
      case 'records:get':
        return state.records
      case 'chat:get':
        return state.chat
      case 'chat:send': {
        state.chat = [
          ...payload.filter((m) => !m.images),
          { role: 'assistant', content: '模型回复：按规则该空应判错（模拟响应）。' }
        ]
        emit('chat:updated', state.chat)
        return '模型回复：按规则该空应判错（模拟响应）。'
      }
      case 'panel:open':
        return undefined
      case 'model:test':
        return undefined
      case 'app:quit':
        return undefined
      default:
        return undefined
    }
  },
  on: (channel, cb) => {
    ;(state.listeners[channel] ??= new Set()).add(cb)
    return () => state.listeners[channel]?.delete(cb)
  },
  overlayResult: () => {}
}

// 页面背景：HUD 窗口在 Electron 里透明，浏览器调试时垫一层桌面感背景
document.addEventListener('DOMContentLoaded', () => {
  const bg = document.createElement('div')
  bg.style.cssText =
    'position:fixed;inset:0;z-index:-1;background:radial-gradient(90% 70% at 30% 0%,#243447 0%,#141c29 48%,#0a0d12 100%)'
  document.body.appendChild(bg)
})

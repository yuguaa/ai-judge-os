/**
 * 渲染层 window.api 类型声明
 */
import type { Api } from './index'

declare global {
  interface Window {
    api: Api
  }
}

export {}

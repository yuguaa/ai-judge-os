/**
 * 系统级键鼠注入：koffi 直调系统 API，双平台实现
 * - macOS：CoreGraphics（CGEvent 鼠标/键盘）+ 权限检测（TCC）
 * - Windows：user32（SetCursorPos + SendInput），无需特殊权限
 */
import koffi from 'koffi'
import type { PermissionStatus } from '../shared/types'

const CG_PATH = '/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics'
const CF_PATH = '/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation'
const AS_PATH = '/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices'

// ===== macOS CGEvent 常量 =====
const K_CG_EVENT_LEFT_MOUSE_DOWN = 1
const K_CG_EVENT_LEFT_MOUSE_UP = 2
const K_CG_MOUSE_BUTTON_LEFT = 0
const K_CG_HID_EVENT_TAP = 0

// ANSI US 键盘 keycode（macOS）
const KEY_RETURN_MAC = 36
const KEY_DOT_MAC = 47
const KEY_DIGITS_MAC = [29, 18, 19, 20, 21, 23, 22, 26, 28, 25]

// ===== Windows 常量 =====
const INPUT_MOUSE = 0
const INPUT_KEYBOARD = 1
const MOUSEEVENTF_LEFTDOWN = 0x0002
const MOUSEEVENTF_LEFTUP = 0x0004
const KEYEVENTF_KEYUP = 0x0002
const VK_RETURN = 0x0d
const VK_BACK = 0x08
const VK_OEM_PERIOD = 0xbe

interface CgLib {
  createMouse: koffi.KoffiFunction
  createKeyboard: koffi.KoffiFunction
  post: koffi.KoffiFunction
  release: koffi.KoffiFunction
  preflightScreen: koffi.KoffiFunction
  axTrusted: koffi.KoffiFunction
}

interface WinLib {
  sendInput: koffi.KoffiFunction
  setCursorPos: koffi.KoffiFunction
}

let cgLib: CgLib | null = null
let winLib: WinLib | null = null

function ensureCg(): CgLib {
  if (cgLib) return cgLib
  koffi.struct('CGPoint', { x: 'double', y: 'double' })
  const cg = koffi.load(CG_PATH)
  const cf = koffi.load(CF_PATH)
  const as = koffi.load(AS_PATH)
  cgLib = {
    createMouse: cg.func('void* CGEventCreateMouseEvent(const void *source, uint32 eventType, CGPoint point, uint32 button)'),
    createKeyboard: cg.func('void* CGEventCreateKeyboardEvent(const void *source, uint16 virtualKey, bool keyDown)'),
    post: cg.func('void CGEventPost(uint32 tap, const void *event)'),
    release: cf.func('void CFRelease(void *cf)'),
    preflightScreen: cg.func('bool CGPreflightScreenCaptureAccess()'),
    axTrusted: as.func('bool AXIsProcessTrusted()')
  }
  return cgLib
}

function ensureWin(): WinLib {
  if (winLib) return winLib
  // INPUT 结构体：64 位下 type 后有 4 字节对齐填充，koffi 按 ABI 自动处理
  koffi.struct('POINT', { x: 'long', y: 'long' })
  koffi.struct('MOUSEINPUT', {
    dx: 'long',
    dy: 'long',
    mouseData: 'uint32',
    dwFlags: 'uint32',
    time: 'uint32',
    dwExtraInfo: 'uintptr_t'
  })
  koffi.struct('KEYBDINPUT', {
    wVk: 'uint16',
    wScan: 'uint16',
    dwFlags: 'uint32',
    time: 'uint32',
    dwExtraInfo: 'uintptr_t'
  })
  koffi.union('INPUT_UNION', {
    mouse: 'MOUSEINPUT',
    keyboard: 'KEYBDINPUT'
  })
  koffi.struct('INPUT', { type: 'uint32', u: 'INPUT_UNION' })
  const user32 = koffi.load('user32.dll')
  winLib = {
    sendInput: user32.func('unsigned int SendInput(unsigned int cInputs, INPUT *pInputs, int cbSize)'),
    setCursorPos: user32.func('bool SetCursorPos(int X, int Y)')
  }
  return winLib
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

const isMac = process.platform === 'darwin'
const isWin = process.platform === 'win32'

/** 注入鼠标左键单击 */
export async function click(x: number, y: number): Promise<void> {
  const px = Math.round(x)
  const py = Math.round(y)
  if (isMac) {
    const { createMouse, post, release } = ensureCg()
    const point = { x, y }
    const down = createMouse(null, K_CG_EVENT_LEFT_MOUSE_DOWN, point, K_CG_MOUSE_BUTTON_LEFT)
    post(K_CG_HID_EVENT_TAP, down)
    release(down)
    await sleep(30)
    const up = createMouse(null, K_CG_EVENT_LEFT_MOUSE_UP, point, K_CG_MOUSE_BUTTON_LEFT)
    post(K_CG_HID_EVENT_TAP, up)
    release(up)
  } else if (isWin) {
    const { sendInput, setCursorPos } = ensureWin()
    if (!setCursorPos(px, py)) {
      throw new Error(`SetCursorPos 失败: (${px}, ${py})`)
    }
    const down = { type: INPUT_MOUSE, u: { mouse: { dx: 0, dy: 0, mouseData: 0, dwFlags: MOUSEEVENTF_LEFTDOWN, time: 0, dwExtraInfo: 0 } } }
    const up = { type: INPUT_MOUSE, u: { mouse: { dx: 0, dy: 0, mouseData: 0, dwFlags: MOUSEEVENTF_LEFTUP, time: 0, dwExtraInfo: 0 } } }
    if (sendInput(1, [down], 40) !== 1) throw new Error('SendInput 鼠标按下失败')
    await sleep(30)
    if (sendInput(1, [up], 40) !== 1) throw new Error('SendInput 鼠标抬起失败')
  } else {
    throw new Error(`暂不支持的平台：${process.platform}`)
  }
  await sleep(60)
}

/** 键入单个虚拟键码（Windows VK 码） */
async function tapVkWin(vk: number): Promise<void> {
  const { sendInput } = ensureWin()
  const down = { type: INPUT_KEYBOARD, u: { keyboard: { wVk: vk, wScan: 0, dwFlags: 0, time: 0, dwExtraInfo: 0 } } }
  const up = { type: INPUT_KEYBOARD, u: { keyboard: { wVk: vk, wScan: 0, dwFlags: KEYEVENTF_KEYUP, time: 0, dwExtraInfo: 0 } } }
  if (sendInput(1, [down], 40) !== 1) throw new Error('SendInput 按键按下失败')
  await sleep(20)
  if (sendInput(1, [up], 40) !== 1) throw new Error('SendInput 按键抬起失败')
}

/** 键入单个虚拟键码（macOS keycode） */
async function tapKeyMac(keycode: number): Promise<void> {
  const { createKeyboard, post, release } = ensureCg()
  const down = createKeyboard(null, keycode, true)
  post(K_CG_HID_EVENT_TAP, down)
  release(down)
  await sleep(20)
  const up = createKeyboard(null, keycode, false)
  post(K_CG_HID_EVENT_TAP, up)
  release(up)
}

/** 键入分数文本（仅支持数字与小数点，fast-fail 其他字符） */
export async function typeScore(score: string): Promise<void> {
  for (const ch of score) {
    if (ch >= '0' && ch <= '9') {
      if (isMac) {
        await tapKeyMac(KEY_DIGITS_MAC[Number(ch)])
      } else if (isWin) {
        await tapVkWin(0x30 + Number(ch))
      } else {
        throw new Error(`暂不支持的平台：${process.platform}`)
      }
    } else if (ch === '.') {
      if (isMac) {
        await tapKeyMac(KEY_DOT_MAC)
      } else if (isWin) {
        await tapVkWin(VK_OEM_PERIOD)
      } else {
        throw new Error(`暂不支持的平台：${process.platform}`)
      }
    } else {
      throw new Error(`分数包含无法键入的字符：${ch}`)
    }
    await sleep(40)
  }
}

/** 注入回车键 */
export async function pressEnter(): Promise<void> {
  if (isMac) {
    await tapKeyMac(KEY_RETURN_MAC)
  } else if (isWin) {
    await tapVkWin(VK_RETURN)
  } else {
    throw new Error(`暂不支持的平台：${process.platform}`)
  }
  await sleep(80)
}

/** 检测系统权限：屏幕录制 / 辅助功能（Windows 无 TCC，恒为可用） */
export function checkPermissions(): PermissionStatus {
  if (isWin) {
    return { screenCapture: true, accessibility: true }
  }
  const { preflightScreen, axTrusted } = ensureCg()
  return {
    screenCapture: preflightScreen(),
    accessibility: axTrusted()
  }
}

/** 退格键（预留：键入校验失败时清空输入框） */
export async function pressBackspace(): Promise<void> {
  if (isMac) {
    // macOS delete keycode = 51
    await tapKeyMac(51)
  } else if (isWin) {
    await tapVkWin(VK_BACK)
  }
  await sleep(40)
}

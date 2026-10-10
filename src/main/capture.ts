/**
 * 屏幕截取：desktopCapturer 全屏捕获取主屏，按逻辑矩形裁剪
 * 坐标体系：Region 为逻辑点坐标，截图像素为物理像素，换算乘 devicePixelRatio
 */
import { desktopCapturer, screen } from 'electron'
import type { Region } from '../shared/types'

/** 截取主屏指定逻辑矩形，返回裁剪后的 NativeImage */
export async function captureRegion(rect: Region): Promise<Electron.NativeImage> {
  const display = screen.getPrimaryDisplay()
  const dpr = display.scaleFactor
  const sources = await desktopCapturer.getSources({
    types: ['screen'],
    thumbnailSize: {
      width: display.size.width * dpr,
      height: display.size.height * dpr
    }
  })
  if (sources.length === 0) {
    throw new Error('屏幕捕获失败：未获取到屏幕源（请检查屏幕录制权限）')
  }
  const full = sources[0].thumbnail
  return full.crop({
    x: Math.round(rect.x * dpr),
    y: Math.round(rect.y * dpr),
    width: Math.round(rect.width * dpr),
    height: Math.round(rect.height * dpr)
  })
}

/** 截取并返回 dataURL（PNG） */
export async function captureRegionDataUrl(rect: Region): Promise<string> {
  const img = await captureRegion(rect)
  return img.toDataURL()
}

/** 截取并返回位图 buffer 与尺寸（用于像素比对） */
export async function captureRegionBitmap(
  rect: Region
): Promise<{ buffer: Buffer; width: number; height: number }> {
  const img = await captureRegion(rect)
  const size = img.getSize()
  return { buffer: img.toBitmap(), width: size.width, height: size.height }
}

/**
 * 截屏能力实测探针：desktopCapturer 能拿到 screen 源才算真可用
 * （部分新版 macOS 上 CGPreflight 返回 true 但实际截屏被拒，以实测为准）
 */
export async function probeScreenCapture(): Promise<boolean> {
  try {
    const sources = await desktopCapturer.getSources({ types: ['screen'] })
    return sources.length > 0
  } catch {
    return false
  }
}

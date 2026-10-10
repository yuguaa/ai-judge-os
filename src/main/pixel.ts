/**
 * 像素差异比对：用于锚点校验与新卷到达检测
 * 输入为 NativeImage.toBitmap() 的 BGRA buffer，按步进采样控制开销
 */

/** 采样比对两块位图，返回差异像素占比 0~1 */
export function diffRatio(a: Buffer, b: Buffer, sampleSteps = 20000): number {
  if (a.length !== b.length) return 1
  const total = a.length / 4
  const step = Math.max(1, Math.floor(total / sampleSteps))
  let diff = 0
  let count = 0
  for (let i = 0; i < total; i += step) {
    const off = i * 4
    // 逐通道比较，任一通道差值超过阈值记为差异像素
    const delta =
      Math.abs(a[off] - b[off]) +
      Math.abs(a[off + 1] - b[off + 1]) +
      Math.abs(a[off + 2] - b[off + 2])
    if (delta > 30) diff++
    count++
  }
  return count === 0 ? 0 : diff / count
}

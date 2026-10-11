/**
 * Toast：sonner 深色玻璃主题
 * HUD 窗口：控制条正上方，自下向上生长，多 toast 不会压到控制条
 * 面板窗口：顶部居中
 */
import { Toaster as Sonner, type ToasterProps } from 'sonner'

export function Toaster(props: Partial<ToasterProps>): JSX.Element {
  const { position = 'top-center', offset = 20, ...rest } = props
  return (
    <Sonner
      theme="dark"
      richColors
      position={position}
      offset={offset}
      gap={8}
      {...rest}
      toastOptions={{
        style: {
          background: 'rgba(25,25,32,0.96)',
          border: '1px solid rgba(255,255,255,0.09)',
          color: 'rgba(255,255,255,0.92)',
          borderRadius: 12,
          boxShadow:
            '0 12px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.05)',
          backdropFilter: 'blur(16px)',
          fontSize: 12.5,
          fontWeight: 500
        },
        ...rest.toastOptions
      }}
    />
  )
}

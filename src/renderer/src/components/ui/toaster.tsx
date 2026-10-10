/**
 * Toast：sonner 深色主题，提示弹出在屏幕上方（控制条悬浮底部不冲突）
 */
import { Toaster as Sonner } from 'sonner'

export function Toaster(): JSX.Element {
  return (
    <Sonner
      theme="dark"
      richColors
      position="top-center"
      offset={20}
      toastOptions={{
        style: {
          background: '#1c1c22',
          border: '1px solid rgba(255,255,255,0.08)',
          color: 'rgba(255,255,255,0.92)'
        }
      }}
    />
  )
}

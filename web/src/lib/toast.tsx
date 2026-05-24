/**
 * Minimal undo toast — no external dependency.
 * Renders a fixed bar at the bottom-right, auto-dismisses after the delay.
 */
import { createRoot } from 'react-dom/client'

interface ToastOptions {
  action?: { label: string; onClick: () => void }
  duration?: number
}

export function toast(message: string, options: ToastOptions = {}) {
  const { action, duration = 4000 } = options

  const container = document.createElement('div')
  document.body.appendChild(container)

  let dismissed = false

  function dismiss() {
    if (dismissed) return
    dismissed = true
    root.unmount()
    document.body.removeChild(container)
  }

  const timer = setTimeout(dismiss, duration + 300)

  function handleAction() {
    clearTimeout(timer)
    action?.onClick()
    dismiss()
  }

  const root = createRoot(container)

  root.render(
    <div
      style={{
        position: 'fixed',
        bottom: '1.5rem',
        right: '1.5rem',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '0.75rem',
        background: 'var(--background)',
        border: '1px solid var(--border)',
        borderRadius: '0.5rem',
        padding: '0.65rem 1rem',
        boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
        fontSize: '0.8125rem',
        color: 'var(--foreground)',
        fontFamily: 'inherit',
        animation: `toast-in 180ms ease`,
      }}
    >
      <span>{message}</span>
      {action && (
        <button
          onClick={handleAction}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            fontFamily: 'inherit',
            fontSize: '0.75rem',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
            color: 'var(--primary)',
            padding: '0 0.25rem',
            fontWeight: 600,
          }}
        >
          {action.label}
        </button>
      )}
      <style>{`
        @keyframes toast-in {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )

  return { dismiss }
}

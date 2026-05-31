import { useState, useEffect, useRef, type RefObject } from 'react'
import { useParams } from 'react-router-dom'
import {
  Heart, Coins, ShoppingBag, Swords, RefreshCw,
  MapPin, ArrowLeft, SkipForward, X, Trophy, Sun, Moon,
  Flame, Skull, Star,
} from 'lucide-react'
import {
  motion, AnimatePresence,
  useMotionValue, useTransform, animate,
} from 'motion/react'
import { useTheme } from '@/hooks/use-theme'
import { useSessionByCode, useEndTurn } from '@/lib/sessions.queries'
import { useMap } from '@/lib/maps.queries'
import { useItems } from '@/lib/items.queries'
import { usePlayerAction } from '@/lib/gm-actions.queries'
import { useGameConfig } from '@/lib/game-config.queries'
import { useWheel } from '@/lib/wheels.queries'
import type { Cell, Wheel, WheelEntry, BossFightSpinResult } from '@blind/shared'
import { CELL_COLORS as CELL_TYPE_COLORS, CELL_LABELS as CELL_TYPE_LABELS } from '@/app/_components/MapCanvas'
import { SpinWheel, type SpinWheelHandle } from '@/app/_components/SpinWheel'

// ─── Fog background ───────────────────────────────────────────────────────────

function FogBackground({ cellColor }: { cellColor: string }) {
  const orbStyle: React.CSSProperties = {
    position: 'absolute',
    borderRadius: '50%',
    filter: 'blur(72px)',
    willChange: 'transform',
    pointerEvents: 'none',
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
      {/* Orb 1 — top-left, slow drift */}
      <motion.div
        style={{ ...orbStyle, width: '110%', height: '70%', top: '-20%', left: '-20%', background: cellColor, opacity: 0.09 }}
        animate={{ x: ['0%', '8%', '-4%', '6%', '0%'], y: ['0%', '10%', '6%', '-6%', '0%'] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />
      {/* Orb 2 — bottom-right, medium drift */}
      <motion.div
        style={{ ...orbStyle, width: '100%', height: '80%', bottom: '-25%', right: '-20%', background: cellColor, opacity: 0.07 }}
        animate={{ x: ['0%', '-10%', '6%', '-6%', '0%'], y: ['0%', '-12%', '4%', '-8%', '0%'] }}
        transition={{ duration: 27, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />
      {/* Orb 3 — center, opposite phase */}
      <motion.div
        style={{ ...orbStyle, width: '70%', height: '55%', top: '25%', left: '20%', background: cellColor, opacity: 0.055 }}
        animate={{ x: ['0%', '-8%', '10%', '-4%', '0%'], y: ['0%', '14%', '-8%', '10%', '0%'] }}
        transition={{ duration: 19, repeat: Infinity, ease: 'easeInOut', times: [0, 0.25, 0.5, 0.75, 1] }}
      />
      {/* Color transition layer — crossfades on cell change */}
      <AnimatePresence>
        <motion.div
          key={cellColor}
          className="absolute inset-0"
          initial={{ opacity: 0.18 }}
          animate={{ opacity: 0 }}
          exit={{}}
          transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: cellColor, pointerEvents: 'none' }}
        />
      </AnimatePresence>
    </div>
  )
}

// ─── Spring configs ───────────────────────────────────────────────────────────

const SPRING_SNAP   = { type: 'spring', stiffness: 600, damping: 38, mass: 0.8 } as const
const SPRING_LAND   = { type: 'spring', stiffness: 400, damping: 30, mass: 1.0 } as const
const SPRING_GENTLE = { type: 'spring', stiffness: 280, damping: 28, mass: 0.9 } as const
const SPRING_BOUNCE = { type: 'spring', stiffness: 500, damping: 20, mass: 0.6 } as const

// ─── Cell type icons ──────────────────────────────────────────────────────────

const CELL_ICONS: Partial<Record<string, React.FC<{ className?: string }>>> = {
  shop:   ShoppingBag,
  trap:   Skull,
  boss:   Swords,
  loot:   Star,
  chance: RefreshCw,
  jail:   MapPin,
  start:  Flame,
}

// ─── Relative time ────────────────────────────────────────────────────────────

// ─── Compass ──────────────────────────────────────────────────────────────────

type Direction = 'N' | 'NE' | 'E' | 'SE' | 'S' | 'SW' | 'W' | 'NW'

const HANDLE_TO_DIR: Record<string, Direction> = {
  st: 'N', str: 'NE', sr: 'E', sbr: 'SE',
  sb: 'S', sbl: 'SW', sl: 'W', stl: 'NW',
}

function getDirectionFromHandle(h: string | undefined, from: Cell, to: Cell): Direction {
  if (h && HANDLE_TO_DIR[h]) return HANDLE_TO_DIR[h]
  const dr = to.row - from.row, dc = to.col - from.col
  if (dr < 0 && dc === 0) return 'N'
  if (dr < 0 && dc > 0)  return 'NE'
  if (dr === 0 && dc > 0) return 'E'
  if (dr > 0 && dc > 0)  return 'SE'
  if (dr > 0 && dc === 0) return 'S'
  if (dr > 0 && dc < 0)  return 'SW'
  if (dr === 0 && dc < 0) return 'W'
  return 'NW'
}

const DIR_GRID: Record<Direction, [number, number]> = {
  NW: [1,1], N: [2,1], NE: [3,1],
  W:  [1,2],           E:  [3,2],
  SW: [1,3], S: [2,3], SE: [3,3],
}

// ─── Gold counter ─────────────────────────────────────────────────────────────

function GoldCounter({ value }: { value: number }) {
  const mv = useMotionValue(value)
  const display = useTransform(mv, v => Math.round(v).toString())
  const prevRef = useRef(value)
  const deltaRef = useRef(0)
  const [flash, setFlash] = useState<'gain' | 'loss' | null>(null)
  const [burst, setBurst] = useState(false)

  useEffect(() => {
    if (value === prevRef.current) return
    const gaining = value > prevRef.current
    deltaRef.current = Math.abs(value - prevRef.current)
    prevRef.current = value
    setFlash(gaining ? 'gain' : 'loss')
    setBurst(true)
    const ctrl = animate(mv, value, { duration: 0.7, ease: [0.16, 1, 0.3, 1] })
    const t1 = setTimeout(() => setFlash(null), 800)
    const t2 = setTimeout(() => setBurst(false), 600)
    return () => { ctrl.stop(); clearTimeout(t1); clearTimeout(t2) }
  }, [value])  // eslint-disable-line react-hooks/exhaustive-deps

  const gainColor = 'oklch(0.72 0.19 149)'
  const lossColor = 'oklch(0.65 0.22 25)'

  return (
    <span className="flex items-center gap-1.5 relative">
      <motion.span
        animate={burst ? {
          scale: flash === 'gain' ? [1, 1.5, 1] : [1, 0.7, 1],
          rotate: flash === 'gain' ? [0, 15, -10, 0] : [0, -15, 10, 0],
        } : {}}
        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      >
        <Coins
          className="w-4 h-4 transition-colors duration-200"
          style={{ color: flash === 'gain' ? gainColor : flash === 'loss' ? lossColor : 'oklch(0.74 0.19 62 / 60%)' }}
        />
      </motion.span>
      <motion.span
        className="font-display text-2xl tabular-nums leading-none"
        animate={{
          color: flash === 'gain' ? gainColor : flash === 'loss' ? lossColor : 'oklch(0.74 0.19 62)',
          scale: burst ? (flash === 'gain' ? 1.28 : 0.82) : 1,
          y: burst ? (flash === 'gain' ? -4 : 4) : 0,
          textShadow: flash === 'gain'
            ? `0 0 20px ${gainColor}, 0 0 40px ${gainColor}60`
            : flash === 'loss'
            ? `0 0 20px ${lossColor}`
            : 'none',
        }}
        transition={SPRING_BOUNCE}
      >
        <motion.span style={{ display: 'inline-block' }}>{display}</motion.span>
        <span className="text-sm text-primary/40 ml-0.5">g</span>
      </motion.span>
      {/* Floating delta */}
      <AnimatePresence>
        {burst && flash && (
          <motion.span
            key={`delta-${value}`}
            className="absolute -top-5 left-1/2 text-sm font-bold font-display pointer-events-none whitespace-nowrap"
            style={{ color: flash === 'gain' ? gainColor : lossColor, x: '-50%' }}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -20 }}
            exit={{}}
            transition={{ duration: 0.55, ease: 'easeOut' }}
          >
            {flash === 'gain' ? `+${deltaRef.current}` : `−${deltaRef.current}`}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  )
}

// ─── HP Hearts ────────────────────────────────────────────────────────────────

function HpHearts({ hp, maxHp }: { hp: number; maxHp: number }) {
  const [shakingIdx, setShakingIdx] = useState<number | null>(null)
  const [gainingIdx, setGainingIdx] = useState<number | null>(null)
  const prevHpRef = useRef(hp)

  useEffect(() => {
    if (hp < prevHpRef.current) {
      const lost = prevHpRef.current - 1
      setShakingIdx(lost)
      setTimeout(() => setShakingIdx(null), 600)
    } else if (hp > prevHpRef.current) {
      const gained = hp - 1
      setGainingIdx(gained)
      setTimeout(() => setGainingIdx(null), 600)
    }
    prevHpRef.current = hp
  }, [hp])

  return (
    <span className="flex items-center gap-1">
      {Array.from({ length: maxHp }).map((_, i) => {
        const filled = i < hp
        const isLast = filled && hp === 1
        const isShaking = i === shakingIdx
        const isGaining = i === gainingIdx

        return (
          <motion.span
            key={i}
            animate={isShaking
              ? {
                  x: [0, -8, 8, -6, 6, -3, 3, 0],
                  scale: [1, 1.3, 1.3, 1.1, 1.1, 1, 1, 0.55],
                  opacity: [1, 1, 1, 1, 1, 1, 1, 0],
                  rotate: [0, -15, 15, -10, 10, 0, 0, 0],
                }
              : isGaining
              ? { scale: [0, 1.4, 1], rotate: [0, 20, 0] }
              : { x: 0, scale: 1, opacity: 1, rotate: 0 }
            }
            transition={isShaking || isGaining
              ? { duration: isGaining ? 0.4 : 0.55, ease: 'easeOut' }
              : SPRING_SNAP
            }
          >
            <Heart
              className={[
                'w-5 h-5 transition-colors duration-300',
                filled ? 'text-accent fill-accent' : 'text-muted-foreground/20',
                isLast && !isShaking ? 'animate-pulse' : '',
              ].join(' ')}
              style={isGaining ? { filter: 'drop-shadow(0 0 8px var(--success))' } : undefined}
            />
          </motion.span>
        )
      })}
    </span>
  )
}

// ─── Direction button ─────────────────────────────────────────────────────────

function DirButton({
  dir, disabled, onPress, index = 0,
}: {
  dir: Direction
  disabled: boolean
  onPress: () => void
  index?: number
}) {
  const [fired, setFired] = useState(false)

  function handlePress() {
    if (disabled) return
    setFired(true)
    onPress()
  }

  return (
    <motion.button
      onClick={handlePress}
      disabled={disabled}
      initial={{ scale: 0, opacity: 0 }}
      animate={fired
        ? { scale: [1, 1.25, 0.9, 1], opacity: 1 }
        : { scale: 1, opacity: 1 }
      }
      exit={{ scale: 0, opacity: 0 }}
      transition={fired
        ? { duration: 0.4, ease: [0.16, 1, 0.3, 1] }
        : { ...SPRING_BOUNCE, delay: index * 0.04 }
      }
      onAnimationComplete={() => { if (fired) setFired(false) }}
      whileHover={!disabled ? {
        scale: 1.1,
      } : {}}
      whileTap={!disabled ? { scale: 0.82 } : {}}
      className="flex items-center justify-center rounded-xl transition-colors duration-100 disabled:opacity-25 disabled:cursor-not-allowed w-full h-full border border-border bg-card hover:bg-secondary"
    >
      <span className="font-display text-xl tracking-[0.1em] uppercase text-muted-foreground/70">
        {dir}
      </span>
    </motion.button>
  )
}

// ─── Turn sonar ring ──────────────────────────────────────────────────────────

function SonarRing({ color, active }: { color: string; active: boolean }) {
  return (
    <AnimatePresence>
      {active && (
        <>
          <motion.span
            key="sonar1"
            className="absolute inset-0 rounded-full"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 3.2, opacity: 0 }}
            exit={{}}
            transition={{ duration: 1.4, ease: [0.16, 1, 0.3, 1], repeat: Infinity, repeatDelay: 1.2 }}
            style={{ background: color, pointerEvents: 'none' }}
          />
          <motion.span
            key="sonar2"
            className="absolute inset-0 rounded-full"
            initial={{ scale: 1, opacity: 0.5 }}
            animate={{ scale: 2.2, opacity: 0 }}
            exit={{}}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1], repeat: Infinity, repeatDelay: 1.2, delay: 0.3 }}
            style={{ background: color, pointerEvents: 'none' }}
          />
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Full-screen flash ────────────────────────────────────────────────────────

function ScreenFlash({ color, trigger }: { color: string; trigger: number }) {
  return (
    <AnimatePresence>
      {trigger > 0 && (
        <motion.div
          key={trigger}
          className="fixed inset-0 pointer-events-none z-[100]"
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0 }}
          exit={{}}
          transition={{ duration: 0.65, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: color }}
        />
      )}
    </AnimatePresence>
  )
}

// ─── Cell arrival badge ───────────────────────────────────────────────────────

// ─── GM Toast ────────────────────────────────────────────────────────────────

function GmToast({ message, timestamp }: { message: string; timestamp: string }) {
  const dismissKey = `gm-toast-dismissed:${timestamp}`
  const [visible, setVisible] = useState(() => sessionStorage.getItem(dismissKey) !== '1')

  function dismiss() {
    sessionStorage.setItem(dismissKey, '1')
    setVisible(false)
  }

  useEffect(() => {
    if (!visible) return
    const t = setTimeout(dismiss, 5000)
    return () => clearTimeout(t)
  }, [visible])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed top-16 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
          initial={{ y: -16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -12, opacity: 0 }}
          transition={SPRING_SNAP}
        >
          <div
            className="flex items-start gap-2.5 px-4 py-3 rounded-xl shadow-lg max-w-sm w-full pointer-events-auto"
            style={{ background: 'oklch(0.74 0.19 62 / 0.12)', border: '1px solid oklch(0.74 0.19 62 / 0.35)', backdropFilter: 'blur(8px)' }}
          >
            <span className="text-[10px] tracking-widest font-display text-primary/70 uppercase mt-0.5 shrink-0">GM</span>
            <p className="text-sm text-foreground leading-snug flex-1">{message}</p>
            <button onClick={dismiss} className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors mt-0.5">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── End Turn button ──────────────────────────────────────────────────────────

function EndTurnButton({ isPending, hasMoved, needsSpin, onEndTurn }: {
  isPending: boolean
  hasMoved: boolean
  needsSpin: boolean
  onEndTurn: () => void
}) {
  const [shake, setShake] = useState(false)
  const [hint, setHint] = useState<string | null>(null)

  const blocked = isPending || !hasMoved || needsSpin

  function handleClick() {
    if (isPending) return
    if (!hasMoved) {
      setHint('Move first')
      triggerShake()
      return
    }
    if (needsSpin) {
      setHint('Spin the wheel first')
      triggerShake()
      return
    }
    onEndTurn()
  }

  function triggerShake() {
    setShake(true)
    setTimeout(() => setShake(false), 500)
    setTimeout(() => setHint(null), 2200)
  }

  return (
    <motion.div
      className="flex flex-col items-end gap-1.5 shrink-0"
      initial={{ opacity: 0, scale: 0.85 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.85 }}
      transition={SPRING_BOUNCE}
    >
      <motion.button
        className="flex items-center gap-1.5 px-4 min-h-[44px] rounded-xl text-sm font-medium tracking-wide border border-border text-muted-foreground transition-colors shrink-0"
        style={{ cursor: blocked ? 'default' : 'pointer' }}
        onClick={handleClick}
        animate={shake ? { x: [0, -7, 7, -5, 5, -3, 3, 0] } : { x: 0 }}
        whileTap={{ scale: shake ? 1 : 0.91 }}
        transition={shake ? { duration: 0.45, ease: 'easeOut' } : SPRING_SNAP}
      >
        <SkipForward className="w-3.5 h-3.5" />
        {isPending ? '…' : 'End Turn'}
      </motion.button>
      <AnimatePresence>
        {hint && (
          <motion.span
            className="text-[10px] tracking-wide text-accent font-medium text-right"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            {hint}
          </motion.span>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Current space section ────────────────────────────────────────────────────

function CurrentSpaceSection({ cellType, cellLabel, customLabel, onShopOpen }: {
  cellType: string | null
  cellLabel: string
  customLabel?: string
  onShopOpen: () => void
}) {
  const color = cellType ? ((CELL_TYPE_COLORS as Record<string, string>)[cellType] ?? 'oklch(0.6 0.04 70)') : 'oklch(0.6 0.04 70)'
  const CellIcon = cellType ? CELL_ICONS[cellType] : undefined

  return (
    <AnimatePresence mode="wait">
      <motion.section
        key={cellType ?? 'none'}
        className="relative overflow-hidden border-b border-border shrink-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.25 }}
      >
        {/* Color flood background — fades from punchy to subtle */}
        <motion.div
          key={`bg-${cellType}`}
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0.45 }}
          animate={{ opacity: 0.07 }}
          transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
          style={{ background: color }}
        />

        <div className="relative px-5 pt-6 pb-7 flex flex-col gap-3">
          {/* Label row */}
          <div className="flex items-end justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              {/* Spinning icon on arrival */}
              {CellIcon && (
                <motion.span
                  key={`icon-${cellType}`}
                  initial={{ rotate: -180, scale: 0, opacity: 0 }}
                  animate={{ rotate: 0, scale: 1, opacity: 1 }}
                  transition={{ ...SPRING_BOUNCE, delay: 0.04 }}
                  style={{ color, flexShrink: 0 }}
                >
                  <CellIcon className="w-6 h-6" />
                </motion.span>
              )}

              {/* Cell name — slams in big */}
              <motion.span
                key={`label-${cellType}`}
                className="font-display leading-none truncate"
                style={{ fontSize: '2.4rem', color, fontStyle: 'italic', fontWeight: 300 }}
                initial={{ opacity: 0, y: -18, scale: 0.82 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ ...SPRING_BOUNCE, delay: 0.06 }}
              >
                {cellLabel}
              </motion.span>
            </div>

            {/* Shop CTA */}
            {cellType === 'shop' && (
              <motion.button
                onClick={onShopOpen}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium tracking-wide shrink-0"
                style={{ background: `${color}20`, color, border: `1px solid ${color}50` }}
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ ...SPRING_SNAP, delay: 0.15 }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.92 }}
              >
                <ShoppingBag className="w-3.5 h-3.5" /> Enter Shop
              </motion.button>
            )}
          </div>

          {/* Custom label sub-line */}
          {customLabel && (
            <motion.span
              key={`sub-${cellType}`}
              className="text-sm pl-9 leading-snug"
              style={{ color: `${color}80` }}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_GENTLE, delay: 0.12 }}
            >
              {customLabel}
            </motion.span>
          )}
        </div>
      </motion.section>
    </AnimatePresence>
  )
}

// ─── Shop overlay ─────────────────────────────────────────────────────────────

function ShopOverlay({ items, playerGold, isPending, onBuy, onClose }: {
  items: { id: number; name: string; description: string; cost: number }[]
  playerGold: number
  isPending: boolean
  onBuy: (id: number) => void
  onClose: () => void
}) {
  return (
    <motion.div
      className="h-dvh bg-background flex flex-col overflow-hidden"
      initial={{ x: '100%' }}
      animate={{ x: 0 }}
      exit={{ x: '100%' }}
      transition={SPRING_LAND}
    >
      <header className="px-5 py-3 border-b border-border flex items-center gap-3">
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-display tracking-widest uppercase text-sm flex items-center gap-2">
          <ShoppingBag className="w-4 h-4" style={{ color: CELL_TYPE_COLORS.shop }} /> Shop
        </span>
        <span className="ml-auto flex items-center gap-1.5 text-sm">
          <Coins className="w-4 h-4 text-primary/70" />
          <span className="text-primary font-medium tabular-nums">{playerGold}g</span>
        </span>
      </header>
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {items.length === 0 && (
          <p className="px-6 py-8 text-muted-foreground text-sm italic">No items available</p>
        )}
        {items.map((item, i) => (
          <motion.div
            key={item.id}
            className="px-6 py-5 flex items-center gap-4"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_GENTLE, delay: i * 0.06 }}
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{item.name}</p>
              {item.description && <p className="text-xs text-muted-foreground mt-0.5 leading-snug">{item.description}</p>}
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <span className="text-sm text-primary font-medium">{item.cost}g</span>
              <motion.button
                onClick={() => onBuy(item.id)}
                disabled={playerGold < item.cost || isPending}
                whileTap={{ scale: 0.9 }}
                transition={SPRING_SNAP}
                className="px-4 py-2 min-h-10 rounded-lg text-sm font-medium tracking-wide transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ background: `${CELL_TYPE_COLORS.shop}22`, color: CELL_TYPE_COLORS.shop, border: `1px solid ${CELL_TYPE_COLORS.shop}55` }}
              >
                {isPending ? '…' : 'Buy'}
              </motion.button>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  )
}

// ─── Party section ───────────────────────────────────────────────────────────

function PartySection({ players }: {
  players: { id: string; name: string; color: string; gold: number; hp: number; maxHp: number; inventory: { id: number; name: string }[] }[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <motion.section
      className="border-b border-border shrink-0"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ ...SPRING_GENTLE, delay: 0.32 }}
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full px-5 pt-5 pb-5 flex items-center justify-between text-left"
      >
        <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground/50 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-muted-foreground/30 inline-block" />
          Party
        </p>
        <motion.span
          animate={{ rotate: open ? 180 : 0 }}
          transition={SPRING_SNAP}
          className="text-muted-foreground/40"
        >
          ▾
        </motion.span>
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="party-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={SPRING_GENTLE}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 flex flex-col gap-4">
              {players.map((p, i) => (
                <motion.div
                  key={p.id}
                  className="flex flex-col gap-2"
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ ...SPRING_GENTLE, delay: i * 0.05 }}
                >
                  {/* Name + stats row */}
                  <div className="flex items-center gap-3">
                    <span className="w-5 h-5 rounded-full shrink-0" style={{ background: p.color }} />
                    <span className="font-display text-base tracking-wide text-foreground flex-1 truncate">{p.name}</span>
                    <span className="flex items-center gap-1 text-sm tabular-nums text-primary/80">
                      <Coins className="w-3.5 h-3.5 text-primary/50" />{p.gold}g
                    </span>
                    <span className="flex items-center gap-0.5">
                      {Array.from({ length: p.maxHp }).map((_, idx) => (
                        <Heart
                          key={idx}
                          className={`w-3.5 h-3.5 ${idx < p.hp ? 'text-accent fill-accent' : 'text-muted-foreground/20'}`}
                        />
                      ))}
                    </span>
                  </div>
                  {/* Items */}
                  {p.inventory.length > 0 && (
                    <div className="pl-8 flex flex-wrap gap-1.5">
                      {p.inventory.map(item => (
                        <span
                          key={item.id}
                          className="px-2 py-0.5 rounded text-[11px] text-muted-foreground border border-border"
                        >
                          {item.name}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  )
}

// ─── Idle nudge ───────────────────────────────────────────────────────────────

function IdleNudge({ onDismiss }: { onDismiss: () => void }) {
  const [visible, setVisible] = useState(true)

  function dismiss() {
    setVisible(false)
    onDismiss()
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          className="fixed bottom-24 left-0 right-0 z-50 flex justify-center px-4 pointer-events-none"
          initial={{ y: 24, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 16, opacity: 0 }}
          transition={SPRING_SNAP}
        >
          <motion.div
            className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg max-w-sm w-full pointer-events-auto"
            style={{ background: 'oklch(0.74 0.19 62 / 0.14)', border: '1px solid oklch(0.74 0.19 62 / 0.40)', backdropFilter: 'blur(8px)' }}
            animate={{ x: [0, -5, 5, -4, 4, -2, 2, 0] }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          >
            <span className="text-[10px] tracking-widest font-display text-primary/70 uppercase shrink-0">Hey!</span>
            <p className="text-sm text-foreground leading-snug flex-1">It's your turn — don't keep everyone waiting.</p>
            <button onClick={dismiss} className="shrink-0 text-muted-foreground/50 hover:text-foreground transition-colors">
              <X className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ─── Turn sound ───────────────────────────────────────────────────────────────

function playTurnSound() {
  try {
    const ctx = new AudioContext()
    const gain = ctx.createGain()
    gain.connect(ctx.destination)

    const notes = [523.25, 659.25, 783.99] // C5, E5, G5
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator()
      osc.type = 'sine'
      osc.frequency.value = freq
      osc.connect(gain)
      const t = ctx.currentTime + i * 0.12
      gain.gain.setValueAtTime(0, t)
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35)
      osc.start(t)
      osc.stop(t + 0.35)
    })

    setTimeout(() => ctx.close(), 1200)
  } catch {
    // AudioContext not available (e.g., SSR)
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function PlayerViewPage() {
  const { code = '', playerId = '' } = useParams<{ code: string; playerId: string }>()
  const { data: session, isLoading, isError } = useSessionByCode(code)
  const { data: map } = useMap(session?.mapId ?? 0)
  const { data: allItems = [] } = useItems()
  const { data: gameConfig } = useGameConfig()
  const shopItemIds = gameConfig?.cellConfig?.shop?.shopItemIds
  const items = shopItemIds != null ? allItems.filter(i => shopItemIds.includes(i.id)) : allItems
  const chanceWheelId = gameConfig?.cellConfig?.chance?.defaultWheelId ?? 0
  const jailWheelId   = gameConfig?.cellConfig?.jail?.defaultWheelId ?? 0
  const { data: chanceWheel } = useWheel(chanceWheelId)
  const { data: jailWheel }   = useWheel(jailWheelId)
  const playerAction = usePlayerAction(session?.id ?? 0)
  const endTurn = useEndTurn(session?.id ?? 0)
  const { theme, toggle: toggleTheme } = useTheme()

  const [spinResult, setSpinResult]   = useState<{ entry: WheelEntry; label: string } | null>(null)
  const [bossFight, setBossFight]     = useState<BossFightSpinResult | null>(null)
  const [shopOpen, setShopOpen]       = useState(false)
  const [passiveEvent, setPassiveEvent] = useState<{ type: 'trap' | 'loot'; goldDelta: number } | null>(null)
  const [distanceResult, setDistanceResult] = useState<number | null | undefined>(undefined)
  const [adjacentReveal, setAdjacentReveal] = useState<{ cellId: string; type: string; label: string; direction: string }[] | null>(null)
  const [wheelOpen, setWheelOpen]     = useState<'chance' | 'jail' | 'boss' | false>(false)
  const [screenFlash, setScreenFlash] = useState<{ color: string; key: number } | null>(null)
  const [showNudge, setShowNudge]     = useState(false)
  const wheelRef = useRef<SpinWheelHandle>(null)
  const prevIsMyTurnRef = useRef(false)

  const [, forceUpdate] = useState(0)
  // Keys use currentTurn + cellId only — activePlayerId changes after end turn and must not bust the guard
  const player_ = session?.players.find(pl => pl.id === playerId)
  const p_currentCellId = player_?.currentCellId ?? ''
  const p_hasMoved = player_?.hasMoved ?? false
  const spinTurnKey   = `${session?.currentTurn}-${player_?.currentCellId ?? ''}`
  const jailSpinKey   = `jail-spin:${session?.id ?? ''}:${playerId}:${spinTurnKey}`
  const chanceSpinKey = `chance-spin:${session?.id ?? ''}:${playerId}:${spinTurnKey}`
  const jailSpinResult = session ? (sessionStorage.getItem(jailSpinKey) ?? null) : null
  const chanceSpinDone = session ? sessionStorage.getItem(chanceSpinKey) === '1' : false

  function setJailSpinResult(label: string | null) {
    if (label === null) sessionStorage.removeItem(jailSpinKey)
    else sessionStorage.setItem(jailSpinKey, label)
    forceUpdate(n => n + 1)
  }

  function markChanceSpinDone() {
    sessionStorage.setItem(chanceSpinKey, '1')
    forceUpdate(n => n + 1)
  }

  function flash(color: string) {
    setScreenFlash(prev => ({ color, key: (prev?.key ?? 0) + 1 }))
  }

  useEffect(() => {
    if (!passiveEvent) return
    const t = setTimeout(() => setPassiveEvent(null), 4000)
    return () => clearTimeout(t)
  }, [passiveEvent])

  useEffect(() => {
    if (!session || !map) return
    const p = session.players.find(pl => pl.id === playerId)
    if (!p) return
    const cell = map.cells.find(c => c.id === p.currentCellId)
    const type = cell?.type
    // stable key: turn + cellId only — activePlayerId must NOT be part of this key
    const stk = `${session.currentTurn}-${p.currentCellId}`
    if (type !== 'chance' && type !== 'jail' && type !== 'boss') return
    if (type === 'chance') {
      if (!p.hasMoved) return
      if (sessionStorage.getItem(`chance-spin:${session.id}:${playerId}:${stk}`) === '1') return
    }
    if (type === 'jail') {
      const jailOpenedKey = `jail-opened:${session.id}:${playerId}:${stk}`
      if (sessionStorage.getItem(jailOpenedKey) === '1') return
      if (p.hasMoved) return
      if ((p.skippedTurnsRemaining ?? 0) > 0) return
      sessionStorage.setItem(jailOpenedKey, '1')
    }
    if (type === 'boss' && bossFight !== null) return
    setWheelOpen(type as 'chance' | 'jail' | 'boss')
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.id, session?.currentTurn, p_currentCellId, p_hasMoved, map, playerId])

  // ── Turn sound + idle nudge ─────────────────────────────────────────────────
  useEffect(() => {
    if (!session) return
    const isMyTurn = session.activePlayerId === playerId
    const isDone   = session.turnDoneIds?.includes(playerId) ?? false
    const active   = isMyTurn && !isDone

    // Sound on turn start
    if (active && !prevIsMyTurnRef.current) {
      playTurnSound()
    }
    prevIsMyTurnRef.current = active

    // Idle nudge after 90 s
    if (!active) {
      setShowNudge(false)
      return
    }
    const t = setTimeout(() => setShowNudge(true), 90_000)
    return () => clearTimeout(t)
  }, [session?.activePlayerId, session?.currentTurn, session?.turnDoneIds, playerId])  // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-end turn when player can do nothing (skipping turns after death)
  useEffect(() => {
    if (!session) return
    const isMyTurn = session.activePlayerId === playerId
    const isDone   = session.turnDoneIds?.includes(playerId) ?? false
    const p = session.players.find(pl => pl.id === playerId)
    if (!isMyTurn || isDone || !p) return
    if ((p.skippedTurnsRemaining ?? 0) > 0) {
      const t = setTimeout(() => endTurn.mutate(playerId), 800)
      return () => clearTimeout(t)
    }
  }, [session?.activePlayerId, session?.currentTurn, session?.turnDoneIds, playerId])  // eslint-disable-line react-hooks/exhaustive-deps

  if (isLoading) return (
    <div className="h-dvh bg-background flex items-center justify-center">
      <motion.p
        className="text-muted-foreground tracking-widest uppercase text-sm"
        animate={{ opacity: [0.4, 1, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
      >
        Loading…
      </motion.p>
    </div>
  )

  if (isError || !session) return (
    <div className="h-dvh bg-background flex items-center justify-center">
      <p className="text-muted-foreground tracking-widest uppercase text-sm">Session not found</p>
    </div>
  )

  const player = session.players.find(p => p.id === playerId)
  if (!player) return (
    <div className="h-dvh bg-background flex items-center justify-center">
      <p className="text-muted-foreground tracking-widest uppercase text-sm">Player not found</p>
    </div>
  )

  const currentCell     = map?.cells.find(c => c.id === player.currentCellId)
  const currentCellType = currentCell?.type ?? null
  const isJailed        = currentCellType === 'jail'
  const cellLabel       = currentCellType ? (CELL_TYPE_LABELS[currentCellType] ?? currentCellType) : 'Unknown'
  const adjacentEdges   = map ? map.edges.filter(e => e.from === player.currentCellId) : []

  const dirMap = new Map<Direction, Cell>()
  if (currentCell && map) {
    for (const edge of adjacentEdges) {
      const cell = map.cells.find(c => c.id === edge.to)
      if (!cell) continue
      const dir = getDirectionFromHandle(edge.exitHandle, currentCell, cell)
      if (!dirMap.has(dir)) dirMap.set(dir, cell)
    }
  }

  const DIRS: Direction[] = ['NW', 'N', 'NE', 'W', 'E', 'SW', 'S', 'SE']
  const isMyTurn    = session.activePlayerId === playerId
  const isDone      = session.turnDoneIds?.includes(playerId)
  const isSkipping  = (player.skippedTurnsRemaining ?? 0) > 0
  const activePlayer = session.players.find(p => p.id === session.activePlayerId)

  if (shopOpen) return (
    <AnimatePresence>
      <ShopOverlay
        items={items} playerGold={player.gold} isPending={playerAction.isPending}
        onBuy={id => playerAction.mutate({ type: 'PLAYER_BUY', payload: { playerId, itemId: id } })}
        onClose={() => setShopOpen(false)}
      />
    </AnimatePresence>
  )

  // ── Game over ──────────────────────────────────────────────────────────────
  if (session.status === 'completed') {
    const isWinner = session.winnerId === playerId
    const winner   = session.players.find(p => p.id === session.winnerId)
    return (
      <div className="h-dvh bg-background flex flex-col items-center justify-center px-8 py-12 text-center overflow-y-auto relative">
        <FogBackground cellColor={isWinner ? 'oklch(0.74 0.19 62)' : 'oklch(0.6 0.04 70)'} />
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ ...SPRING_BOUNCE, delay: 0.1 }}
        >
          <Trophy style={{ width: 56, height: 56, color: isWinner ? 'oklch(0.74 0.19 62)' : 'oklch(0.6 0.04 70)' }} />
        </motion.div>

        {session.winnerId ? (
          <>
            <motion.h1
              className="font-display tracking-widest uppercase leading-none mb-3 mt-8"
              style={{ fontSize: '2.8rem', fontWeight: 300, color: isWinner ? 'oklch(0.74 0.19 62)' : 'oklch(0.92 0.03 75)' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ ...SPRING_GENTLE, delay: 0.22 }}
            >
              {isWinner ? 'You Win' : `${winner?.name ?? 'Unknown'} Wins`}
            </motion.h1>
            {session.winTurn && (
              <motion.p
                className="text-sm text-muted-foreground tracking-widest uppercase font-display mb-10"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.38 }}
              >
                Turn {session.winTurn}
              </motion.p>
            )}
          </>
        ) : (
          <motion.h1
            className="font-display tracking-widest uppercase leading-none mb-10 mt-8"
            style={{ fontSize: '2.8rem', fontWeight: 300, color: 'oklch(0.6 0.04 70)' }}
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING_GENTLE, delay: 0.22 }}
          >
            Game Over
          </motion.h1>
        )}

        <div className="w-full max-w-xs border-t border-border pt-8 flex flex-col gap-4">
          {session.players.map((p, i) => (
            <motion.div
              key={p.id}
              className="flex items-center gap-3"
              initial={{ opacity: 0, x: -16 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ ...SPRING_GENTLE, delay: 0.4 + i * 0.07 }}
            >
              <span className="w-6 h-6 rounded-full shrink-0" style={{ background: p.color }} />
              <span className={`font-display text-lg tracking-wide flex-1 text-left ${p.id === playerId ? 'text-foreground' : 'text-muted-foreground'}`}>{p.name}</span>
              <span className="flex items-center gap-1 text-sm tabular-nums text-primary/80">
                <Coins className="w-3.5 h-3.5 text-primary/50" />{p.gold}g
              </span>
              {p.id === session.winnerId && <Trophy className="w-3.5 h-3.5 shrink-0" style={{ color: 'oklch(0.74 0.19 62)' }} />}
            </motion.div>
          ))}
        </div>
      {session.playerBroadcast && (
        <GmToast key={session.playerBroadcast.timestamp} message={session.playerBroadcast.message} timestamp={session.playerBroadcast.timestamp} />
      )}
    </div>
  )
  }


  // ── Main view ──────────────────────────────────────────────────────────────
  const fogColor = currentCellType
    ? ((CELL_TYPE_COLORS as Record<string, string>)[currentCellType] ?? 'oklch(0.74 0.19 62)')
    : 'oklch(0.74 0.19 62)'

  return (
    <div className="h-dvh bg-background flex flex-col overflow-hidden relative">

      {/* Breathing fog background */}
      <FogBackground cellColor={fogColor} />

      {/* Screen flash overlay */}
      {screenFlash && <ScreenFlash color={screenFlash.color} trigger={screenFlash.key} />}

      {/* Idle nudge */}
      {showNudge && <IdleNudge onDismiss={() => setShowNudge(false)} />}

      {/* Top bar */}
      <motion.header
        className="px-5 py-3 border-b border-border flex items-center justify-between gap-4 shrink-0"
        initial={{ y: -48, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ ...SPRING_LAND, delay: 0.05 }}
      >
        <span className="font-display text-lg tracking-widest text-primary uppercase">BLIND</span>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground tracking-widest uppercase">
            <span>{session.name}</span>
            <span className="opacity-30">·</span>
            <span>T{session.currentTurn}</span>
          </div>
          <button onClick={toggleTheme} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </button>
        </div>
      </motion.header>

      {/* GM Broadcast toast */}
      {session.playerBroadcast && (
        <GmToast key={session.playerBroadcast.timestamp} message={session.playerBroadcast.message} timestamp={session.playerBroadcast.timestamp} />
      )}

      <div className="flex-1 overflow-y-auto flex flex-col">

        {/* Identity bar */}
        <motion.section
          className="px-5 pt-5 pb-4 border-b border-border shrink-0"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_GENTLE, delay: 0.1 }}
        >
          {/* Turn status + player name */}
          <motion.div
            key={`turn-${session.activePlayerId}-${session.currentTurn}`}
            className="rounded-xl px-4 py-3 mb-4"
            initial={{
              opacity: 0,
              scale: 0.94,
              backgroundColor: isMyTurn && !isDone ? 'oklch(0.74 0.19 62 / 22%)' : 'transparent',
            }}
            animate={{
              opacity: 1,
              scale: 1,
              backgroundColor: isMyTurn && !isDone ? 'oklch(0.74 0.19 62 / 7%)' : 'transparent',
            }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            style={{ border: isMyTurn && !isDone ? '1px solid oklch(0.74 0.19 62 / 28%)' : '1px solid transparent' }}
          >
            <div className="flex items-center gap-3">
              {/* Player avatar */}
              <span className="relative flex-none" style={{ width: 38, height: 38 }}>
                <SonarRing color={player.color} active={isMyTurn && !isDone} />
                <motion.span
                  className="absolute inset-0 rounded-full ring-2 ring-background"
                  style={{ background: player.color }}
                  animate={{
                    boxShadow: isMyTurn && !isDone ? `0 0 0 3px ${player.color}60, 0 0 24px ${player.color}40` : '0 0 0 0px transparent',
                  }}
                  transition={{ duration: 0.5 }}
                />
              </span>

              <div className="flex-1 min-w-0">
                <span className="font-display text-2xl tracking-wide text-foreground leading-none truncate block">{player.name}</span>
                <AnimatePresence mode="wait">
                  {isSkipping ? (
                    <motion.span key="skip" className="text-xs text-accent/80 font-medium block mt-0.5"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={SPRING_SNAP}>
                      Skipping ({player.skippedTurnsRemaining} turns left)
                    </motion.span>
                  ) : isMyTurn && !isDone ? (
                    <motion.span key="yours" className="text-xs text-primary font-semibold tracking-widest uppercase block mt-0.5"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={SPRING_SNAP}>
                      Your turn
                    </motion.span>
                  ) : isDone ? (
                    <motion.span key="done" className="text-xs text-muted-foreground/60 block mt-0.5"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                      {activePlayer ? `Waiting for ${activePlayer.name}…` : 'Done — waiting…'}
                    </motion.span>
                  ) : activePlayer ? (
                    <motion.span key={activePlayer.id} className="text-xs text-muted-foreground/70 block mt-0.5"
                      initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={SPRING_SNAP}>
                      {activePlayer.name}'s turn
                    </motion.span>
                  ) : null}
                </AnimatePresence>
              </div>

              <AnimatePresence>
                {isMyTurn && !isDone && (() => {
                  const canMove =
                    !!player.hasMoved ||
                    isSkipping ||
                    (currentCellType === 'jail' && !!jailSpinResult) ||
                    (currentCellType === 'boss' && !!bossFight)
                  const needsSpin =
                    !isSkipping && (
                      (currentCellType === 'chance' && !chanceSpinDone) ||
                      (currentCellType === 'jail' && !jailSpinResult) ||
                      (currentCellType === 'boss' && !bossFight)
                    )
                  const ready = canMove && !needsSpin
                  return ready ? (
                    <EndTurnButton
                      isPending={endTurn.isPending}
                      hasMoved={true}
                      needsSpin={false}
                      onEndTurn={() => endTurn.mutate(playerId)}
                    />
                  ) : null
                })()}
              </AnimatePresence>

            </div>
          </motion.div>

          {/* Stats row */}
          <div className="flex items-center gap-6 pl-1">
            <GoldCounter value={player.gold} />
            <HpHearts hp={player.hp} maxHp={player.maxHp} />
          </div>
        </motion.section>

        {/* Current space — drenched arrival */}
        <CurrentSpaceSection
          cellType={currentCellType}
          cellLabel={cellLabel}
          customLabel={currentCell?.label}
          onShopOpen={() => setShopOpen(true)}
        />

        {/* Move / Compass */}
        <motion.section
          className="px-5 pt-5 pb-6 border-b border-border shrink-0"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ ...SPRING_GENTLE, delay: 0.2 }}
        >
          <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground/50 mb-5 flex items-center gap-2">
            <MapPin className="w-3 h-3" /> Navigate
          </p>

          {isJailed ? (
            <div className="flex flex-col gap-4">
              <AnimatePresence mode="wait">
                {jailSpinResult !== null ? (
                  <motion.div
                    key="jail-result"
                    className="flex items-center gap-3"
                    initial={{ opacity: 0, y: -20, scale: 0.8 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={SPRING_BOUNCE}
                  >
                    <MapPin className="w-5 h-5" style={{ color: CELL_TYPE_COLORS.jail }} />
                    <span
                      className="text-2xl font-display tracking-wide"
                      style={{ color: CELL_TYPE_COLORS.jail }}
                    >
                      {jailSpinResult}
                    </span>
                  </motion.div>
                ) : (
                  <motion.button
                    key="jail-btn"
                    onClick={() => setWheelOpen('jail')}
                    disabled={playerAction.isPending}
                    className="w-full py-4 rounded-xl text-base font-medium tracking-wide disabled:opacity-40 disabled:cursor-not-allowed font-display"
                    style={{ background: `${CELL_TYPE_COLORS.jail}18`, color: CELL_TYPE_COLORS.jail, border: `1px solid ${CELL_TYPE_COLORS.jail}55` }}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02, boxShadow: `0 0 20px ${CELL_TYPE_COLORS.jail}30` }}
                    whileTap={{ scale: 0.96 }}
                    transition={SPRING_SNAP}
                  >
                    Spin to Escape
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          ) : adjacentEdges.length === 0 ? (
            <p className="text-muted-foreground text-sm italic">No moves available</p>
          ) : (
            <div className="flex justify-center">
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 84px)', gridTemplateRows: 'repeat(3, 84px)', gap: '6px' }}>
                {DIRS.map((dir, i) => {
                  const [gc, gr] = DIR_GRID[dir]
                  const cell = dirMap.get(dir)
                  if (!cell) return <div key={dir} style={{ gridColumn: gc, gridRow: gr }} />
                  return (
                    <div key={dir} style={{ gridColumn: gc, gridRow: gr }}>
                      <DirButton
                        dir={dir}
                        disabled={playerAction.isPending || !!player.hasMoved}
                        index={i}
                        onPress={() => playerAction.mutate(
                          { type: 'PLAYER_MOVE', payload: { playerId, toCellId: cell.id } },
                          { onSuccess: d => d.passiveEvent && setPassiveEvent(d.passiveEvent) }
                        )}
                      />
                    </div>
                  )
                })}
                {/* Player token center */}
                <div style={{ gridColumn: 2, gridRow: 2 }} className="flex items-center justify-center">
                  <motion.div
                    className="w-12 h-12 rounded-full flex items-center justify-center ring-[3px] ring-background"
                    style={{ background: player.color }}
                    animate={{
                      boxShadow: isMyTurn && !isDone
                        ? [`0 0 0px ${player.color}00`, `0 0 28px ${player.color}70`, `0 0 0px ${player.color}00`]
                        : `0 0 0px transparent`,
                    }}
                    transition={isMyTurn && !isDone
                      ? { duration: 2, repeat: Infinity, ease: 'easeInOut' }
                      : { duration: 0.4 }
                    }
                  >
                    <span className="font-display text-white/80 text-sm font-semibold">
                      {player.name[0]?.toUpperCase()}
                    </span>
                  </motion.div>
                </div>
              </div>
            </div>
          )}
        </motion.section>

        {/* Chance */}
        <AnimatePresence>
          {currentCellType === 'chance' && (
            <motion.section
              className="px-5 pt-5 pb-6 border-b border-border shrink-0"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING_GENTLE}
            >
              <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground/50 mb-5 flex items-center gap-2">
                <RefreshCw className="w-3 h-3" /> Chance
              </p>
              <AnimatePresence mode="wait">
                {chanceSpinDone ? (
                  <motion.div
                    key="chance-done"
                    className="flex items-center gap-3"
                    initial={{ opacity: 0, y: -16, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={SPRING_BOUNCE}
                  >
                    <RefreshCw className="w-5 h-5" style={{ color: CELL_TYPE_COLORS.chance }} />
                    <span className="text-2xl font-display tracking-wide" style={{ color: CELL_TYPE_COLORS.chance }}>
                      {spinResult?.label ?? '—'}
                    </span>
                  </motion.div>
                ) : !player.hasMoved ? (
                  <motion.span key="chance-wait" className="text-sm text-muted-foreground italic"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    Move here first
                  </motion.span>
                ) : (
                  <motion.button
                    key="chance-btn"
                    onClick={() => setWheelOpen('chance')}
                    disabled={playerAction.isPending}
                    className="w-full py-4 rounded-xl text-base font-medium tracking-wide disabled:opacity-40 disabled:cursor-not-allowed font-display"
                    style={{ background: `${CELL_TYPE_COLORS.chance}18`, color: CELL_TYPE_COLORS.chance, border: `1px solid ${CELL_TYPE_COLORS.chance}55` }}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02, boxShadow: `0 0 20px ${CELL_TYPE_COLORS.chance}35` }}
                    whileTap={{ scale: 0.96 }}
                    transition={SPRING_SNAP}
                  >
                    Spin the Wheel
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Boss */}
        <AnimatePresence>
          {currentCellType === 'boss' && (
            <motion.section
              className="px-5 pt-5 pb-6 border-b border-border shrink-0"
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={SPRING_GENTLE}
            >
              <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground/50 mb-5 flex items-center gap-2">
                <Swords className="w-3 h-3" /> Boss Fight
              </p>
              <AnimatePresence mode="wait">
                {bossFight ? (
                  <motion.div
                    key="boss-result"
                    className="flex items-center gap-4"
                    initial={{ opacity: 0, y: -20, scale: 0.85 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={SPRING_BOUNCE}
                  >
                    <span
                      className="text-2xl font-display tracking-wide flex-1"
                      style={{ color: bossFight.outcome === 'win' ? 'var(--success)' : 'var(--accent)' }}
                    >
                      {bossFight.outcome === 'win' ? '+10g gained!' : '−1 heart lost!'}
                    </span>
                    <motion.button
                      onClick={() => setBossFight(null)}
                      className="px-4 py-2 min-h-10 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground transition-colors"
                      whileTap={{ scale: 0.91 }} transition={SPRING_SNAP}
                    >
                      Done
                    </motion.button>
                  </motion.div>
                ) : (
                  <motion.button
                    key="boss-btn"
                    onClick={() => setWheelOpen('boss')}
                    disabled={playerAction.isPending}
                    className="w-full py-4 rounded-xl text-base font-medium tracking-wide disabled:opacity-40 disabled:cursor-not-allowed font-display"
                    style={{ background: `${CELL_TYPE_COLORS.boss}18`, color: CELL_TYPE_COLORS.boss, border: `1px solid ${CELL_TYPE_COLORS.boss}55` }}
                    initial={{ opacity: 0, scale: 0.92 }}
                    animate={{ opacity: 1, scale: 1 }}
                    whileHover={{ scale: 1.02, boxShadow: `0 0 24px ${CELL_TYPE_COLORS.boss}45` }}
                    whileTap={{ scale: 0.96 }}
                    transition={SPRING_SNAP}
                  >
                    Fight!
                  </motion.button>
                )}
              </AnimatePresence>
            </motion.section>
          )}
        </AnimatePresence>

        {/* Inventory */}
        {player.inventory.length > 0 && (
          <motion.section
            className="px-5 pt-5 pb-6 border-b border-border shrink-0"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ ...SPRING_GENTLE, delay: 0.28 }}
          >
            <p className="text-[10px] tracking-[0.18em] uppercase text-muted-foreground/50 mb-5">Inventory</p>
            <div className="flex flex-col gap-4">
              {player.inventory.map(item => {
                const needsTarget  = item.actions?.[0]?.type === 'SWAP_PLAYERS'
                const otherPlayers = session.players.filter(p => p.id !== playerId)
                return (
                  <div key={item.id} className="flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-foreground">{item.name}</span>
                      {!needsTarget && (
                        <motion.button
                          onClick={() => playerAction.mutate(
                            { type: 'PLAYER_USE_ITEM', payload: { playerId, itemId: item.id } },
                            { onSuccess: d => {
                              if (d.distanceToEnd !== undefined) setDistanceResult(d.distanceToEnd ?? null)
                              if (d.adjacentCells) setAdjacentReveal(d.adjacentCells)
                            } }
                          )}
                          disabled={playerAction.isPending}
                          className="px-3 py-1.5 min-h-8 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                          whileTap={{ scale: 0.9 }} transition={SPRING_SNAP}
                        >
                          {playerAction.isPending ? '…' : 'Use'}
                        </motion.button>
                      )}
                    </div>
                    {needsTarget && otherPlayers.length > 0 && (
                      <div className="flex flex-wrap gap-2 pl-1">
                        {otherPlayers.map(target => (
                          <motion.button
                            key={target.id}
                            onClick={() => playerAction.mutate({ type: 'PLAYER_USE_ITEM', payload: { playerId, itemId: item.id, targetPlayerId: target.id } })}
                            disabled={playerAction.isPending}
                            className="flex items-center gap-1.5 px-3 py-1.5 min-h-8 rounded-md border border-border text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                            whileTap={{ scale: 0.9 }} transition={SPRING_SNAP}
                          >
                            <span className="w-2 h-2 rounded-full shrink-0" style={{ background: target.color }} />
                            Swap with {target.name}
                          </motion.button>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </motion.section>
        )}

        {/* Party */}
        {session.players.filter(p => p.id !== playerId).length > 0 && (
          <PartySection players={session.players.filter(p => p.id !== playerId)} />
        )}

        {/* Passive event */}
        <AnimatePresence>
          {passiveEvent && (
            <motion.div
              className="mx-5 my-4 px-5 py-4 rounded-xl shrink-0 flex items-center justify-between gap-3"
              style={passiveEvent.type === 'trap'
                ? { background: 'color-mix(in oklch, var(--accent) 14%, transparent)', border: '1px solid color-mix(in oklch, var(--accent) 40%, transparent)', color: 'var(--accent)' }
                : { background: 'color-mix(in oklch, var(--success) 14%, transparent)', border: '1px solid color-mix(in oklch, var(--success) 40%, transparent)', color: 'var(--success)' }
              }
              initial={{ opacity: 0, scale: 0.85, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 10 }}
              transition={SPRING_BOUNCE}
            >
              <span className="font-display text-xl tracking-wide">
                {passiveEvent.type === 'trap'
                  ? `Trap! −${Math.abs(passiveEvent.goldDelta)}g`
                  : `Loot! +${passiveEvent.goldDelta}g`}
              </span>
              <motion.button onClick={() => setPassiveEvent(null)} whileTap={{ scale: 0.85 }} className="opacity-60 hover:opacity-100 transition-opacity">
                <X className="w-3.5 h-3.5" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Distance result */}
        <AnimatePresence>
          {distanceResult !== undefined && (
            <motion.div
              className="mx-5 my-4 px-5 py-3 rounded-xl shrink-0 flex items-center justify-between gap-3"
              style={{ background: 'color-mix(in oklch, var(--primary) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--primary) 25%, transparent)', color: 'var(--primary)' }}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={SPRING_SNAP}
            >
              <span className="text-sm font-medium">
                {distanceResult === null
                  ? `Oracle's Eye: no path to end found`
                  : `Oracle's Eye: ${distanceResult} step${distanceResult !== 1 ? 's' : ''} to the end`}
              </span>
              <motion.button onClick={() => setDistanceResult(undefined)} whileTap={{ scale: 0.85 }} className="opacity-60 hover:opacity-100 transition-opacity">
                <X className="w-3.5 h-3.5" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Adjacent reveal */}
        <AnimatePresence>
          {adjacentReveal && (
            <motion.div
              className="mx-5 my-4 px-5 py-4 rounded-xl shrink-0 flex flex-col gap-3"
              style={{ background: 'color-mix(in oklch, var(--primary) 8%, transparent)', border: '1px solid color-mix(in oklch, var(--primary) 25%, transparent)' }}
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
              transition={SPRING_SNAP}
            >
              <div className="flex items-center justify-between">
                <span className="text-[10px] tracking-widest uppercase text-muted-foreground/60 font-display">Scout's Map</span>
                <motion.button onClick={() => setAdjacentReveal(null)} whileTap={{ scale: 0.85 }} className="opacity-60 hover:opacity-100 transition-opacity">
                  <X className="w-3.5 h-3.5" />
                </motion.button>
              </div>
              <div className="flex flex-wrap gap-2">
                {adjacentReveal.map((c, i) => {
                  const color = (CELL_TYPE_COLORS as Record<string, string>)[c.type] ?? 'oklch(0.6 0.04 70)'
                  const label = (CELL_TYPE_LABELS as Record<string, string>)[c.type] ?? c.type
                  return (
                    <motion.span
                      key={c.cellId}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium font-display tracking-wide"
                      style={{ background: `${color}18`, color, border: `1px solid ${color}50` }}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ ...SPRING_BOUNCE, delay: i * 0.05 }}
                    >
                      <span className="opacity-50 text-[10px] tracking-widest">{c.direction}</span>
                      {label}
                    </motion.span>
                  )
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        <AnimatePresence>
          {playerAction.isError && (
            <motion.p
              className="px-5 py-3 text-xs text-destructive shrink-0"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            >
              {(playerAction.error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Action failed'}
            </motion.p>
          )}
        </AnimatePresence>

      </div>

      {/* Wheel Modal */}
      <AnimatePresence>
        {wheelOpen && (
          <WheelModal
            cellType={wheelOpen}
            chanceWheel={chanceWheel}
            jailWheel={jailWheel}
            playerHp={player_?.hp ?? 3}
            isPending={playerAction.isPending}
            wheelRef={wheelRef}
            onSpin={() => {
              if (wheelOpen === 'chance') {
                playerAction.mutate(
                  { type: 'PLAYER_SPIN_CHANCE', payload: { playerId } },
                  { onSuccess: d => d.spunEntry && wheelRef.current?.spin(d.spunEntry) }
                )
              } else if (wheelOpen === 'jail') {
                playerAction.mutate(
                  { type: 'PLAYER_SPIN_JAIL', payload: { playerId } },
                  { onSuccess: d => d.spunEntry && wheelRef.current?.spin(d.spunEntry) }
                )
              } else if (wheelOpen === 'boss') {
                playerAction.mutate(
                  { type: 'PLAYER_BOSS_FIGHT', payload: { playerId } },
                  {
                    onSuccess: d => {
                      if (!d.bossFight) return
                      const forced = d.bossFight.outcome === 'win'
                        ? { id: 'win', label: 'Victory!', weight: 3 }
                        : { id: 'lose', label: 'Defeated!', weight: 5 }
                      wheelRef.current?.spin(forced as WheelEntry)
                    },
                  }
                )
              }
            }}
            onResult={entry => {
              if (wheelOpen === 'chance') {
                setSpinResult({ entry, label: entry.label })
                markChanceSpinDone()
                flash('oklch(0.62 0.22 200 / 35%)')
              } else if (wheelOpen === 'jail') {
                setJailSpinResult(entry.label)
                const escaped = entry.label.toLowerCase().match(/escape|free|out/)
                flash(escaped ? 'oklch(0.72 0.17 145 / 40%)' : 'oklch(0.65 0.18 30 / 40%)')
              } else if (wheelOpen === 'boss') {
                setBossFight({ outcome: entry.id === 'win' ? 'win' : 'lose' })
                flash(entry.id === 'win' ? 'oklch(0.74 0.19 62 / 50%)' : 'oklch(0.65 0.18 30 / 60%)')
              }
            }}
            onClose={() => setWheelOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Wheel Modal ──────────────────────────────────────────────────────────────

function WheelModal({
  cellType, chanceWheel, jailWheel, playerHp, isPending, wheelRef, onSpin, onResult, onClose,
}: {
  cellType: 'chance' | 'jail' | 'boss'
  chanceWheel?: Wheel
  jailWheel?: Wheel
  playerHp: number
  isPending: boolean
  wheelRef: RefObject<SpinWheelHandle | null>
  onSpin: () => void
  onResult: (entry: WheelEntry) => void
  onClose: () => void
}) {
  const [spinning, setSpinning] = useState(false)
  const [done, setDone] = useState(false)
  const [resultEntry, setResultEntry] = useState<WheelEntry | null>(null)
  const [resultOutcome, setResultOutcome] = useState<'win' | 'lose' | 'neutral'>('neutral')

  const winWeight = Math.max(1, playerHp)
  const bossEntries = [
    { id: 'win', label: 'Victory!', weight: winWeight },
    { id: 'lose', label: 'Defeated!', weight: 5 },
  ]
  const entries = cellType === 'chance' ? (chanceWheel?.entries ?? [])
    : cellType === 'jail' ? (jailWheel?.entries ?? [])
    : bossEntries

  const wheelName = cellType === 'chance' ? (chanceWheel?.name ?? 'Chance')
    : cellType === 'jail' ? (jailWheel?.name ?? 'Jail Spin')
    : 'Boss Battle'

  const accentColor = cellType === 'chance' ? CELL_TYPE_COLORS.chance
    : cellType === 'jail' ? CELL_TYPE_COLORS.jail
    : CELL_TYPE_COLORS.boss

  const wheelSize = Math.min(typeof window !== 'undefined' ? window.innerWidth - 32 : 340, 340)

  const resultColor = resultOutcome === 'win' ? 'var(--success)'
    : resultOutcome === 'lose' ? 'var(--accent)'
    : accentColor

  return (
    <motion.div
      className="absolute inset-0 z-50 bg-background flex flex-col overflow-hidden"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={SPRING_LAND}
    >
      <header className="px-5 py-3 border-b border-border flex items-center gap-3 shrink-0">
        <motion.button
          onClick={onClose}
          disabled={spinning}
          className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40"
          whileTap={{ scale: 0.85 }} transition={SPRING_SNAP}
        >
          <ArrowLeft className="w-5 h-5" />
        </motion.button>
        <motion.span
          className="font-display tracking-widest uppercase text-base"
          style={{ color: accentColor }}
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ ...SPRING_SNAP, delay: 0.1 }}
        >
          {wheelName}
        </motion.span>
      </header>

      <div className="flex-1 flex flex-col items-center justify-center gap-6 overflow-hidden px-4 py-4">
        {entries.length > 0 ? (
          <>
            <motion.div
              className="w-full flex justify-center"
              initial={{ scale: 0.65, opacity: 0, rotate: -15 }}
              animate={{ scale: 1, opacity: 1, rotate: 0 }}
              transition={{ ...SPRING_BOUNCE, delay: 0.1 }}
            >
              <SpinWheel
                ref={wheelRef}
                entries={entries as WheelEntry[]}
                size={wheelSize}
                onSpinStart={() => setSpinning(true)}
                onResult={entry => {
                  setSpinning(false)
                  setDone(true)
                  setResultEntry(entry)
                  if (cellType === 'boss') {
                    setResultOutcome(entry.id === 'win' ? 'win' : 'lose')
                  } else if (cellType === 'jail') {
                    const lbl = entry.label.toLowerCase()
                    setResultOutcome(lbl.match(/escape|free|out/) ? 'win' : 'lose')
                  }
                  onResult(entry)
                }}
              />
            </motion.div>

            <AnimatePresence mode="wait">
              {done ? (
                <motion.div
                  key="result"
                  className="flex flex-col items-center gap-5 w-full max-w-xs"
                  initial={{ opacity: 0, y: -32, scale: 0.7 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  transition={SPRING_BOUNCE}
                >
                  <motion.span
                    className="font-display text-4xl tracking-wide text-center"
                    style={{ color: resultColor, textShadow: `0 0 30px ${resultColor}60` }}
                    animate={{ scale: [1, 1.08, 1] }}
                    transition={{ duration: 0.4, delay: 0.15 }}
                  >
                    {resultEntry?.label ?? '—'}
                  </motion.span>
                  <motion.button
                    onClick={onClose}
                    className="w-full py-3 rounded-xl text-sm font-medium tracking-wide border border-border text-muted-foreground hover:text-foreground transition-colors"
                    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    whileTap={{ scale: 0.93 }}
                  >
                    Continue
                  </motion.button>
                </motion.div>
              ) : (
                <motion.button
                  key="spin-btn"
                  onClick={() => { if (!spinning && !isPending) onSpin() }}
                  disabled={spinning || isPending}
                  className="w-full max-w-xs py-5 rounded-xl text-base font-medium tracking-widest uppercase disabled:opacity-40 disabled:cursor-not-allowed font-display"
                  style={{ background: `${accentColor}18`, color: accentColor, border: `2px solid ${accentColor}60` }}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{
                    opacity: 1,
                    y: 0,
                    boxShadow: !spinning && !isPending
                      ? [`0 0 0px ${accentColor}00`, `0 0 24px ${accentColor}50`, `0 0 0px ${accentColor}00`]
                      : `0 0 0px transparent`,
                  }}
                  exit={{ opacity: 0, scale: 0.88 }}
                  whileHover={!spinning && !isPending ? { scale: 1.03 } : {}}
                  whileTap={!spinning && !isPending ? { scale: 0.94 } : {}}
                  transition={!spinning && !isPending
                    ? { opacity: { duration: 0.2 }, y: { ...SPRING_SNAP }, boxShadow: { duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.5 } }
                    : SPRING_SNAP
                  }
                >
                  {isPending ? '…' : spinning ? 'Spinning…' : 'Spin'}
                </motion.button>
              )}
            </AnimatePresence>
          </>
        ) : (
          <p className="text-muted-foreground text-sm italic">No wheel configured</p>
        )}
      </div>
    </motion.div>
  )
}

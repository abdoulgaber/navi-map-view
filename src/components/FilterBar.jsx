import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { AREAS } from '../data/projects.js'

/* ─── Filter option sets ────────────────────────────────────────────────── */
export const PRICE_OPTIONS = [
  { label: 'Any Price',  min: 0,          max: Infinity },
  { label: '< 3M EGP',  min: 0,          max: 3_000_000 },
  { label: '3M – 10M',  min: 3_000_000,  max: 10_000_000 },
  { label: '10M – 20M', min: 10_000_000, max: 20_000_000 },
  { label: '20M+',      min: 20_000_000, max: Infinity },
]

export const DELIVERY_OPTIONS = [
  { label: 'Any Delivery', min: -1, max: Infinity },
  { label: 'Ready Now',    min: -1, max: 0 },
  { label: '1 – 2 Years',  min: 0,  max: 2 },
  { label: '3 – 4 Years',  min: 2,  max: 4 },
  { label: '5+ Years',     min: 4,  max: Infinity },
]

export const BUA_OPTIONS = [
  { label: 'Any Size',    min: 0,   max: Infinity },
  { label: '< 100 M²',   min: 0,   max: 100 },
  { label: '100–150 M²', min: 100, max: 150 },
  { label: '150–250 M²', min: 150, max: 250 },
  { label: '250+ M²',    min: 250, max: Infinity },
]

const LOCATION_OPTIONS = [
  { label: 'All Locations' },
  ...AREAS.filter(a => a !== 'All').map(a => ({ label: a })),
]

export const DEFAULT_FILTERS = {
  type:     'All Types',
  price:    PRICE_OPTIONS[0],
  location: LOCATION_OPTIONS[0],
  delivery: DELIVERY_OPTIONS[0],
  bua:      BUA_OPTIONS[0],
  badge:    'All',
}

/* ─── Apply all filters to a project list ──────────────────────────────── */
export function applyFilters(projects, search, filters) {
  return projects.filter(p => {
    if (search.trim()) {
      const q = search.toLowerCase()
      if (
        !p.name.toLowerCase().includes(q) &&
        !p.developer.toLowerCase().includes(q) &&
        !p.location.toLowerCase().includes(q)
      ) return false
    }
    if (filters.type !== 'All Types' && p.type !== filters.type) return false
    if (p.priceValue < filters.price.min || p.priceValue > filters.price.max) return false
    if (
      filters.location.label !== 'All Locations' &&
      p.location !== filters.location.label
    ) return false
    if (filters.delivery.label !== 'Any Delivery') {
      if (filters.delivery.max === 0) {
        if (p.deliveryValue !== 0) return false
      } else {
        if (p.deliveryValue <= filters.delivery.min || p.deliveryValue > filters.delivery.max) return false
      }
    }
    if (p.buaValue < filters.bua.min || p.buaValue > filters.bua.max) return false
    if (filters.badge !== 'All' && !p.badges.includes(filters.badge)) return false
    return true
  })
}

/* ─── Portal dropdown ───────────────────────────────────────────────────── */
function DropdownMenu({ anchorRef, open, onClose, options, activeLabel, onSelect }) {
  if (!open) return null

  const rect = anchorRef.current?.getBoundingClientRect() ?? {}
  const style = {
    position: 'fixed',
    top:  (rect.bottom ?? 0) + 6,
    left: rect.left ?? 0,
    minWidth: Math.max(rect.width ?? 0, 200),
    zIndex: 9999,
  }

  return createPortal(
    <>
      {/* invisible backdrop to catch outside-clicks */}
      <div
        style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
        onClick={onClose}
      />
      <div className="fdrop-menu" style={style}>
        {options.map((opt, i) => {
          const lbl = typeof opt === 'string' ? opt : opt.label
          const isActive = lbl === activeLabel
          return (
            <button
              key={i}
              className={`fdrop-item${isActive ? ' fdrop-item--active' : ''}`}
              onClick={() => { onSelect(opt); onClose() }}
            >
              <span>{lbl}</span>
              {isActive && (
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M2.5 7L5.5 10L11.5 4" stroke="#4C64FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </>,
    document.body,
  )
}

/* ─── Single dropdown chip ─────────────────────────────────────────────── */
function DropdownChip({ icon, label, options, activeLabel, onSelect }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)

  const isActive = activeLabel !== options[0].label && activeLabel !== (typeof options[0] === 'string' ? options[0] : options[0].label)

  const toggle = useCallback((e) => {
    e.stopPropagation()
    setOpen(o => !o)
  }, [])

  return (
    <div className="fdrop-wrap">
      <button
        ref={btnRef}
        className={`fchip fchip--drop${isActive ? ' fchip--active' : ''}`}
        onClick={toggle}
      >
        {icon && <span className="fchip-icon">{icon}</span>}
        <span className="fchip-label">{isActive ? activeLabel : label}</span>
        <svg
          className={`fchip-caret${open ? ' fchip-caret--open' : ''}`}
          width="12" height="12" viewBox="0 0 12 12" fill="none"
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
      <DropdownMenu
        anchorRef={btnRef}
        open={open}
        onClose={() => setOpen(false)}
        options={options}
        activeLabel={activeLabel}
        onSelect={onSelect}
      />
    </div>
  )
}

/* ─── Toggle chip ──────────────────────────────────────────────────────── */
function ToggleChip({ icon, label, active, onClick }) {
  return (
    <button
      className={`fchip${active ? ' fchip--active' : ''}`}
      onClick={onClick}
    >
      {icon && <span className="fchip-icon">{icon}</span>}
      <span className="fchip-label">{label}</span>
    </button>
  )
}

/* ─── FilterBar ─────────────────────────────────────────────────────────── */
export default function FilterBar({ filters, onChange }) {
  const activeCount = [
    filters.type !== 'All Types',
    filters.price.label !== 'Any Price',
    filters.location.label !== 'All Locations',
    filters.delivery.label !== 'Any Delivery',
    filters.bua.label !== 'Any Size',
    filters.badge !== 'All',
  ].filter(Boolean).length

  const set = useCallback((patch) => onChange({ ...filters, ...patch }), [filters, onChange])

  const reset = useCallback(() => onChange(DEFAULT_FILTERS), [onChange])

  return (
    <div className="fbar">
      <div className="fbar-scroll">

        {/* ── Project type ── */}
        <div className="fbar-group">
          {['All Types', 'Residential', 'Mixed', 'Commercial'].map(t => (
            <ToggleChip
              key={t}
              icon={t === 'Residential' ? '🏠' : t === 'Mixed' ? '🏗' : t === 'Commercial' ? '🏢' : null}
              label={t}
              active={filters.type === t}
              onClick={() => set({ type: t })}
            />
          ))}
        </div>

        <div className="fbar-sep" />

        {/* ── Price ── */}
        <DropdownChip
          icon="💰"
          label="Price"
          options={PRICE_OPTIONS}
          activeLabel={filters.price.label}
          onSelect={opt => set({ price: opt })}
        />

        {/* ── Location ── */}
        <DropdownChip
          icon="📍"
          label="Location"
          options={LOCATION_OPTIONS}
          activeLabel={filters.location.label}
          onSelect={opt => set({ location: opt })}
        />

        {/* ── Delivery ── */}
        <DropdownChip
          icon="🗓"
          label="Delivery"
          options={DELIVERY_OPTIONS}
          activeLabel={filters.delivery.label}
          onSelect={opt => set({ delivery: opt })}
        />

        {/* ── Size ── */}
        <DropdownChip
          icon="📐"
          label="Size"
          options={BUA_OPTIONS}
          activeLabel={filters.bua.label}
          onSelect={opt => set({ bua: opt })}
        />

        <div className="fbar-sep" />

        {/* ── Badges ── */}
        <div className="fbar-group">
          {[
            { key: 'All',       label: 'All Badges' },
            { key: 'Trendy',    label: 'Trendy',    icon: '🔥' },
            { key: 'Incentive', label: 'Incentive', icon: '💰' },
          ].map(b => (
            <ToggleChip
              key={b.key}
              icon={b.icon}
              label={b.label}
              active={filters.badge === b.key}
              onClick={() => set({ badge: b.key })}
            />
          ))}
        </div>

      </div>

      {activeCount > 0 && (
        <button className="fbar-clear" onClick={reset}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M1 1L11 11M11 1L1 11" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
          </svg>
          Clear {activeCount}
        </button>
      )}
    </div>
  )
}

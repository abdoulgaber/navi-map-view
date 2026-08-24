import { useState, useRef, useEffect } from 'react'

export const SORT_OPTIONS = [
  { key: 'featured',   label: 'Recommended' },
  { key: 'price-asc',  label: 'Price: Low to High' },
  { key: 'price-desc', label: 'Price: High to Low' },
  { key: 'delivery',   label: 'Delivery: Soonest' },
  { key: 'bua-desc',   label: 'BUA: Largest first' },
]

export function sortProjects(list, sortKey) {
  const copy = [...list]
  switch (sortKey) {
    case 'price-asc':  return copy.sort((a, b) => a.priceValue - b.priceValue)
    case 'price-desc': return copy.sort((a, b) => b.priceValue - a.priceValue)
    case 'delivery':   return copy.sort((a, b) => a.deliveryValue - b.deliveryValue)
    case 'bua-desc':   return copy.sort((a, b) => b.buaValue - a.buaValue)
    default:           return copy
  }
}

/** Search-by-location row + Sort by + Filters, matching the NAVI hand-off */
export default function ControlsBar({
  search, onSearchChange,
  sort, onSortChange,
  filtersOpen, onToggleFilters, activeFilterCount,
}) {
  const [sortOpen, setSortOpen] = useState(false)
  const sortRef = useRef(null)

  useEffect(() => {
    const close = (e) => { if (!sortRef.current?.contains(e.target)) setSortOpen(false) }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const currentSort = SORT_OPTIONS.find(o => o.key === sort) ?? SORT_OPTIONS[0]

  return (
    <div className="controls">
      <div className="controls-search">
        <input
          type="text"
          placeholder="Search by location"
          value={search}
          onChange={e => onSearchChange(e.target.value)}
        />
        {search ? (
          <button className="controls-search-clear" onClick={() => onSearchChange('')}>✕</button>
        ) : (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path d="M17.5 17.5L13.875 13.875M15.833 9.167a6.667 6.667 0 1 1-13.333 0 6.667 6.667 0 0 1 13.333 0Z"
              stroke="#667085" strokeWidth="1.66" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        )}
      </div>

      <div className="controls-sort" ref={sortRef}>
        <button
          type="button"
          className={`controls-btn${sort !== 'featured' ? ' controls-btn--active' : ''}`}
          onClick={() => setSortOpen(o => !o)}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M5 3v10m0 0L2.5 10.5M5 13l2.5-2.5M11 13V3m0 0L8.5 5.5M11 3l2.5 2.5"
              stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          {sort === 'featured' ? 'Sort by' : currentSort.label}
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {sortOpen && (
          <div className="controls-sort-menu">
            {SORT_OPTIONS.map(opt => (
              <button
                key={opt.key}
                type="button"
                className={`controls-sort-item${sort === opt.key ? ' controls-sort-item--active' : ''}`}
                onClick={() => { onSortChange(opt.key); setSortOpen(false) }}
              >
                {opt.label}
                {sort === opt.key && (
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                    <path d="M2.5 7L5.5 10L11.5 4" stroke="#4C64FF" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        className={`controls-btn${filtersOpen || activeFilterCount > 0 ? ' controls-btn--active' : ''}`}
        onClick={onToggleFilters}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 4h12M4.5 8h7M7 12h2" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
        </svg>
        Filters
        {activeFilterCount > 0 && <span className="controls-filter-count">{activeFilterCount}</span>}
      </button>
    </div>
  )
}

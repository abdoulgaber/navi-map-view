import { useState, useRef, useEffect } from 'react'

/**
 * RadiusPanel — "client's location" tool.
 * Search a place (OSM Nominatim, Egypt-bounded) or click the map,
 * then adjust the km slider. Production note: swap Nominatim for
 * Google Places Autocomplete for stronger branch/business coverage.
 */
export default function RadiusPanel({ open, km, onKmChange, countText, onPick, onClear }) {
  const [query,   setQuery]   = useState('')
  const [results, setResults] = useState(null)   // null = closed, [] = no results
  const timer = useRef(null)

  useEffect(() => {
    const close = () => setResults(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const handleInput = (value) => {
    setQuery(value)
    clearTimeout(timer.current)
    if (value.trim().length < 3) { setResults(null); return }
    timer.current = setTimeout(async () => {
      try {
        const url = `https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=eg&q=${encodeURIComponent(value.trim())}`
        const res  = await fetch(url, { headers: { 'Accept-Language': 'ar,en' } })
        const data = await res.json()
        setResults(data)
      } catch {
        setResults([])
      }
    }, 450)
  }

  const pick = (r) => {
    setQuery(r.display_name.split(',')[0])
    setResults(null)
    onPick([parseFloat(r.lon), parseFloat(r.lat)])
  }

  if (!open) return null

  return (
    <div className="radius-panel" onClick={e => e.stopPropagation()}>
      <div className="radius-title">📍 Client's location</div>

      <div className="radius-search">
        <input
          type="text"
          placeholder="Search e.g. Vodafone Tisaeen St"
          value={query}
          onChange={e => handleInput(e.target.value)}
          autoComplete="off"
        />
        {results !== null && (
          <div className="radius-results">
            {results.length === 0 && <div className="radius-result radius-result--muted">No results</div>}
            {results.map((r, i) => (
              <div key={i} className="radius-result" onClick={() => pick(r)}>
                {r.display_name}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="radius-hint">or click directly on the map</div>

      <input
        type="range"
        min="1"
        max="30"
        value={km}
        onChange={e => onKmChange(Number(e.target.value))}
        className="radius-slider"
      />
      <div className="radius-meta">
        <span>1 km</span><span className="radius-km">{km} km</span><span>30 km</span>
      </div>

      <div className="radius-count">{countText}</div>
      <button type="button" className="radius-clear" onClick={() => { setQuery(''); onClear() }}>
        Clear radius
      </button>
    </div>
  )
}

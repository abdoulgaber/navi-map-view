import { useState, useRef, useMemo, useCallback } from 'react'
import { projects, BASE_LOCATIONS } from '../data/projects.js'
import { applyFilters } from './FilterBar.jsx'
import { haversineKm } from '../utils/geo.js'
import ProjectCard from './ProjectCard.jsx'
import ProjectDrawer from './ProjectDrawer.jsx'
import CompareBar from './CompareBar.jsx'
import CompareDrawer from './CompareDrawer.jsx'
import RadiusPanel from './RadiusPanel.jsx'
import MapCanvas from './MapCanvas.jsx'

/** Mixed-use projects appear in both categories */
const CATEGORY_MATCH = {
  Residential: (p) => p.type === 'Residential' || p.type === 'Mixed',
  Commercial:  (p) => p.type === 'Commercial'  || p.type === 'Mixed',
}

function SearchBar({ value, onChange }) {
  return (
    <div className="search-bar">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
        <path d="M16.5 16.5L12.875 12.875M14.833 8.167A6.667 6.667 0 1 1 1.5 8.167a6.667 6.667 0 0 1 13.333 0Z"
          stroke="#475467" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
      <input
        type="text"
        placeholder="Search by project, developer, or location…"
        value={value}
        onChange={e => onChange(e.target.value)}
        className="search-input"
      />
      {value && (
        <button className="search-clear" onClick={() => onChange('')}>✕</button>
      )}
    </div>
  )
}

export default function MapView({ filters, search, onSearchChange }) {
  const [category,        setCategory]        = useState('Residential')
  const [selectedProject, setSelectedProject] = useState(null)
  const [drawerProject,   setDrawerProject]   = useState(null)

  /* Radius filter tool */
  const [radiusActive, setRadiusActive] = useState(false)
  const [radiusCenter, setRadiusCenter] = useState(null)   // [lng, lat]
  const [radiusKm,     setRadiusKm]     = useState(10)

  /* Compare mode */
  const [compareMode, setCompareMode] = useState(false)
  const [compareSel,  setCompareSel]  = useState([])       // project ids
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareMax,  setCompareMax]  = useState(false)

  const listRef = useRef(null)

  /* ── filtering pipeline: filters+search → category → radius ────────── */
  const baseFiltered = useMemo(
    () => applyFilters(projects, search, filters),
    [search, filters],
  )

  const counts = useMemo(() => ({
    Residential: baseFiltered.filter(CATEGORY_MATCH.Residential).length,
    Commercial:  baseFiltered.filter(CATEGORY_MATCH.Commercial).length,
  }), [baseFiltered])

  const filtered = useMemo(() => {
    let list = baseFiltered.filter(CATEGORY_MATCH[category])
    if (radiusCenter) {
      list = list.filter(p => haversineKm(radiusCenter, [p.lng, p.lat]) <= radiusKm)
    }
    return list
  }, [baseFiltered, category, radiusCenter, radiusKm])

  const zones = useMemo(() =>
    BASE_LOCATIONS
      .map(loc => ({ ...loc, count: filtered.filter(p => p.location === loc.area).length }))
      .filter(z => z.count > 0),
    [filtered],
  )

  const compareItems = useMemo(
    () => compareSel.map(id => projects.find(p => p.id === id)).filter(Boolean),
    [compareSel],
  )

  /* ── selection & compare routing ───────────────────────────────────── */
  const toggleCompareItem = useCallback((id) => {
    setCompareSel(sel => {
      if (sel.includes(id)) return sel.filter(x => x !== id)
      if (sel.length >= 4) {
        setCompareMax(true)
        setTimeout(() => setCompareMax(false), 1500)
        return sel
      }
      return [...sel, id]
    })
  }, [])

  const handleProjectClick = useCallback((project) => {
    if (compareMode) { toggleCompareItem(project.id); return }
    setSelectedProject(project)
    setDrawerProject(project)
    listRef.current
      ?.querySelector(`[data-id="${project.id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [compareMode, toggleCompareItem])

  const handleCloseDrawer = useCallback(() => {
    setDrawerProject(null)
    setSelectedProject(null)
  }, [])

  /* ── tool toggles (mutually exclusive) ─────────────────────────────── */
  const toggleRadius = useCallback(() => {
    setRadiusActive(active => {
      const next = !active
      if (next) { setCompareMode(false); setCompareSel([]) }
      else setRadiusCenter(null)
      return next
    })
  }, [])

  const toggleCompareMode = useCallback(() => {
    setCompareMode(mode => {
      const next = !mode
      if (next) { setRadiusActive(false); setRadiusCenter(null) }
      else setCompareSel([])
      return next
    })
  }, [])

  const clearRadius = useCallback(() => setRadiusCenter(null), [])
  const widenRadius = useCallback(() => setRadiusKm(km => Math.min(30, km + 5)), [])

  const radiusEmpty = radiusActive && radiusCenter && filtered.length === 0
  const radiusCountText = radiusCenter
    ? `${filtered.length} project${filtered.length === 1 ? '' : 's'} within ${radiusKm} km (straight-line)`
    : 'Search or click the map to start'

  return (
    <div className="map-view">
      {/* Left panel */}
      <aside className="list-panel">
        <div className="list-panel-top">
          <SearchBar value={search} onChange={onSearchChange} />
          <div className="list-count">
            <strong>{filtered.length.toLocaleString()}</strong>
            {' '}{category.toLowerCase()} project{filtered.length !== 1 ? 's' : ''} found
            {radiusCenter ? ` within ${radiusKm} km` : ''}
          </div>
        </div>
        <div className="list-scroll" ref={listRef}>
          {filtered.length === 0 && (
            <div className="list-empty">
              <span>🔍</span>
              <p>No projects match your filters.</p>
              <small>Try adjusting your search, filters, or radius.</small>
            </div>
          )}
          {filtered.map(project => (
            <div key={project.id} data-id={project.id}>
              <ProjectCard
                project={project}
                active={selectedProject?.id === project.id}
                compareSelected={compareSel.includes(project.id)}
                onClick={handleProjectClick}
              />
            </div>
          ))}
        </div>
      </aside>

      {/* Map + overlays */}
      <MapCanvas
        projects={filtered}
        zones={zones}
        category={category}
        onCategoryChange={setCategory}
        counts={counts}
        selectedProject={selectedProject}
        onSelectProject={handleProjectClick}
        radiusActive={radiusActive}
        radiusCenter={radiusCenter}
        radiusKm={radiusKm}
        onRadiusCenter={setRadiusCenter}
        compareSelection={compareSel}
      >
        {/* Tools (top-left) */}
        <div className="tools-panel">
          <button
            type="button"
            className={`tool-btn${radiusActive ? ' tool-btn--active' : ''}`}
            onClick={toggleRadius}
          >📍 Radius filter</button>
          <button
            type="button"
            className={`tool-btn${compareMode ? ' tool-btn--active' : ''}`}
            onClick={toggleCompareMode}
          >⚖️ Compare</button>
        </div>

        <RadiusPanel
          open={radiusActive}
          km={radiusKm}
          onKmChange={setRadiusKm}
          countText={radiusCountText}
          onPick={setRadiusCenter}
          onClear={clearRadius}
        />

        <CompareBar
          visible={compareMode}
          items={compareItems}
          maxHit={compareMax}
          onRemove={toggleCompareItem}
          onClear={() => setCompareSel([])}
          onView={() => setCompareOpen(true)}
        />

        {radiusEmpty && (
          <div className="map-empty-state">
            <div className="map-empty-icon">🗺️</div>
            <div className="map-empty-msg">
              No projects within {radiusKm} km (straight-line).
            </div>
            <div className="map-empty-actions">
              <button type="button" className="map-empty-primary" onClick={widenRadius}>
                Widen radius +5 km
              </button>
              <button type="button" className="map-empty-secondary" onClick={clearRadius}>
                Clear radius
              </button>
            </div>
          </div>
        )}
      </MapCanvas>

      {/* Drawers */}
      {drawerProject && (
        <ProjectDrawer project={drawerProject} onClose={handleCloseDrawer} />
      )}
      {compareOpen && (
        <CompareDrawer items={compareItems} onClose={() => setCompareOpen(false)} />
      )}
    </div>
  )
}

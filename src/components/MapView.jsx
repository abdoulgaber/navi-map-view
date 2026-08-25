import { useState, useRef, useMemo, useCallback, useEffect } from 'react'
import { projects, BASE_LOCATIONS } from '../data/projects.js'
import { applyFilters } from './FilterBar.jsx'
import { sortProjects } from './ControlsBar.jsx'
import ProjectCard from './ProjectCard.jsx'
import ProjectDrawer from './ProjectDrawer.jsx'
import CompareBar from './CompareBar.jsx'
import CompareDrawer from './CompareDrawer.jsx'
import MapCanvas from './MapCanvas.jsx'

/** Mixed-use projects appear in both categories */
const CATEGORY_MATCH = {
  Residential: (p) => p.type === 'Residential' || p.type === 'Mixed',
  Commercial:  (p) => p.type === 'Commercial'  || p.type === 'Mixed',
}

/** Residential ⇄ Commercial segmented tabs (NAVI hand-off style) */
function CategoryTabs({ category, onChange, counts }) {
  return (
    <div className="ctabs">
      {['Residential', 'Commercial'].map(c => (
        <button
          key={c}
          type="button"
          className={`ctab${category === c ? ' ctab--active' : ''}`}
          onClick={() => onChange(c)}
        >
          {c}
          {c === 'Commercial' && <sup className="ctab-new">New</sup>}
          <span className="ctab-count">{counts[c]}</span>
        </button>
      ))}
    </div>
  )
}

export default function MapView({ filters, search, sort }) {
  const [category,        setCategory]        = useState('Residential')
  const [selectedProject, setSelectedProject] = useState(null)
  const [drawerProject,   setDrawerProject]   = useState(null)
  const [selectedArea,    setSelectedArea]    = useState(null)

  /* Compare mode */
  const [compareMode, setCompareMode] = useState(false)
  const [compareSel,  setCompareSel]  = useState([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareMax,  setCompareMax]  = useState(false)

  const listRef = useRef(null)

  /* The map handles 1,400+ projects fine, but rendering that many cards
     would choke the panel — reveal them as the broker scrolls. */
  const PAGE = 40
  const [visibleCount, setVisibleCount] = useState(PAGE)

  /* ── pipeline: filters+search → category → sort ────────────────────── */
  const baseFiltered = useMemo(
    () => applyFilters(projects, search, filters),
    [search, filters],
  )

  const counts = useMemo(() => ({
    Residential: baseFiltered.filter(CATEGORY_MATCH.Residential).length,
    Commercial:  baseFiltered.filter(CATEGORY_MATCH.Commercial).length,
  }), [baseFiltered])

  /* Everything in the chosen category — drives the zone badges */
  const inCategory = useMemo(
    () => sortProjects(baseFiltered.filter(CATEGORY_MATCH[category]), sort),
    [baseFiltered, category, sort],
  )

  /* Selecting an area narrows the list and the pins to it, Nawy-style */
  const filtered = useMemo(
    () => selectedArea ? inCategory.filter(p => p.location === selectedArea) : inCategory,
    [inCategory, selectedArea],
  )

  // restart paging whenever the result set changes underneath the panel
  useEffect(() => { setVisibleCount(PAGE) }, [filtered])

  const zones = useMemo(() =>
    BASE_LOCATIONS
      .map(loc => {
        const inZone = inCategory.filter(p => p.location === loc.area)
        return {
          ...loc,
          count: inZone.length,
          points: inZone.map(p => [p.lng, p.lat]),
        }
      })
      .filter(z => z.count > 0),
    [inCategory],
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

  const toggleCompareMode = useCallback(() => {
    setCompareMode(mode => {
      const next = !mode
      if (!next) setCompareSel([])
      return next
    })
  }, [])

  return (
    <div className="map-view">
      {/* Left panel */}
      <aside className="list-panel">
        <div className="list-panel-top">
          <CategoryTabs category={category} onChange={setCategory} counts={counts} />
          {selectedArea ? (
            <div className="area-pill">
              <span className="area-pill-icon">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M7 1.2c-2.1 0-3.8 1.7-3.8 3.8 0 2.8 3.8 7.8 3.8 7.8s3.8-5 3.8-7.8c0-2.1-1.7-3.8-3.8-3.8Z"
                    stroke="currentColor" strokeWidth="1.3" strokeLinejoin="round"/>
                  <circle cx="7" cy="5" r="1.4" fill="currentColor"/>
                </svg>
              </span>
              <span className="area-pill-body">
                <strong>{selectedArea}</strong>
                <small>{filtered.length} project{filtered.length !== 1 ? 's' : ''} within this area</small>
              </span>
              <button type="button" className="area-pill-clear" onClick={() => setSelectedArea(null)}>
                unselect area
              </button>
            </div>
          ) : (
            <div className="list-count">
              <strong>{filtered.length.toLocaleString()}</strong>
              {' '}{category.toLowerCase()} project{filtered.length !== 1 ? 's' : ''} found
              <span className="list-hint"> · tap an area on the map to focus it</span>
            </div>
          )}
        </div>
        <div
          className="list-scroll"
          ref={listRef}
          onScroll={(e) => {
            const el = e.currentTarget
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 240) {
              setVisibleCount(c => Math.min(c + PAGE, filtered.length))
            }
          }}
        >
          {filtered.length === 0 && (
            <div className="list-empty">
              <span>🔍</span>
              <p>No projects match your filters.</p>
              <small>Try adjusting your search or clearing some filters.</small>
            </div>
          )}
          {filtered.slice(0, visibleCount).map(project => (
            <div key={project.id} data-id={project.id} className="pcard-slot">
              <ProjectCard
                project={project}
                active={selectedProject?.id === project.id}
                compareSelected={compareSel.includes(project.id)}
                onClick={handleProjectClick}
              />
            </div>
          ))}
          {visibleCount < filtered.length && (
            <div className="list-more">
              Showing {visibleCount} of {filtered.length.toLocaleString()} — scroll for more
            </div>
          )}
        </div>
      </aside>

      {/* Map + overlays */}
      <MapCanvas
        projects={filtered}
        zones={zones}
        selectedProject={selectedProject}
        onSelectProject={handleProjectClick}
        selectedArea={selectedArea}
        onSelectArea={setSelectedArea}
        compareSelection={compareSel}
      >
        {/* Compare — NAVI hand-off button: white when idle, blue with a
            count and a dismiss when the mode is on */}
        <div className="tools-panel">
          <button
            type="button"
            className={`compare-btn${compareMode ? ' compare-btn--on' : ''}`}
            onClick={toggleCompareMode}
          >
            Compare{compareMode && compareSel.length > 0 ? ` (${compareSel.length})` : ''}
            {compareMode && (
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
                <path d="M14.5 5.5l-9 9M5.5 5.5l9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              </svg>
            )}
          </button>
        </div>

        <CompareBar
          visible={compareMode}
          items={compareItems}
          maxHit={compareMax}
          onRemove={toggleCompareItem}
          onClear={() => setCompareSel([])}
          onView={() => setCompareOpen(true)}
        />
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

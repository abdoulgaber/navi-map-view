import { useState, useRef, useMemo, useCallback } from 'react'
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

  /* Compare mode */
  const [compareMode, setCompareMode] = useState(false)
  const [compareSel,  setCompareSel]  = useState([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [compareMax,  setCompareMax]  = useState(false)

  const listRef = useRef(null)

  /* ── pipeline: filters+search → category → sort ────────────────────── */
  const baseFiltered = useMemo(
    () => applyFilters(projects, search, filters),
    [search, filters],
  )

  const counts = useMemo(() => ({
    Residential: baseFiltered.filter(CATEGORY_MATCH.Residential).length,
    Commercial:  baseFiltered.filter(CATEGORY_MATCH.Commercial).length,
  }), [baseFiltered])

  const filtered = useMemo(
    () => sortProjects(baseFiltered.filter(CATEGORY_MATCH[category]), sort),
    [baseFiltered, category, sort],
  )

  const zones = useMemo(() =>
    BASE_LOCATIONS
      .map(loc => {
        const inZone = filtered.filter(p => p.location === loc.area)
        return {
          ...loc,
          count: inZone.length,
          points: inZone.map(p => [p.lng, p.lat]),
        }
      })
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
          <div className="list-count">
            <strong>{filtered.length.toLocaleString()}</strong>
            {' '}{category.toLowerCase()} project{filtered.length !== 1 ? 's' : ''} found
          </div>
        </div>
        <div className="list-scroll" ref={listRef}>
          {filtered.length === 0 && (
            <div className="list-empty">
              <span>🔍</span>
              <p>No projects match your filters.</p>
              <small>Try adjusting your search or clearing some filters.</small>
            </div>
          )}
          {filtered.map(project => (
            <div key={project.id} data-id={project.id} className="pcard-slot">
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
        selectedProject={selectedProject}
        onSelectProject={handleProjectClick}
        compareSelection={compareSel}
      >
        <div className="tools-panel">
          <button
            type="button"
            className={`tool-btn${compareMode ? ' tool-btn--active' : ''}`}
            onClick={toggleCompareMode}
          >⚖️ Compare</button>
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

import { useState, useRef, useMemo, useCallback } from 'react'
import { projects, BASE_LOCATIONS } from '../data/projects.js'
import { applyFilters } from './FilterBar.jsx'
import ProjectCard from './ProjectCard.jsx'
import ProjectDrawer from './ProjectDrawer.jsx'
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
  const listRef = useRef(null)

  /* Filters + search, before the category swiper */
  const baseFiltered = useMemo(
    () => applyFilters(projects, search, filters),
    [search, filters],
  )

  /* Counts shown on the swiper */
  const counts = useMemo(() => ({
    Residential: baseFiltered.filter(CATEGORY_MATCH.Residential).length,
    Commercial:  baseFiltered.filter(CATEGORY_MATCH.Commercial).length,
  }), [baseFiltered])

  /* What the list + map actually show */
  const filtered = useMemo(
    () => baseFiltered.filter(CATEGORY_MATCH[category]),
    [baseFiltered, category],
  )

  /* Zone badge data: area + count of currently visible projects */
  const zones = useMemo(() =>
    BASE_LOCATIONS
      .map(loc => ({ ...loc, count: filtered.filter(p => p.location === loc.area).length }))
      .filter(z => z.count > 0),
    [filtered],
  )

  const handleSelect = useCallback((project) => {
    setSelectedProject(project)
    setDrawerProject(project)
    listRef.current
      ?.querySelector(`[data-id="${project.id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [])

  const handleCloseDrawer = useCallback(() => {
    setDrawerProject(null)
    setSelectedProject(null)
  }, [])

  return (
    <div className="map-view">
      {/* Left panel */}
      <aside className="list-panel">
        <div className="list-panel-top">
          <SearchBar value={search} onChange={onSearchChange} />
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
            <div key={project.id} data-id={project.id}>
              <ProjectCard
                project={project}
                active={selectedProject?.id === project.id}
                onClick={handleSelect}
              />
            </div>
          ))}
        </div>
      </aside>

      {/* Map */}
      <MapCanvas
        projects={filtered}
        zones={zones}
        category={category}
        onCategoryChange={setCategory}
        counts={counts}
        selectedProject={selectedProject}
        onSelectProject={handleSelect}
      />

      {/* Drawer */}
      {drawerProject && (
        <ProjectDrawer project={drawerProject} onClose={handleCloseDrawer} />
      )}
    </div>
  )
}

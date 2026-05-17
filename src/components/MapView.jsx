import { useState, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, useMap } from 'react-leaflet'
import MarkerClusterGroup from 'react-leaflet-cluster'
import L from 'leaflet'
import { projects } from '../data/projects.js'
import { applyFilters } from './FilterBar.jsx'
import ProjectCard from './ProjectCard.jsx'
import ProjectDrawer from './ProjectDrawer.jsx'

// Fix Leaflet broken icon paths in Vite
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const TYPE_COLORS = {
  Residential: '#4C64FF',
  Mixed:       '#7C3AED',
  Commercial:  '#B45309',
}

const createProjectIcon = (project, active) =>
  L.divIcon({
    html: `<div class="map-marker${active ? ' map-marker--active' : ''}" style="background:${active ? '#101828' : (TYPE_COLORS[project.type] || '#4C64FF')}"></div>`,
    className: '',
    iconSize:   [28, 28],
    iconAnchor: [14, 14],
  })

const createClusterIcon = (cluster) =>
  L.divIcon({
    html: `<div class="map-cluster"><span>${cluster.getChildCount()}</span></div>`,
    className: '',
    iconSize:   [44, 44],
    iconAnchor: [22, 22],
  })

function MapFlyTo({ project }) {
  const map = useMap()
  if (project) map.flyTo([project.lat, project.lng], 14, { duration: 1 })
  return null
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
  const [selectedProject, setSelectedProject] = useState(null)
  const [drawerProject,   setDrawerProject]   = useState(null)
  const listRef = useRef(null)

  const filtered = applyFilters(projects, search, filters)

  const handleCardClick = useCallback((project) => {
    setSelectedProject(project)
    setDrawerProject(project)
  }, [])

  const handleMarkerClick = useCallback((project) => {
    setSelectedProject(project)
    setDrawerProject(project)
    if (listRef.current) {
      const card = listRef.current.querySelector(`[data-id="${project.id}"]`)
      card?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
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
            {' '}project{filtered.length !== 1 ? 's' : ''} found
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
                onClick={handleCardClick}
              />
            </div>
          ))}
        </div>
      </aside>

      {/* Map */}
      <div className="map-container">
        <MapContainer
          center={[28.5, 30.0]}
          zoom={6}
          style={{ width: '100%', height: '100%' }}
          zoomControl={false}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            maxZoom={19}
          />

          <MarkerClusterGroup
            chunkedLoading
            iconCreateFunction={createClusterIcon}
            maxClusterRadius={55}
            showCoverageOnHover={false}
            spiderfyOnMaxZoom
          >
            {filtered.map(project => (
              <Marker
                key={project.id}
                position={[project.lat, project.lng]}
                icon={createProjectIcon(project, selectedProject?.id === project.id)}
                eventHandlers={{ click: () => handleMarkerClick(project) }}
              />
            ))}
          </MarkerClusterGroup>

          {selectedProject && <MapFlyTo project={selectedProject} />}
        </MapContainer>

        {/* Map legend */}
        <div className="map-legend">
          <span className="map-legend-item" style={{ '--dot': '#4C64FF' }}>Residential</span>
          <span className="map-legend-item" style={{ '--dot': '#7C3AED' }}>Mixed</span>
          <span className="map-legend-item" style={{ '--dot': '#B45309' }}>Commercial</span>
        </div>
      </div>

      {/* Drawer */}
      {drawerProject && (
        <ProjectDrawer project={drawerProject} onClose={handleCloseDrawer} />
      )}
    </div>
  )
}

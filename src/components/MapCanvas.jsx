import { useEffect, useRef, useState } from 'react'
import { Map as MapGL, Marker, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

/**
 * MapCanvas — MapLibre GL map with:
 *  - Google-Earth-style globe intro that flies into Egypt on first load
 *  - Zone badges (area name + project count) at country zoom
 *  - Airbnb-style price-pill pins per project at city zoom
 *  - Hover card (name / developer / starting price) on each pin
 */

const MAP_STYLE  = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
const EGYPT_VIEW = { center: [29.9, 26.9], zoom: 5.55 }
const GLOBE_VIEW = { center: [8, 15], zoom: 1.4 }
const PIN_ZOOM   = 8.3          // below → zone badges, above → project pins
const ZONE_ZOOM  = 10.8         // zoom level when clicking a zone badge

const shortPrice = (v) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(v % 1_000_000 >= 100_000 ? 1 : 0)}M`
    : `${Math.round(v / 1_000)}K`

const hoverCardHTML = (p) => `
  <div class="pin-card">
    <div class="pin-card-img">${p.type === 'Commercial' ? '🏢' : '🏙'}</div>
    <div class="pin-card-body">
      <strong>${p.name}</strong>
      <span>${p.developer}</span>
      <em>From ${p.price}</em>
    </div>
  </div>`

export default function MapCanvas({
  projects,
  zones,
  category,
  onCategoryChange,
  counts,
  selectedProject,
  onSelectProject,
}) {
  const containerRef  = useRef(null)
  const mapRef        = useRef(null)
  const zoneMarkers   = useRef([])
  const pinMarkers    = useRef(new Map())   // project.id → Marker
  const popupRef      = useRef(null)
  const projectsRef   = useRef(projects)
  const zonesRef      = useRef(zones)
  const selectedRef   = useRef(null)
  const callbacksRef  = useRef({ onSelectProject })
  const [mapReady, setMapReady] = useState(false)
  const [introDone, setIntroDone] = useState(false)

  projectsRef.current  = projects
  zonesRef.current     = zones
  selectedRef.current  = selectedProject
  callbacksRef.current = { onSelectProject }

  /* ── init map once ─────────────────────────────────────────────────── */
  useEffect(() => {
    const map = new MapGL({
      container: containerRef.current,
      style: MAP_STYLE,
      center: GLOBE_VIEW.center,
      zoom: GLOBE_VIEW.zoom,
      attributionControl: { compact: true },
    })
    mapRef.current = map

    map.on('style.load', () => {
      // Globe projection for the Google-Earth intro (MapLibre v5+)
      try { map.setProjection({ type: 'globe' }) } catch { /* raster fallback */ }
    })

    map.on('load', () => {
      setMapReady(true)
      // Cinematic sweep: globe → Egypt
      setTimeout(() => {
        map.flyTo({
          ...EGYPT_VIEW,
          duration: 4800,
          curve: 1.35,
          essential: true,
        })
        map.once('moveend', () => setIntroDone(true))
      }, 700)
    })

    map.on('zoom',    () => syncLayers())
    map.on('moveend', () => syncLayers())

    return () => {
      popupRef.current?.remove()
      map.remove()
      mapRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /* ── show zone badges or pins depending on zoom ────────────────────── */
  const syncLayers = () => {
    const map = mapRef.current
    if (!map) return
    const showPins = map.getZoom() >= PIN_ZOOM

    zoneMarkers.current.forEach(m => {
      m.getElement().style.display = showPins ? 'none' : 'flex'
    })

    if (!showPins) {
      pinMarkers.current.forEach(m => m.remove())
      pinMarkers.current.clear()
      popupRef.current?.remove()
      return
    }

    // Only mount pins inside the viewport (keeps DOM light with 500+ projects)
    const bounds = map.getBounds()
    const visible = new Set()
    for (const p of projectsRef.current) {
      if (!bounds.contains([p.lng, p.lat])) continue
      visible.add(p.id)
      if (!pinMarkers.current.has(p.id)) {
        pinMarkers.current.set(p.id, buildPin(p, map))
      }
    }
    pinMarkers.current.forEach((marker, id) => {
      if (!visible.has(id)) {
        marker.remove()
        pinMarkers.current.delete(id)
      }
    })
  }

  const buildPin = (project, map) => {
    const el = document.createElement('button')
    el.className = 'price-pin'
    el.type = 'button'
    el.textContent = `EGP ${shortPrice(project.priceValue)}`
    if (selectedRef.current?.id === project.id) el.classList.add('price-pin--selected')

    el.addEventListener('mouseenter', () => {
      popupRef.current?.remove()
      popupRef.current = new Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 16,
        maxWidth: 'none',
        className: 'pin-popup',
      })
        .setLngLat([project.lng, project.lat])
        .setHTML(hoverCardHTML(project))
        .addTo(map)
    })
    el.addEventListener('mouseleave', () => popupRef.current?.remove())
    el.addEventListener('click', (e) => {
      e.stopPropagation()
      callbacksRef.current.onSelectProject(project)
    })

    return new Marker({ element: el }).setLngLat([project.lng, project.lat]).addTo(map)
  }

  /* ── zone badges (rebuild when zones/category change) ──────────────── */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    zoneMarkers.current.forEach(m => m.remove())
    zoneMarkers.current = []

    for (const zone of zones) {
      const el = document.createElement('button')
      el.className = 'zone-badge'
      el.type = 'button'
      el.innerHTML = `<strong>${zone.count}</strong><span>${zone.area}</span>`
      el.addEventListener('click', () => {
        map.flyTo({ center: [zone.lng, zone.lat], zoom: ZONE_ZOOM, duration: 2200, essential: true })
      })
      zoneMarkers.current.push(
        new Marker({ element: el }).setLngLat([zone.lng, zone.lat]).addTo(map)
      )
    }
    syncLayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, mapReady])

  /* ── refresh pins when the filtered project set changes ────────────── */
  useEffect(() => {
    if (!mapReady) return
    pinMarkers.current.forEach(m => m.remove())
    pinMarkers.current.clear()
    popupRef.current?.remove()
    syncLayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, mapReady])

  /* ── highlight + fly to the selected project ───────────────────────── */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !selectedProject) return
    map.flyTo({
      center: [selectedProject.lng, selectedProject.lat],
      zoom: Math.max(map.getZoom(), 13.5),
      duration: 1400,
      essential: true,
    })
    pinMarkers.current.forEach((marker, id) => {
      marker.getElement().classList.toggle('price-pin--selected', id === selectedProject.id)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, mapReady])

  return (
    <div className="map-canvas">
      <div ref={containerRef} className="map-canvas-gl" />

      {/* Residential ⇄ Commercial swiper */}
      <div className={`map-toggle${introDone ? ' map-toggle--visible' : ''}`}>
        {['Residential', 'Commercial'].map(c => (
          <button
            key={c}
            type="button"
            className={`map-toggle-btn${category === c ? ' map-toggle-btn--active' : ''}`}
            onClick={() => onCategoryChange(c)}
          >
            {c === 'Residential' ? '🏠' : '🏢'} {c}
            <span className="map-toggle-count">{counts[c]}</span>
          </button>
        ))}
        <span
          className="map-toggle-thumb"
          style={{ transform: `translateX(${category === 'Commercial' ? '100%' : '0'})` }}
        />
      </div>
    </div>
  )
}

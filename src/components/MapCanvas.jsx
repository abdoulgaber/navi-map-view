import { useEffect, useRef, useState } from 'react'
import { Map as MapGL, Marker, Popup } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { zoneAreaFeature } from '../utils/geo.js'

/**
 * MapCanvas — MapLibre GL map with:
 *  - Globe intro flying into Egypt on first load
 *  - Highlighted zone areas + count badges at country zoom
 *  - Airbnb-style pin decluttering at city zoom: price pills are placed
 *    by screen-space collision with a breathing threshold; pins that
 *    don't fit render as small dots and promote back to pills on zoom-in
 *  - Hover card per pin/dot, Map/Satellite toggle, compare highlighting
 */

const MAP_STYLE  = 'https://basemaps.cartocdn.com/gl/voyager-gl-style/style.json'
const SAT_STYLE = {
  version: 8,
  sources: {
    esri: {
      type: 'raster',
      tiles: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
      tileSize: 256,
      attribution: 'Tiles © Esri',
      maxzoom: 19,
    },
  },
  layers: [{ id: 'esri', type: 'raster', source: 'esri' }],
}
const EGYPT_VIEW  = { center: [29.9, 26.9], zoom: 5.55 }
const GLOBE_VIEW  = { center: [8, 15], zoom: 1.4 }
const PIN_ZOOM    = 8.3
const ZONE_ZOOM   = 10.8
const INTRO_MS    = 3200

/* The floating list panel covers the left edge — keep camera targets centered
   in the visible part of the map */
const MAP_PADDING = { left: 448, top: 0, right: 0, bottom: 0 }

/* ── pin declutter tuning ─────────────────────────────────────────────── */
const PILL_H     = 30   // rendered pill height (px)
const PILL_GAP   = 8    // breathing room between pills (px)
const estimatePillW = (label) => label.length * 7.4 + 26

const ZONES_SRC = 'zones-src'

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

function drawZoneAreas(map, zones) {
  const data = { type: 'FeatureCollection', features: zones.map(zoneAreaFeature) }
  const src = map.getSource(ZONES_SRC)
  if (src) { src.setData(data); return }
  map.addSource(ZONES_SRC, { type: 'geojson', data })
  map.addLayer({
    id: 'zone-fill',
    type: 'fill',
    source: ZONES_SRC,
    paint: {
      'fill-color': '#4C64FF',
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.16, 7.5, 0.22, 10, 0.16, 12, 0],
    },
  })
  map.addLayer({
    id: 'zone-line',
    type: 'line',
    source: ZONES_SRC,
    paint: {
      'line-color': '#4C64FF',
      'line-width': 2,
      'line-dasharray': [2, 2],
      'line-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.55, 10, 0.5, 12, 0],
    },
  })
}

export default function MapCanvas({
  projects,
  zones,
  selectedProject,
  onSelectProject,
  compareSelection,
  children,
}) {
  const containerRef  = useRef(null)
  const mapRef        = useRef(null)
  const zoneMarkers   = useRef([])
  const pinMarkers    = useRef(new Map())   // project.id → { marker, el, mode }
  const popupRef      = useRef(null)
  const projectsRef   = useRef(projects)
  const zonesRef      = useRef(zones)
  const selectedRef   = useRef(null)
  const compareRef    = useRef(compareSelection)
  const callbacksRef  = useRef({ onSelectProject })
  const [mapReady, setMapReady]   = useState(false)
  const [introDone, setIntroDone] = useState(false)
  const [mapType, setMapType]     = useState('map')

  projectsRef.current  = projects
  zonesRef.current     = zones
  selectedRef.current  = selectedProject
  compareRef.current   = compareSelection
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
      try { map.setProjection({ type: 'globe' }) } catch { /* raster fallback */ }
      drawZoneAreas(map, zonesRef.current)
    })

    map.on('load', () => {
      setMapReady(true)
      setTimeout(() => {
        map.flyTo({ ...EGYPT_VIEW, padding: MAP_PADDING, duration: INTRO_MS, curve: 1.32, essential: true })
        map.once('moveend', () => setIntroDone(true))
      }, 400)
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

  /* ── Map / Satellite style switch ──────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    map.setStyle(mapType === 'sat' ? SAT_STYLE : MAP_STYLE)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapType])

  /* ── declutter pass: pills where they fit, dots where they don't ───── */
  const syncLayers = () => {
    const map = mapRef.current
    if (!map) return
    const showPins = map.getZoom() >= PIN_ZOOM

    zoneMarkers.current.forEach(m => {
      m.getElement().style.display = showPins ? 'none' : 'flex'
    })

    if (!showPins) {
      pinMarkers.current.forEach(entry => entry.marker.remove())
      pinMarkers.current.clear()
      popupRef.current?.remove()
      return
    }

    const bounds = map.getBounds()

    // Priority: selected project first, then the list's current sort order
    const inView = []
    for (const p of projectsRef.current) {
      if (bounds.contains([p.lng, p.lat])) inView.push(p)
    }
    const selId = selectedRef.current?.id
    if (selId) {
      const i = inView.findIndex(p => p.id === selId)
      if (i > 0) inView.unshift(inView.splice(i, 1)[0])
    }

    // Greedy screen-space placement with breathing threshold
    const placed  = []
    const visible = new Set()
    for (const p of inView) {
      visible.add(p.id)
      const pt    = map.project([p.lng, p.lat])
      const label = `EGP ${shortPrice(p.priceValue)}`
      const w = estimatePillW(label) + PILL_GAP
      const h = PILL_H + PILL_GAP
      const rect = { x1: pt.x - w / 2, y1: pt.y - h / 2, x2: pt.x + w / 2, y2: pt.y + h / 2 }
      const collides = placed.some(r =>
        rect.x1 < r.x2 && rect.x2 > r.x1 && rect.y1 < r.y2 && rect.y2 > r.y1
      )
      if (!collides) placed.push(rect)
      ensurePin(p, map, collides ? 'dot' : 'pill', label)
    }

    pinMarkers.current.forEach((entry, id) => {
      if (!visible.has(id)) {
        entry.marker.remove()
        pinMarkers.current.delete(id)
      }
    })
  }

  const ensurePin = (project, map, mode, label) => {
    let entry = pinMarkers.current.get(project.id)

    if (!entry) {
      const el = document.createElement('button')
      el.type = 'button'
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
      const marker = new Marker({ element: el }).setLngLat([project.lng, project.lat]).addTo(map)
      entry = { marker, el, mode: null }
      pinMarkers.current.set(project.id, entry)
    }

    if (entry.mode !== mode) {
      entry.mode = mode
      entry.el.className   = mode === 'pill' ? 'price-pin' : 'dot-pin'
      entry.el.textContent = mode === 'pill' ? label : ''
      entry.el.setAttribute('aria-label', label)
    }

    entry.el.classList.toggle('price-pin--selected', selectedRef.current?.id === project.id)
    entry.el.classList.toggle('price-pin--compare', compareRef.current?.includes(project.id))
  }

  /* ── zone areas + badges ───────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (map.isStyleLoaded()) drawZoneAreas(map, zones)

    zoneMarkers.current.forEach(m => m.remove())
    zoneMarkers.current = []

    for (const zone of zones) {
      const el = document.createElement('button')
      el.className = 'zone-badge'
      el.type = 'button'
      el.innerHTML = `<strong>${zone.count}</strong><span>${zone.area}</span>`
      el.addEventListener('click', () => {
        map.flyTo({ center: [zone.lng, zone.lat], zoom: ZONE_ZOOM, padding: MAP_PADDING, duration: 2000, essential: true })
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
    pinMarkers.current.forEach(entry => entry.marker.remove())
    pinMarkers.current.clear()
    popupRef.current?.remove()
    syncLayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, mapReady])

  /* ── selected project: fly + re-run declutter so it wins a pill ────── */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !selectedProject) return
    map.flyTo({
      center: [selectedProject.lng, selectedProject.lat],
      zoom: Math.max(map.getZoom(), 13.5),
      padding: MAP_PADDING,
      duration: 1400,
      essential: true,
    })
    syncLayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProject, mapReady])

  /* ── compare selection: re-run sync so pin classes stay accurate ───── */
  useEffect(() => {
    if (mapReady) syncLayers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [compareSelection, mapReady])

  return (
    <div className="map-canvas">
      <div ref={containerRef} className="map-canvas-gl" />

      {/* Map / Satellite toggle */}
      <div className={`style-toggle${introDone ? ' style-toggle--visible' : ''}`}>
        <button
          type="button"
          className={`style-toggle-btn${mapType === 'map' ? ' style-toggle-btn--active' : ''}`}
          onClick={() => setMapType('map')}
        >🗺️ Map</button>
        <button
          type="button"
          className={`style-toggle-btn${mapType === 'sat' ? ' style-toggle-btn--active' : ''}`}
          onClick={() => setMapType('sat')}
        >🛰️ Satellite</button>
      </div>

      {children}
    </div>
  )
}

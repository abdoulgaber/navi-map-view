import { useEffect, useRef, useState } from 'react'
import { Map as MapGL, Marker, Popup, setWorkerUrl } from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
// MapLibre v6 resolves its worker at runtime via a template literal
// (`new URL(\`./${name}\`, import.meta.url)`), which bundlers cannot see —
// so the worker is never emitted and 404s in production, leaving a blank
// map (no vector tiles, no GeoJSON). Hand it the URL Vite actually built.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import { computePlacements, repairOverlaps } from '../utils/placement.js'
import { getAreaBoundary, boundsOfPoints, boundaryFeatures } from '../utils/boundaries.js'

/**
 * MapCanvas — MapLibre GL map with:
 *  - Globe intro flying into Egypt on first load
 *  - Highlighted zone areas + count badges at country zoom
 *  - Airbnb-style pin decluttering at city zoom: price pills are placed
 *    by screen-space collision with a breathing threshold; pins that
 *    don't fit render as small dots and promote back to pills on zoom-in
 *  - Hover card per pin/dot, Map/Satellite toggle, compare highlighting
 */

setWorkerUrl(maplibreWorkerUrl)

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

/* The floating list panel covers the left edge — nudge camera targets into
   the visible half of the map. NOTE: use `offset` (screen px), never
   `padding`: camera padding under globe projection yields a broken
   transform, which freezes the camera and leaves the map unpainted. */
const PANEL_OFFSET = [224, 0]

const ZONES_SRC = 'zones-src'
const AREA_SRC  = 'area-src'

/* Fit padding — the floating list panel covers the left edge */
const FIT_PADDING = { left: 460, top: 70, right: 60, bottom: 90 }

function drawSelectedArea(map, geojson) {
  const data = { type: 'Feature', properties: {}, geometry: geojson }
  const src = map.getSource(AREA_SRC)
  if (src) { src.setData(data); return }
  map.addSource(AREA_SRC, { type: 'geojson', data })
  map.addLayer({
    id: 'area-fill',
    type: 'fill',
    source: AREA_SRC,
    paint: { 'fill-color': '#4C64FF', 'fill-opacity': 0.12 },
  })
  map.addLayer({
    id: 'area-line',
    type: 'line',
    source: AREA_SRC,
    paint: { 'line-color': '#4C64FF', 'line-width': 2.5, 'line-opacity': 0.9 },
  })
}

function clearSelectedArea(map) {
  if (map.getLayer('area-line')) map.removeLayer('area-line')
  if (map.getLayer('area-fill')) map.removeLayer('area-fill')
  if (map.getSource(AREA_SRC)) map.removeSource(AREA_SRC)
}

const shortPrice = (v) =>
  v >= 1_000_000
    ? `${(v / 1_000_000).toFixed(v % 1_000_000 >= 100_000 ? 1 : 0)}M`
    : `${Math.round(v / 1_000)}K`

/* Chips carry the project NAME — brokers recognise projects by name, and
   the exact price is one hover away on the quick-view card. Long names are
   clipped so a single chip can never hog the viewport. */
/* Neighbours closer than this on screen become one bubble */
const CLUSTER_PX = 78
const clusterSize = (n) => (n < 10 ? 38 : n < 50 ? 46 : n < 200 ? 54 : 62)

const MAX_LABEL = 20
const pinLabel = (p) =>
  p.name.length > MAX_LABEL ? `${p.name.slice(0, MAX_LABEL - 1).trimEnd()}…` : p.name

const hoverCardHTML = (p) => `
  <div class="pin-card">
    <div class="pin-card-img">${p.type === 'Commercial' ? '🏢' : '🏙'}</div>
    <div class="pin-card-body">
      <strong>${p.name}</strong>
      <span>${p.developer}</span>
      <em>From ${p.price}</em>
    </div>
  </div>`

/* Real administrative borders for every area OSM has one for. Areas
   without an official polygon are intentionally left unshaded. */
function drawZoneAreas(map, zones) {
  const data = boundaryFeatures(zones.map(z => z.area))
  const src = map.getSource(ZONES_SRC)
  if (src) { src.setData(data); return }
  map.addSource(ZONES_SRC, { type: 'geojson', data })
  map.addLayer({
    id: 'zone-fill',
    type: 'fill',
    source: ZONES_SRC,
    paint: {
      'fill-color': '#4C64FF',
      'fill-opacity': ['interpolate', ['linear'], ['zoom'], 5, 0.10, 8, 0.14, 12, 0.08, 14, 0.04],
    },
  })
  map.addLayer({
    id: 'zone-line',
    type: 'line',
    source: ZONES_SRC,
    paint: {
      'line-color': '#4C64FF',
      'line-width': ['interpolate', ['linear'], ['zoom'], 5, 1, 10, 1.5, 14, 2],
      'line-opacity': 0.55,
    },
  })
}

export default function MapCanvas({
  projects,
  zones,
  selectedProject,
  onSelectProject,
  selectedArea,
  onSelectArea,
  compareSelection,
  children,
}) {
  const containerRef  = useRef(null)
  const mapRef        = useRef(null)
  const zoneMarkers   = useRef([])
  const pinMarkers     = useRef(new Map())  // project.id → { marker, el, mode }
  const clusterMarkers = useRef(new Map())  // cell key   → { marker, el, count }
  const popupRef      = useRef(null)
  const projectsRef   = useRef(projects)
  const zonesRef      = useRef(zones)
  const selectedRef   = useRef(null)
  const compareRef    = useRef(compareSelection)
  const callbacksRef  = useRef({ onSelectProject })
  const hiddenRef       = useRef(0)
  const orderRef        = useRef([])
  const boundaryRef     = useRef(null)   // focused area's border geometry
  const selectedAreaRef = useRef(null)
  const styleReadyRef   = useRef(false)  // set by the style.load event
  const pendingDrawRef  = useRef([])
  const watchdogRef     = useRef(null)
  const introDoneRef    = useRef(false)
  const cameraIntentRef = useRef(null)   // last camera we asked for
  const hadSizeRef      = useRef(false)

  /* MapLibre silently ignores camera commands while its container has no
     size (hidden tab, collapsed panel, a pane that opens at 0×0). Remember
     what we last asked for so it can be applied the moment size arrives —
     otherwise the map stays frozen on its initial view forever. */
  const setCamera = (map, intent) => {
    cameraIntentRef.current = intent
    const { clientWidth: w, clientHeight: h } = map.getContainer()
    if (!w || !h) return                       // dropped — replayed on resize
    if (intent.kind === 'fit') map.fitBounds(intent.bounds, intent.opts)
    else                      map.flyTo(intent.opts)
  }

  /* The intro watchdog rescues a stalled globe, but it must never fight the
     broker: a finished intro — or any navigation they trigger — retires it. */
  const disarmWatchdog = () => {
    introDoneRef.current = true
    clearTimeout(watchdogRef.current)
  }

  /* Sources/layers may only be added once the style has loaded. Track that
     with the style.load EVENT — never with isStyleLoaded(), which stays
     false whenever tiles cannot finish (offline, blocked worker, slow
     network) and would silently suppress our layers forever. */
  const whenStyleReady = (fn) => {
    if (styleReadyRef.current) { fn(); return }
    pendingDrawRef.current.push(fn)
  }
  const [mapReady, setMapReady]       = useState(false)
  const [introDone, setIntroDone]     = useState(false)
  const [mapType, setMapType]         = useState('map')
  const [hiddenCount, setHiddenCount] = useState(0)

  projectsRef.current  = projects
  zonesRef.current     = zones
  selectedRef.current  = selectedProject
  compareRef.current   = compareSelection
  callbacksRef.current   = { onSelectProject, onSelectArea }
  selectedAreaRef.current = selectedArea

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
    // Support handles: inspect layers/camera and the pending camera intent
    // on a live deployment when diagnosing a stuck view.
    if (typeof window !== 'undefined') {
      window.__naviMap = map
      window.__naviDebug = {
        intent:  () => cameraIntentRef.current,
        hadSize: () => hadSizeRef.current,
        clusters: () => clusterMarkers.current.size,
      }
    }

    /* Markers/layers only need the STYLE, not every tile — gating on 'load'
       would leave the map empty whenever tiles are slow to arrive. */
    let started = false
    const start = () => {
      if (started) return
      started = true
      setMapReady(true)
      setTimeout(() => {
        setCamera(map, { kind: 'fly', opts: { ...EGYPT_VIEW, offset: PANEL_OFFSET, duration: INTRO_MS, curve: 1.32, essential: true } })
        map.once('moveend', () => {
          /* Globe is only for the cinematic entry. Everything after it —
             tiles, zone fills, hours of broker panning — runs on mercator,
             which is the widely-supported path on every GPU/driver. */
          try { map.setProjection({ type: 'mercator' }) } catch { /* ignore */ }
          disarmWatchdog()
          setIntroDone(true)
          syncLayers()
        })
        // never leave the UI chrome hidden — or the map stuck on globe —
        // if the camera event is missed
        setTimeout(() => {
          try { map.setProjection({ type: 'mercator' }) } catch { /* ignore */ }
          disarmWatchdog()
          setIntroDone(true)
        }, INTRO_MS + 1500)
      }, 400)

      /* Watchdog — if the camera never reaches Egypt (globe transform can
         stall on some GPUs/drivers), drop to mercator and show Egypt
         directly rather than leaving the broker on a blank sphere.
         It must never fight the broker: any completed intro or user
         navigation disarms it (see disarmWatchdog). */
      watchdogRef.current = setTimeout(() => {
        if (!mapRef.current || introDoneRef.current) return
        if (Math.abs(map.getZoom() - EGYPT_VIEW.zoom) > 1) {
          try { map.setProjection({ type: 'mercator' }) } catch { /* ignore */ }
          map.jumpTo({ ...EGYPT_VIEW })
          setIntroDone(true)
          syncLayers()
        }
      }, INTRO_MS + 2600)
    }

    map.on('style.load', () => {
      try { map.setProjection({ type: 'globe' }) } catch { /* raster fallback */ }
      styleReadyRef.current = true
      drawZoneAreas(map, zonesRef.current.filter(z => z.area !== selectedAreaRef.current))
      // setStyle() wipes sources — restore the focused area's border
      if (boundaryRef.current) drawSelectedArea(map, boundaryRef.current)
      // flush anything that asked to draw before the style was ready
      const pending = pendingDrawRef.current
      pendingDrawRef.current = []
      pending.forEach(fn => fn())
      start()
    })
    map.on('load', start)
    const startFallback = setTimeout(start, 5000)

    // Sync continuously while moving (rAF-throttled) so pins populate
    // during pans/zooms, plus a final pass when the camera settles
    let raf = null
    map.on('move', () => {
      if (raf) return
      raf = requestAnimationFrame(() => { raf = null; syncLayers() })
    })
    map.on('moveend', () => { syncLayers(); repairPass() })

    /* Delegated cluster clicks — one listener for every bubble, present or
       future, so a rebuilt marker can never lose its zoom-in behaviour. */
    const onContainerClick = (e) => {
      const bubble = e.target?.closest?.('.cluster-pin')
      if (!bubble) return
      const lng = Number(bubble.dataset.clng)
      const lat = Number(bubble.dataset.clat)
      if (!Number.isFinite(lng) || !Number.isFinite(lat)) return
      e.stopPropagation()
      map.easeTo({ center: [lng, lat], zoom: Math.min(map.getZoom() + 2.2, 16), duration: 700 })
    }
    map.getContainer().addEventListener('click', onContainerClick, true)

    /* Recover from a zero-sized container. MapLibre drops camera commands
       while it has no box, so the intro (or an area fit) can be lost; when
       size finally arrives we replay it. ResizeObserver is the primary
       signal, but some embedded/backgrounded views throttle it, so the
       map's own resize event and a bounded poll cover that case too. */
    const recoverCamera = () => {
      const { clientWidth: w, clientHeight: h } = map.getContainer()
      if (!w || !h) { hadSizeRef.current = false; return false }
      if (hadSizeRef.current) return true
      hadSizeRef.current = true
      try { map.resize() } catch { /* keep going — the replay matters more */ }

      const intent = cameraIntentRef.current
      if (intent) {
        const opts = { ...intent.opts, duration: 0 }
        if (intent.kind === 'fit') map.fitBounds(intent.bounds, opts)
        else                       map.flyTo(opts)
      } else if (map.getZoom() <= GLOBE_VIEW.zoom + 0.05) {
        /* Still parked on the opening globe with nothing pending: the intro
           was dropped. Land on Egypt so nobody faces an empty sphere. */
        map.flyTo({ ...EGYPT_VIEW, offset: PANEL_OFFSET, duration: 0 })
      }
      disarmWatchdog()
      setIntroDone(true)
      syncLayers()
      return true
    }

    const ro = new ResizeObserver(() => recoverCamera())
    ro.observe(containerRef.current)
    map.on('resize', recoverCamera)
    const sizePoll = setInterval(() => { if (recoverCamera()) clearInterval(sizePoll) }, 800)
    const sizePollStop = setTimeout(() => clearInterval(sizePoll), 30000)

    return () => {
      map.getContainer().removeEventListener('click', onContainerClick, true)
      clearInterval(sizePoll)
      clearTimeout(sizePollStop)
      ro.disconnect()
      clearTimeout(startFallback)
      clearTimeout(watchdogRef.current)
      clearTimeout(repairTimer.current)
      if (raf) cancelAnimationFrame(raf)
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
    styleReadyRef.current = false   // setStyle wipes sources; style.load re-arms
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
      clusterMarkers.current.forEach(entry => entry.marker.remove())
      clusterMarkers.current.clear()
      popupRef.current?.remove()
      return
    }

    // Visibility by SCREEN position (projection-agnostic — geographic
    // bounds are unreliable under globe projection + camera padding)
    const { clientWidth: W, clientHeight: H } = map.getContainer()
    const MARGIN = 80
    const inView = []
    for (const p of projectsRef.current) {
      const pt = map.project([p.lng, p.lat])
      if (pt.x < -MARGIN || pt.x > W + MARGIN || pt.y < -MARGIN || pt.y > H + MARGIN) continue
      inView.push({ p, pt })
    }

    /* Group neighbours into one bubble before anything is placed. The grid
       is geographic (sized to ~CLUSTER_PX at the current zoom) so a cell —
       and therefore a bubble — keeps its identity and position while the
       broker pans; only zooming re-groups. */
    const zoom     = map.getZoom()
    const degPerPx = 360 / (256 * Math.pow(2, zoom))
    const cellLng  = CLUSTER_PX * degPerPx
    const cells    = new Map()
    for (const { p, pt } of inView) {
      const cellLat = cellLng * Math.max(Math.cos((p.lat * Math.PI) / 180), 0.2)
      const key = `${Math.floor(p.lng / cellLng)}:${Math.floor(p.lat / cellLat)}`
      let cell = cells.get(key)
      if (!cell) { cell = { key, members: [], sx: 0, sy: 0, lng: 0, lat: 0 }; cells.set(key, cell) }
      cell.members.push(p)
      cell.sx += pt.x; cell.sy += pt.y
      cell.lng += p.lng; cell.lat += p.lat
    }

    const entries = []
    const byId    = new Map()
    const clusterCells = new Map()
    for (const cell of cells.values()) {
      const n = cell.members.length
      if (n === 1) {
        const p  = cell.members[0]
        const pt = map.project([p.lng, p.lat])
        const label = pinLabel(p)
        entries.push({ id: p.id, x: pt.x, y: pt.y, label, area: p.location })
        byId.set(p.id, { p, label })
      } else {
        const id = `c:${cell.key}`
        entries.push({
          id, kind: 'cluster', count: n,
          x: cell.sx / n, y: cell.sy / n,
          label: String(n),
          size: clusterSize(n),
          area: cell.members[0].location,
        })
        clusterCells.set(id, {
          count: n,
          lngLat: [cell.lng / n, cell.lat / n],
        })
      }
    }

    /* Bubbles → pills → dots → hidden, never stacked. Priority: selected
       project, then clusters, then busiest areas, then list sort order. */
    const popularity = new Map(zonesRef.current.map(z => [z.area, z.count]))
    const { modes, order, hidden } = computePlacements(entries, popularity, selectedRef.current?.id)
    orderRef.current = order

    const visible = new Set(byId.keys())
    const rank = new Map(order.map((id, i) => [id, i]))
    const liveClusters = new Set()
    for (const [id, mode] of modes) {
      if (clusterCells.has(id)) {
        if (mode === 'bubble') {
          ensureCluster(id, clusterCells.get(id), map)
          liveClusters.add(id)
        }
        continue
      }
      const { p, label } = byId.get(id)
      ensurePin(p, map, mode, label)
      const entry = pinMarkers.current.get(id)
      if (entry) entry.priority = rank.get(id) ?? 1e9
    }

    clusterMarkers.current.forEach((entry, id) => {
      if (!liveClusters.has(id)) {
        entry.marker.remove()
        clusterMarkers.current.delete(id)
      }
    })

    if (hidden !== hiddenRef.current) {
      hiddenRef.current = hidden
      setHiddenCount(hidden)
    }

    pinMarkers.current.forEach((entry, id) => {
      if (!visible.has(id)) {
        entry.marker.remove()
        pinMarkers.current.delete(id)
      }
    })

    scheduleRepair()
  }

  /* Any sync can promote a marker back to a pill (model-based), so the
     measured repair must follow every sync — debounced so it costs one
     pass once movement settles, not one per frame. */
  const repairTimer = useRef(null)
  const scheduleRepair = () => {
    clearTimeout(repairTimer.current)
    repairTimer.current = setTimeout(() => repairPass(), 120)
  }

  /* Second pass against the measured DOM — estimated text metrics and
     marker transforms drift a few px, so verify what is actually on
     screen and demote anything that still touches a neighbour. */
  const repairPass = () => {
    const map = mapRef.current
    if (!map || map.getZoom() < PIN_ZOOM) return
    requestAnimationFrame(() => {
      /* Source markers from the LIVE DOM (not a cached order array, which
         can go stale between passes) and sort by the priority stamped on
         each element, so every rendered marker is always checked. */
      let extra = 0
      for (let attempt = 0; attempt < 3; attempt++) {
        const live = [...pinMarkers.current.entries()]
          .filter(([, e]) => e.mode !== 'hidden')
          .sort((a, b) => (a[1].priority ?? 1e9) - (b[1].priority ?? 1e9))
          .map(([id]) => id)

        // cluster bubbles are fixed — pills and dots yield around them
        const fixed = [...clusterMarkers.current.values()]
          .map(e => e.el.getBoundingClientRect())

        const demoted = repairOverlaps(live, (id) => {
          const entry = pinMarkers.current.get(id)
          if (!entry) return null
          return {
            mode: entry.mode,
            rect: () => entry.el.getBoundingClientRect(),
            setMode: (m) => applyMode(entry, m),
          }
        }, 6, fixed)
        extra += demoted
        if (demoted === 0) break   // stable
      }

      const total = hiddenRef.current + extra
      if (extra > 0 && total !== hiddenRef.current) {
        hiddenRef.current = total
        setHiddenCount(total)
      }
    })
  }

  /* Single place that mutates a marker's render mode */
  const applyMode = (entry, mode) => {
    if (entry.mode === mode) return
    entry.mode = mode
    entry.el.className     = mode === 'pill' ? 'price-pin' : 'dot-pin'
    entry.el.textContent   = mode === 'pill' ? entry.label : ''
    entry.el.style.display = mode === 'hidden' ? 'none' : ''
    entry.el.setAttribute('aria-label', entry.aria ?? entry.label)
  }

  /* Cluster bubble — how many projects sit here, click to zoom into them */
  const ensureCluster = (id, cell, map) => {
    let entry = clusterMarkers.current.get(id)
    if (!entry) {
      const el = document.createElement('button')
      el.type = 'button'
      el.className = 'cluster-pin'
      const marker = new Marker({ element: el }).setLngLat(cell.lngLat).addTo(map)
      entry = { marker, el, count: null }
      clusterMarkers.current.set(id, entry)
    }

    /* The zoom target travels on the element itself and is handled by a
       delegated listener on the map container (see 'click' below). Binding
       per element proved fragile as markers are reused across passes. */
    entry.el.dataset.clng = cell.lngLat[0]
    entry.el.dataset.clat = cell.lngLat[1]
    entry.marker.setLngLat(cell.lngLat)
    if (entry.count !== cell.count) {
      entry.count = cell.count
      entry.el.textContent = cell.count > 999 ? '999+' : String(cell.count)
      const s = clusterSize(cell.count)
      entry.el.style.width  = `${s}px`
      entry.el.style.height = `${s}px`
      entry.el.setAttribute('aria-label', `${cell.count} projects here — zoom in`)
    }
    return entry
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

    entry.label = label
    entry.aria  = `${project.name} — ${project.developer} — from ${project.price}`
    applyMode(entry, mode)

    entry.el.classList.toggle('price-pin--selected', selectedRef.current?.id === project.id)
    entry.el.classList.toggle('price-pin--compare', compareRef.current?.includes(project.id))
  }

  /* ── zone areas + badges ───────────────────────────────────────────── */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    // the selected area gets its real border drawn instead of the hull
    whenStyleReady(() => drawZoneAreas(map, zones.filter(z => z.area !== selectedArea)))

    zoneMarkers.current.forEach(m => m.remove())
    zoneMarkers.current = []

    for (const zone of zones) {
      const el = document.createElement('button')
      el.className = 'zone-badge'
      el.type = 'button'
      el.innerHTML = `<strong>${zone.count}</strong><span>${zone.area}</span>`
      el.addEventListener('click', () => callbacksRef.current.onSelectArea(zone.area))
      zoneMarkers.current.push(
        new Marker({ element: el }).setLngLat([zone.lng, zone.lat]).addTo(map)
      )
    }
    syncLayers(); repairPass()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zones, mapReady, selectedArea])

  /* ── selected area: fit to its real governmental border ────────────── */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    if (!selectedArea) {
      boundaryRef.current = null
      clearSelectedArea(map)
      return
    }

    /* This is broker-driven navigation: retire the intro watchdog so it
       cannot yank the camera back to the country view moments later. */
    disarmWatchdog()

    /* fitBounds uses camera padding, which is only safe on mercator — make
       sure we are off the globe even if the intro's moveend never fired. */
    try { map.setProjection({ type: 'mercator' }) } catch { /* ignore */ }

    const boundary = getAreaBoundary(selectedArea)   // bundled, synchronous
    const zone     = zonesRef.current.find(z => z.area === selectedArea)

    if (boundary) {
      boundaryRef.current = boundary.geometry
      whenStyleReady(() => {
        if (boundaryRef.current) drawSelectedArea(map, boundaryRef.current)
      })
    } else {
      // OSM has no official polygon for this area — no invented shape
      boundaryRef.current = null
      clearSelectedArea(map)
    }

    const bounds = boundary?.bounds ?? boundsOfPoints(zone?.points ?? [])
    if (bounds) {
      setCamera(map, {
        kind: 'fit',
        bounds,
        opts: { padding: FIT_PADDING, duration: 1400, maxZoom: 14, essential: true },
      })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedArea, mapReady])

  /* ── refresh pins when the filtered project set changes ────────────── */
  useEffect(() => {
    if (!mapReady) return
    pinMarkers.current.forEach(entry => entry.marker.remove())
    pinMarkers.current.clear()
    clusterMarkers.current.forEach(entry => entry.marker.remove())
    clusterMarkers.current.clear()
    popupRef.current?.remove()
    syncLayers(); repairPass()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projects, mapReady])

  /* ── selected project: fly + re-run declutter so it wins a pill ────── */
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !selectedProject) return
    disarmWatchdog()
    map.flyTo({
      center: [selectedProject.lng, selectedProject.lat],
      zoom: Math.max(map.getZoom(), 13.5),
      offset: PANEL_OFFSET,
      duration: 1400,
      essential: true,
    })
    syncLayers(); repairPass()
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

      {/* Overflow hint — nothing is stacked, so say what's still tucked away */}
      {introDone && hiddenCount > 0 && (
        <button
          type="button"
          className="zoom-hint"
          onClick={() => mapRef.current?.zoomIn({ duration: 600 })}
        >
          <strong>+{hiddenCount}</strong> more here — zoom in
        </button>
      )}

      {children}
    </div>
  )
}

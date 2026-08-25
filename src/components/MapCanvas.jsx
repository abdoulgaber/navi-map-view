import { useEffect, useRef, useState } from 'react'
import { Map as MapGL, Marker, setWorkerUrl } from 'maplibre-gl'
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
/* The market lives in the northern belt — North Coast ⇢ Delta ⇢ Greater
   Cairo ⇢ New Capital / Ain Sokhna. The intro lands there rather than on
   the whole country, most of which is empty desert. */
const NORTH_EGYPT_BOUNDS = [[27.6, 29.25], [32.75, 31.75]]  // [[w,s],[e,n]]
const NORTH_EGYPT_VIEW   = { center: [30.2, 30.5], zoom: 6.9 } // instant fallback
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
const MAX_LABEL = 20
const pinLabel = (p) =>
  p.name.length > MAX_LABEL ? `${p.name.slice(0, MAX_LABEL - 1).trimEnd()}…` : p.name

/* Photo pool for the hover card — deterministic per project so a chip
   always previews the same image. */
const PHOTOS = [
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=720&q=70',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=720&q=70',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=720&q=70',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=720&q=70',
]

const BADGE_STYLE = {
  Trendy:    { bg: '#EF476F', icon: '🔥' },
  Incentive: { bg: '#FF6006', icon: '💰' },
}

const escapeHTML = (s) => String(s).replace(/[&<>"]/g, c => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]
))

const hoverCardHTML = (p) => {
  const badges = p.badges.map(b => {
    const cfg = BADGE_STYLE[b]
    return `<span class="pin-card-badge" style="background:${cfg.bg}">${cfg.icon} ${b}</span>`
  }).join('')
  return `
  <article class="pin-card">
    <div class="pin-card-media" style="background-image:url('${PHOTOS[p.id % PHOTOS.length]}')">
      <div class="pin-card-badges">${badges}</div>
    </div>
    <div class="pin-card-body">
      <div class="pin-card-head">
        <span class="pin-card-logo">${escapeHTML(p.developer.slice(0, 2).toUpperCase())}</span>
        <span class="pin-card-dev">${escapeHTML(p.developer)}</span>
      </div>
      <h4 class="pin-card-name">${escapeHTML(p.name)}</h4>
      <p class="pin-card-price">Starting ${escapeHTML(p.price)}</p>
    </div>
  </article>`
}

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
  const hoverCardRef  = useRef(null)
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
    const { clientWidth: w, clientHeight: h } = map.getContainer()
    if (!w || !h) {
      // dropped: no viewport to animate into — recovery replays it later
      cameraIntentRef.current = { ...intent, applied: false }
      return
    }
    cameraIntentRef.current = { ...intent, applied: true }
    if (intent.kind === 'fit') map.fitBounds(intent.bounds, intent.opts)
    else                      map.flyTo(intent.opts)
  }


  /* ── Hover card ───────────────────────────────────────────────────────
     Anchored to the CHIP and clamped to the usable interface area: it
     flips above/below and slides sideways so it can never fall off the
     viewport or hide behind the floating list panel.                     */
  const HOVER_GAP    = 12
  const HOVER_MARGIN = 12

  const usableArea = () => {
    const panel = document.querySelector('.list-panel')?.getBoundingClientRect()
    const map   = containerRef.current?.getBoundingClientRect()
    return {
      left:   Math.max(panel ? panel.right + HOVER_GAP : 0, map?.left ?? 0) + HOVER_MARGIN,
      top:    (map?.top ?? 0) + HOVER_MARGIN,
      right:  (map?.right ?? window.innerWidth) - HOVER_MARGIN,
      bottom: (map?.bottom ?? window.innerHeight) - HOVER_MARGIN,
    }
  }

  const showHoverCard = (project, anchorEl) => {
    let card = hoverCardRef.current
    if (!card) {
      card = document.createElement('div')
      card.className = 'pin-hover-card'
      document.body.appendChild(card)
      hoverCardRef.current = card
    }
    card.innerHTML = hoverCardHTML(project)
    card.style.visibility = 'hidden'
    card.style.display    = 'block'

    const c    = card.getBoundingClientRect()
    const a    = anchorEl.getBoundingClientRect()
    const area = usableArea()

    // prefer above the chip, fall back to below, then clamp inside
    let top = a.top - c.height - HOVER_GAP
    if (top < area.top) top = a.bottom + HOVER_GAP
    if (top + c.height > area.bottom) {
      top = Math.max(area.top, area.bottom - c.height)
    }

    let left = a.left + a.width / 2 - c.width / 2      // centred on the chip
    left = Math.min(Math.max(left, area.left), Math.max(area.left, area.right - c.width))

    card.style.left = `${Math.round(left)}px`
    card.style.top  = `${Math.round(top)}px`
    card.style.visibility = 'visible'
  }

  const hideHoverCard = () => {
    const card = hoverCardRef.current
    if (card) card.style.display = 'none'
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
        /* Frame the northern belt for THIS viewport, but fly with a plain
           center/zoom: camera padding under globe projection corrupts the
           transform, so we resolve the padded framing up front instead. */
        let target = NORTH_EGYPT_VIEW
        try {
          const cam = map.cameraForBounds(NORTH_EGYPT_BOUNDS, { padding: FIT_PADDING })
          if (cam) target = { center: cam.center, zoom: Math.min(cam.zoom, 8) }
        } catch { /* keep the fallback framing */ }
        setCamera(map, {
          kind: 'fly',
          opts: { ...target, duration: INTRO_MS, curve: 1.32, essential: true },
        })
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
        if (map.getZoom() < GLOBE_VIEW.zoom + 1.5) {
          try { map.setProjection({ type: 'mercator' }) } catch { /* ignore */ }
          map.jumpTo({ ...NORTH_EGYPT_VIEW })
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
    map.on('movestart', hideHoverCard)
    map.on('moveend', () => { syncLayers(); repairPass() })

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

      /* Replay ONLY a camera move that never ran for want of a viewport.
         On a healthy load the intro flight is already playing and must not
         be cut short — that would kill the opening animation. */
      const intent = cameraIntentRef.current
      if (intent && intent.applied === false) {
        const opts = { ...intent.opts, duration: 0 }
        if (intent.kind === 'fit') map.fitBounds(intent.bounds, opts)
        else                       map.flyTo(opts)
        cameraIntentRef.current = { ...intent, applied: true }
        disarmWatchdog()
        setIntroDone(true)
        syncLayers()
      }
      return true
    }

    const ro = new ResizeObserver(() => recoverCamera())
    ro.observe(containerRef.current)
    map.on('resize', recoverCamera)
    const sizePoll = setInterval(() => { if (recoverCamera()) clearInterval(sizePoll) }, 800)
    const sizePollStop = setTimeout(() => clearInterval(sizePoll), 30000)

    return () => {
      hoverCardRef.current?.remove()
      hoverCardRef.current = null
      clearInterval(sizePoll)
      clearTimeout(sizePollStop)
      ro.disconnect()
      clearTimeout(startFallback)
      clearTimeout(watchdogRef.current)
      clearTimeout(repairTimer.current)
      if (raf) cancelAnimationFrame(raf)
      hideHoverCard()
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
      hideHoverCard()
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

    const entries = []
    const byId    = new Map()
    for (const { p, pt } of inView) {
      const label = pinLabel(p)
      entries.push({ id: p.id, x: pt.x, y: pt.y, label, area: p.location })
      byId.set(p.id, { p, label })
    }

    /* Name chips → dots → hidden, never stacked. Priority: selected
       project, then busiest areas (density = broker demand), then the
       list's current sort order. */
    const popularity = new Map(zonesRef.current.map(z => [z.area, z.count]))
    const { modes, order, hidden } = computePlacements(entries, popularity, selectedRef.current?.id)
    orderRef.current = order

    const visible = new Set(byId.keys())
    const rank = new Map(order.map((id, i) => [id, i]))
    for (const [id, mode] of modes) {
      const { p, label } = byId.get(id)
      ensurePin(p, map, mode, label)
      const entry = pinMarkers.current.get(id)
      if (entry) entry.priority = rank.get(id) ?? 1e9
    }

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

    /* Run after the browser has laid the markers out. rAF is the right
       signal, but it is throttled in background/embedded views — a timeout
       guard makes sure the measured repair still happens there. */
    let ran = false
    const runRepair = () => {
      if (ran) return
      ran = true
      /* Source markers from the LIVE DOM (not a cached order array, which
         can go stale between passes) and sort by the priority stamped on
         each element, so every rendered marker is always checked. */
      let extra = 0
      for (let attempt = 0; attempt < 3; attempt++) {
        const live = [...pinMarkers.current.entries()]
          .filter(([, e]) => e.mode !== 'hidden')
          .sort((a, b) => (a[1].priority ?? 1e9) - (b[1].priority ?? 1e9))
          .map(([id]) => id)

        const demoted = repairOverlaps(live, (id) => {
          const entry = pinMarkers.current.get(id)
          if (!entry) return null
          return {
            mode: entry.mode,
            rect: () => entry.el.getBoundingClientRect(),
            setMode: (m) => applyMode(entry, m),
          }
        })
        extra += demoted
        if (demoted === 0) break   // stable
      }

      const total = hiddenRef.current + extra
      if (extra > 0 && total !== hiddenRef.current) {
        hiddenRef.current = total
        setHiddenCount(total)
      }
    }
    requestAnimationFrame(runRepair)
    setTimeout(runRepair, 40)
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

  const ensurePin = (project, map, mode, label) => {
    let entry = pinMarkers.current.get(project.id)

    if (!entry) {
      const el = document.createElement('button')
      el.type = 'button'
      el.addEventListener('mouseenter', () => {
        el.classList.add('map-pin--hover')
        showHoverCard(project, el)
      })
      el.addEventListener('mouseleave', () => {
        el.classList.remove('map-pin--hover')
        hideHoverCard()
      })
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
    hideHoverCard()
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

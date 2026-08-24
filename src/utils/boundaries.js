/**
 * Real administrative boundaries for Egyptian areas.
 *
 * Looked up on demand from OSM/Nominatim (`polygon_geojson=1`), which
 * returns the actual governmental border of a city/district rather than
 * an approximated shape. Results are cached in memory and localStorage,
 * so an area is fetched at most once per browser — Nominatim's usage
 * policy allows ~1 request/second and we only hit it on a zone click.
 *
 * Returns null when a place has no boundary polygon; callers fall back to
 * the project-hull shape so the UI never waits on the network.
 */

const memory  = new Map()
const LS_KEY  = 'navi-area-boundaries-v1'

const readCache = () => {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || '{}') } catch { return {} }
}
const writeCache = (obj) => {
  try { localStorage.setItem(LS_KEY, JSON.stringify(obj)) } catch { /* quota — fine */ }
}

/** Some of our area labels need a more specific query to resolve well */
const QUERY_ALIASES = {
  'New Cairo':                    'New Cairo City, Cairo, Egypt',
  '6th October City':             '6th of October City, Giza, Egypt',
  'New Administrative Capital':   'New Administrative Capital, Egypt',
  'Sheikh Zayed':                 'Sheikh Zayed City, Giza, Egypt',
  'Shorouk City':                 'El Shorouk City, Cairo, Egypt',
  'Obour City':                   'El Obour City, Qalyubia, Egypt',
  'Madinaty':                     'Madinaty, Cairo, Egypt',
  'Nasr City':                    'Nasr City, Cairo, Egypt',
  'Heliopolis':                   'Heliopolis, Cairo, Egypt',
  'Zamalek':                      'Zamalek, Cairo, Egypt',
  'New Alamein':                  'New Alamein City, Matrouh, Egypt',
  'Ain Sokhna':                   'Ain Sokhna, Suez, Egypt',
  'North Coast':                  'Marsa Matrouh, Egypt',
  'Sharm El-Sheikh':              'Sharm El-Sheikh, South Sinai, Egypt',
}

export async function getAreaBoundary(area) {
  if (memory.has(area)) return memory.get(area)

  const cached = readCache()
  if (cached[area] !== undefined) {
    memory.set(area, cached[area])
    return cached[area]
  }

  let value = null
  try {
    const q   = encodeURIComponent(QUERY_ALIASES[area] ?? `${area}, Egypt`)
    const url = `https://nominatim.openstreetmap.org/search?format=json&polygon_geojson=1&limit=3&countrycodes=eg&q=${q}`
    const res = await fetch(url, { headers: { 'Accept-Language': 'en' } })
    if (res.ok) {
      const data = await res.json()
      const hit = data.find(d =>
        d.geojson && (d.geojson.type === 'Polygon' || d.geojson.type === 'MultiPolygon'))
      if (hit) {
        // Nominatim boundingbox is [south, north, west, east] as strings
        const [south, north, west, east] = hit.boundingbox.map(Number)
        value = {
          geojson: hit.geojson,
          bounds: [[west, south], [east, north]],
          label: hit.display_name?.split(',')[0] ?? area,
        }
      }
    }
  } catch { /* offline / rate-limited — fall back to the hull */ }

  memory.set(area, value)
  cached[area] = value
  writeCache(cached)
  return value
}

/** Bounding box of raw [lng,lat] points — the fallback when OSM has none */
export function boundsOfPoints(points) {
  if (!points.length) return null
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const [lng, lat] of points) {
    if (lng < w) w = lng
    if (lng > e) e = lng
    if (lat < s) s = lat
    if (lat > n) n = lat
  }
  const padLng = Math.max((e - w) * 0.15, 0.02)
  const padLat = Math.max((n - s) * 0.15, 0.02)
  return [[w - padLng, s - padLat], [e + padLng, n + padLat]]
}

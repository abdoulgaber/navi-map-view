import BOUNDARIES from '../data/areaBoundaries.json'

/**
 * Real administrative borders, fetched from OpenStreetMap at build time
 * (see scripts/fetch-boundaries*.mjs) and shipped with the app — no
 * geocoding at runtime.
 *
 * OSM genuinely has no city polygon for several Egyptian new cities
 * (El Shorouk, El Obour, the New Capital, Ain Sokhna…): at the time of
 * writing the whole country has only a handful of city-level relations.
 * For those areas we deliberately draw NO shape rather than inventing an
 * approximation — the badge and the project pins define the area instead.
 */

/**
 * Some OSM matches are governorate-scale (Assiut 255km, Beni Suef 247km,
 * Suez 170km, Alexandria 149km …) — mostly empty desert, and wildly out
 * of scale next to a 12km district like Madinaty. Drawing both together
 * reads as noise, so only city/district-scale borders are highlighted;
 * the rest are represented by their badge and pins alone.
 */
const MAX_BOUNDARY_KM = 60

const boundarySpanKm = (b) => {
  const [[w, s], [e, n]] = b.bounds
  const dx = (e - w) * 111 * Math.cos((((n + s) / 2) * Math.PI) / 180)
  const dy = (n - s) * 111
  return Math.sqrt(dx * dx + dy * dy)
}

const DRAWABLE = Object.fromEntries(
  Object.entries(BOUNDARIES).filter(([, b]) => boundarySpanKm(b) <= MAX_BOUNDARY_KM),
)

/** Full record (used for fitting the camera) — every area we resolved */
export function getAreaBoundary(area) {
  return BOUNDARIES[area] ?? null
}

/** Only the borders we are willing to draw */
export function hasDrawableBoundary(area) {
  return Boolean(DRAWABLE[area])
}

/** GeoJSON FeatureCollection of every area we can draw for real */
export function boundaryFeatures(areas) {
  return {
    type: 'FeatureCollection',
    features: areas
      .filter(a => DRAWABLE[a])
      .map(a => ({
        type: 'Feature',
        properties: { area: a, name: DRAWABLE[a].name },
        geometry: DRAWABLE[a].geometry,
      })),
  }
}

/** Bounding box of raw [lng,lat] points — used when an area has no border */
export function boundsOfPoints(points) {
  if (!points.length) return null
  let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
  for (const [lng, lat] of points) {
    if (lng < w) w = lng
    if (lng > e) e = lng
    if (lat < s) s = lat
    if (lat > n) n = lat
  }
  const padLng = Math.max((e - w) * 0.18, 0.02)
  const padLat = Math.max((n - s) * 0.18, 0.02)
  return [[w - padLng, s - padLat], [e + padLng, n + padLat]]
}

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

/** @returns {{name, kind, bounds, geometry}|null} */
export function getAreaBoundary(area) {
  return BOUNDARIES[area] ?? null
}

export function hasAreaBoundary(area) {
  return Boolean(BOUNDARIES[area])
}

/** GeoJSON FeatureCollection of every area we can draw for real */
export function boundaryFeatures(areas) {
  return {
    type: 'FeatureCollection',
    features: areas
      .filter(a => BOUNDARIES[a])
      .map(a => ({
        type: 'Feature',
        properties: { area: a, name: BOUNDARIES[a].name },
        geometry: BOUNDARIES[a].geometry,
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

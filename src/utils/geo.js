/**
 * Organic-looking area polygon around a zone center.
 * We don't have official district boundaries, so each zone gets a soft
 * "blob" sized from its scatter radius (the same extent its projects
 * are spread over), with deterministic noise so it reads as an area
 * rather than a perfect circle.
 */
export function zoneAreaFeature(zone) {
  const { lng, lat, scatter = 0.03, area } = zone
  const rBase  = Math.max(scatter * 1.5, 0.05)
  const points = 48

  // deterministic per-zone noise seed from the area name
  let seed = 0
  for (const ch of area) seed = (seed * 31 + ch.charCodeAt(0)) & 0xffff

  const coords = []
  for (let i = 0; i < points; i++) {
    const t = (i / points) * 2 * Math.PI
    const n = Math.sin(t * 3 + seed) * 0.18 + Math.sin(t * 5 + seed * 2) * 0.10
    const r = rBase * (1 + n)
    const dLng = r / Math.cos((lat * Math.PI) / 180)
    coords.push([lng + dLng * Math.cos(t), lat + r * Math.sin(t)])
  }
  coords.push(coords[0]) // close the ring

  return {
    type: 'Feature',
    properties: { area },
    geometry: { type: 'Polygon', coordinates: [coords] },
  }
}

/**
 * Zone area polygon built from the zone's actual project locations:
 * convex hull → expanded outward → corner-smoothed (Chaikin).
 * The highlight covers the real territory the projects occupy, so it
 * reads as the city/district area rather than an arbitrary blob.
 */

/* Andrew's monotone chain convex hull. points: [[lng,lat], ...] */
function convexHull(points) {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (pts.length <= 2) return pts
  const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop()
    lower.push(p)
  }
  const upper = []
  for (let i = pts.length - 1; i >= 0; i--) {
    const p = pts[i]
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop()
    upper.push(p)
  }
  lower.pop(); upper.pop()
  return lower.concat(upper)
}

/* Chaikin corner cutting — rounds the hull into an organic district shape */
function chaikin(ring, iterations = 2) {
  let pts = ring
  for (let it = 0; it < iterations; it++) {
    const out = []
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i]
      const b = pts[(i + 1) % pts.length]
      out.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
      )
    }
    pts = out
  }
  return pts
}

/* Fallback ring for zones with too few projects to form a hull */
function circleRing([lng, lat], r, points = 32) {
  const ring = []
  for (let i = 0; i < points; i++) {
    const t = (i / points) * 2 * Math.PI
    ring.push([lng + (r / Math.cos((lat * Math.PI) / 180)) * Math.cos(t), lat + r * Math.sin(t)])
  }
  return ring
}

export function zoneAreaFeature(zone) {
  const { area, points = [], lng, lat, scatter = 0.03 } = zone

  let ring
  if (points.length < 3) {
    ring = circleRing([lng, lat], Math.max(scatter * 1.3, 0.03))
  } else {
    const hull = convexHull(points)
    // centroid of the hull
    let cx = 0, cy = 0
    for (const [x, y] of hull) { cx += x; cy += y }
    cx /= hull.length; cy /= hull.length
    // expand: 22% outward + a fixed margin so edge projects sit inside
    const expanded = hull.map(([x, y]) => {
      const dx = x - cx, dy = y - cy
      const len = Math.sqrt(dx * dx + dy * dy) || 1
      const pad = 0.008
      return [x + dx * 0.22 + (dx / len) * pad, y + dy * 0.22 + (dy / len) * pad]
    })
    ring = chaikin(expanded, 2)
  }

  ring.push(ring[0]) // close
  return {
    type: 'Feature',
    properties: { area },
    geometry: { type: 'Polygon', coordinates: [ring] },
  }
}

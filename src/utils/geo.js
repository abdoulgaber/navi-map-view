/** Great-circle distance in km between two [lng, lat] points */
export function haversineKm([lng1, lat1], [lng2, lat2]) {
  const R = 6371
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** GeoJSON circle polygon around [lng, lat] with radius in km */
export function circleGeoJSON([lng, lat], km, points = 64) {
  const dLat = km / 110.574
  const dLng = km / (111.32 * Math.cos((lat * Math.PI) / 180))
  const coords = []
  for (let i = 0; i <= points; i++) {
    const t = (i / points) * 2 * Math.PI
    coords.push([lng + dLng * Math.cos(t), lat + dLat * Math.sin(t)])
  }
  return { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }
}

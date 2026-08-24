/**
 * Second pass: fill in areas the free-text search could not resolve.
 * Structured queries (city=/suburb=/state=) bias Nominatim towards the
 * administrative relation instead of the place node.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const FILE = new URL('../src/data/areaBoundaries.json', import.meta.url)
const out  = JSON.parse(readFileSync(FILE, 'utf8'))

/** [param, value] attempts per missing area */
const ATTEMPTS = {
  'New Administrative Capital': [['city', 'New Administrative Capital'], ['city', 'العاصمة الإدارية الجديدة'], ['q', 'Badr City, Cairo, Egypt']],
  'Shorouk City':               [['city', 'El Shorouk'], ['city', 'مدينة الشروق'], ['suburb', 'El Shorouk']],
  'Obour City':                 [['city', 'El Obour'], ['city', 'مدينة العبور'], ['suburb', 'Obour City']],
  'Zamalek':                    [['suburb', 'Zamalek'], ['suburb', 'الزمالك'], ['city', 'Zamalek']],
  'Sharm El-Sheikh':            [['city', 'Sharm El-Sheikh'], ['city', 'شرم الشيخ']],
  'Hurghada':                   [['city', 'Hurghada'], ['city', 'الغردقة']],
  'Mansoura':                   [['city', 'Mansoura'], ['city', 'المنصورة']],
  'New Alamein':                [['city', 'New Alamein'], ['city', 'El Alamein'], ['city', 'العلمين']],
  'Ain Sokhna':                 [['city', 'Ain Sokhna'], ['city', 'العين السخنة'], ['suburb', 'Ain Sokhna']],
  'North Coast':                [['city', 'Marsa Matruh'], ['city', 'مرسى مطروح']],
}

const PLACE_TYPES = ['city', 'town', 'suburb', 'neighbourhood', 'quarter', 'village', 'municipality']
const score = (c) => {
  if (!c.geojson) return 0
  if (c.geojson.type !== 'Polygon' && c.geojson.type !== 'MultiPolygon') return 0
  if (c.class === 'boundary' && c.type === 'administrative') return 100
  if (c.class === 'place' && PLACE_TYPES.includes(c.type)) return 80
  return 0
}
const round = (n) => Math.round(n * 1e4) / 1e4
function simplifyRing(ring, maxPoints = 160) {
  const step = Math.max(1, Math.ceil(ring.length / maxPoints))
  const r = ring.filter((_, i) => i % step === 0).map(([x, y]) => [round(x), round(y)])
  const [fx, fy] = r[0], [lx, ly] = r[r.length - 1]
  if (fx !== lx || fy !== ly) r.push([fx, fy])
  return r
}
const simplify = (g) => g.type === 'Polygon'
  ? { type: 'Polygon', coordinates: [simplifyRing(g.coordinates[0])] }
  : { type: 'Polygon', coordinates: [simplifyRing(g.coordinates.map(p => p[0]).sort((a, b) => b.length - a.length)[0])] }

for (const [area, attempts] of Object.entries(ATTEMPTS)) {
  if (out[area]) continue
  let best = null
  for (const [param, value] of attempts) {
    const url = 'https://nominatim.openstreetmap.org/search'
      + `?format=json&polygon_geojson=1&limit=10&countrycodes=eg&${param}=${encodeURIComponent(value)}`
    try {
      const res  = await fetch(url, {
        headers: { 'User-Agent': 'navi-map-view/1.0 (build-time boundary fetch)', 'Accept-Language': 'en' },
      })
      const data = await res.json()
      for (const c of data) {
        const s = score(c)
        if (s > 0 && (!best || s > best.s)) best = { s, c }
      }
    } catch (err) { console.log(`  ! ${area}: ${err.message}`) }
    await sleep(1100)
    if (best && best.s >= 100) break
  }

  if (best) {
    const c = best.c
    const [south, north, west, east] = c.boundingbox.map(Number)
    out[area] = {
      name: c.display_name.split(',')[0],
      kind: `${c.class}/${c.type}`,
      bounds: [[round(west), round(south)], [round(east), round(north)]],
      geometry: simplify(c.geojson),
    }
    console.log(`✓ ${area.padEnd(28)} ${out[area].name} [${out[area].kind}] ${out[area].geometry.coordinates[0].length} pts`)
  } else {
    console.log(`✗ ${area.padEnd(28)} still unresolved — hull fallback`)
  }
}

writeFileSync(FILE, JSON.stringify(out))
console.log(`\nTotal ${Object.keys(out).length} boundaries — ${(JSON.stringify(out).length / 1024).toFixed(1)} KB`)

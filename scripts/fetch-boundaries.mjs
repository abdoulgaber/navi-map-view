/**
 * Build-time fetch of real administrative borders for every NAVI area.
 *
 * Runs once (npm run boundaries) and commits src/data/areaBoundaries.json,
 * so the app ships with genuine governmental borders and makes zero
 * geocoding calls at runtime. Respects Nominatim's 1 req/s policy.
 *
 * Candidates are scored so we keep the actual city/district relation and
 * never a same-named building, campus or airport.
 */
import { writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

/** Query attempts per area, best first (Arabic often resolves better) */
const QUERIES = {
  'New Cairo':                  ['New Cairo City, Cairo, Egypt', 'مدينة القاهرة الجديدة'],
  '6th October City':           ['6th of October City, Giza, Egypt', 'مدينة السادس من أكتوبر'],
  'Alexandria':                 ['Alexandria Governorate, Egypt', 'Alexandria, Egypt'],
  'North Coast':                ['Sidi Abdel Rahman, Matrouh, Egypt', 'العلمين'],
  'Ain Sokhna':                 ['Ain Sokhna, Suez, Egypt', 'العين السخنة'],
  'New Administrative Capital': ['New Administrative Capital, Egypt', 'العاصمة الإدارية الجديدة'],
  'Madinaty':                   ['Madinaty, Cairo, Egypt', 'مدينتي'],
  'Shorouk City':               ['El Shorouk City, Cairo, Egypt', 'مدينة الشروق'],
  'Obour City':                 ['El Obour City, Qalyubia, Egypt', 'مدينة العبور'],
  'Sheikh Zayed':               ['Sheikh Zayed City, Giza, Egypt', 'مدينة الشيخ زايد'],
  'Heliopolis':                 ['Heliopolis, Cairo, Egypt', 'مصر الجديدة'],
  'Nasr City':                  ['Nasr City, Cairo, Egypt', 'مدينة نصر'],
  'New Alamein':                ['New Alamein City, Matrouh, Egypt', 'مدينة العلمين الجديدة'],
  'Hurghada':                   ['Hurghada, Red Sea, Egypt', 'الغردقة'],
  'Mansoura':                   ['Mansoura, Dakahlia, Egypt', 'مركز المنصورة'],
  'Ismailia':                   ['Ismailia, Egypt', 'الإسماعيلية'],
  'Zamalek':                    ['Zamalek, Cairo, Egypt', 'الزمالك'],
  'Tanta':                      ['Tanta, Gharbia, Egypt', 'طنطا'],
  'Sharm El-Sheikh':            ['Sharm El-Sheikh, South Sinai, Egypt', 'شرم الشيخ'],
  'Suez':                       ['Suez Governorate, Egypt', 'Suez, Egypt'],
  'Damietta':                   ['Damietta, Egypt', 'دمياط'],
  'Assiut':                     ['Assiut, Egypt', 'أسيوط'],
  'Luxor':                      ['Luxor City, Egypt', 'مدينة الأقصر'],
  'Beni Suef':                  ['Beni Suef, Egypt', 'بني سويف'],
  'Port Said':                  ['Port Said Governorate, Egypt', 'بورسعيد'],
}

const PLACE_TYPES = ['city', 'town', 'suburb', 'neighbourhood', 'quarter', 'village', 'municipality']

/** Higher is better; anything <= 0 is rejected (buildings, campuses, airports…) */
function score(c) {
  if (!c.geojson) return 0
  if (c.geojson.type !== 'Polygon' && c.geojson.type !== 'MultiPolygon') return 0
  if (c.class === 'boundary' && c.type === 'administrative') return 100
  if (c.class === 'place' && PLACE_TYPES.includes(c.type)) return 80
  if (c.osm_type === 'relation' && c.class === 'landuse') return 40
  return 0   // building / amenity / aeroway / university …
}

const round = (n) => Math.round(n * 1e4) / 1e4
function simplifyRing(ring, maxPoints = 160) {
  const step = Math.max(1, Math.ceil(ring.length / maxPoints))
  const out = ring.filter((_, i) => i % step === 0).map(([x, y]) => [round(x), round(y)])
  const [fx, fy] = out[0]
  const [lx, ly] = out[out.length - 1]
  if (fx !== lx || fy !== ly) out.push([fx, fy])
  return out
}
function simplifyGeometry(geom) {
  if (geom.type === 'Polygon') {
    return { type: 'Polygon', coordinates: [simplifyRing(geom.coordinates[0])] }
  }
  const biggest = geom.coordinates
    .map(poly => poly[0])
    .sort((a, b) => b.length - a.length)[0]
  return { type: 'Polygon', coordinates: [simplifyRing(biggest)] }
}

const out = {}
for (const [area, queries] of Object.entries(QUERIES)) {
  let best = null
  for (const query of queries) {
    const url = 'https://nominatim.openstreetmap.org/search'
      + `?format=json&polygon_geojson=1&limit=10&countrycodes=eg&q=${encodeURIComponent(query)}`
    try {
      const res  = await fetch(url, {
        headers: {
          'User-Agent': 'navi-map-view/1.0 (build-time boundary fetch)',
          'Accept-Language': 'en',
        },
      })
      const data = await res.json()
      for (const c of data) {
        const s = score(c)
        if (s > 0 && (!best || s > best.s)) best = { s, c }
      }
    } catch (err) {
      console.log(`  ! ${area}: ${err.message}`)
    }
    await sleep(1100)               // Nominatim: max 1 request per second
    if (best && best.s >= 100) break // exact administrative border — stop early
  }

  if (best) {
    const c = best.c
    const [south, north, west, east] = c.boundingbox.map(Number)
    out[area] = {
      name: c.display_name.split(',')[0],
      kind: `${c.class}/${c.type}`,
      bounds: [[round(west), round(south)], [round(east), round(north)]],
      geometry: simplifyGeometry(c.geojson),
    }
    console.log(`✓ ${area.padEnd(28)} ${out[area].name} [${out[area].kind}] ${out[area].geometry.coordinates[0].length} pts`)
  } else {
    console.log(`✗ ${area.padEnd(28)} no administrative polygon — hull fallback`)
  }
}

writeFileSync(
  new URL('../src/data/areaBoundaries.json', import.meta.url),
  JSON.stringify(out),
)
const kb = (JSON.stringify(out).length / 1024).toFixed(1)
console.log(`\nWrote ${Object.keys(out).length}/${Object.keys(QUERIES).length} boundaries — ${kb} KB`)

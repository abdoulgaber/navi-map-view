/**
 * Third pass: pull the remaining borders straight from OpenStreetMap via
 * Overpass. Nominatim returns place *nodes* for these areas; Overpass gives
 * the administrative relation itself, whose member ways we stitch into a
 * ring. This is the authoritative source for governmental borders.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const FILE = new URL('../src/data/areaBoundaries.json', import.meta.url)
const out  = JSON.parse(readFileSync(FILE, 'utf8'))

// wrong match from the Nominatim pass — let Overpass replace it
if (out['Mansoura']?.name?.includes('Kafr')) delete out['Mansoura']

/** name variants to try per area (matched against name / name:en / name:ar) */
const NAMES = {
  'New Administrative Capital': ['New Administrative Capital', 'العاصمة الإدارية الجديدة'],
  'Shorouk City':               ['El Shorouk City', 'مدينة الشروق', 'الشروق'],
  'Obour City':                 ['El Obour City', 'مدينة العبور', 'العبور'],
  'Zamalek':                    ['Zamalek', 'الزمالك'],
  'Sharm El-Sheikh':            ['Sharm El-Sheikh', 'شرم الشيخ'],
  'Hurghada':                   ['Hurghada', 'الغردقة'],
  'Mansoura':                   ['Mansoura', 'المنصورة'],
  'New Alamein':                ['New Alamein', 'العلمين الجديدة', 'مدينة العلمين الجديدة'],
  'Ain Sokhna':                 ['Ain Sokhna', 'العين السخنة'],
  'North Coast':                ['Marsa Matruh', 'مرسى مطروح'],
}

const round = (n) => Math.round(n * 1e4) / 1e4
const same  = (a, b) => Math.abs(a[0] - b[0]) < 1e-6 && Math.abs(a[1] - b[1]) < 1e-6

/** stitch relation member ways (any order/direction) into one ring */
function stitch(ways) {
  const segs = ways.filter(w => w.length > 1).map(w => w.map(p => [round(p.lon), round(p.lat)]))
  if (!segs.length) return null
  const ring = segs.shift()
  let guard = 0
  while (segs.length && guard++ < 5000) {
    const tail = ring[ring.length - 1]
    let idx = -1, reverse = false
    for (let i = 0; i < segs.length; i++) {
      if (same(segs[i][0], tail))                      { idx = i; reverse = false; break }
      if (same(segs[i][segs[i].length - 1], tail))     { idx = i; reverse = true;  break }
    }
    if (idx === -1) break                       // disjoint piece — keep the main ring
    const seg = segs.splice(idx, 1)[0]
    const seq = reverse ? seg.slice().reverse() : seg
    ring.push(...seq.slice(1))
  }
  if (ring.length < 4) return null
  if (!same(ring[0], ring[ring.length - 1])) ring.push(ring[0])
  return ring
}

function simplifyRing(ring, maxPoints = 160) {
  const step = Math.max(1, Math.ceil(ring.length / maxPoints))
  const r = ring.filter((_, i) => i % step === 0)
  if (!same(r[0], r[r.length - 1])) r.push(r[0])
  return r
}

async function overpass(query) {
  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return res.json()
}

for (const [area, names] of Object.entries(NAMES)) {
  if (out[area]) continue

  const clauses = names.flatMap(n => [
    `relation["boundary"="administrative"]["name"="${n}"](area.eg);`,
    `relation["boundary"="administrative"]["name:en"="${n}"](area.eg);`,
    `relation["place"]["name"="${n}"](area.eg);`,
  ]).join('\n  ')

  const query = `[out:json][timeout:90];
area["ISO3166-1"="EG"][admin_level=2]->.eg;
(
  ${clauses}
);
out geom;`

  try {
    const data = await overpass(query)
    // prefer administrative relations, then the one with the most geometry
    const rels = (data.elements || []).filter(e => e.type === 'relation' && e.members)
    rels.sort((a, b) => {
      const adm = (r) => (r.tags?.boundary === 'administrative' ? 1 : 0)
      if (adm(b) !== adm(a)) return adm(b) - adm(a)
      const pts = (r) => r.members.reduce((n, m) => n + (m.geometry?.length || 0), 0)
      return pts(b) - pts(a)
    })
    const rel = rels[0]
    if (!rel) { console.log(`✗ ${area.padEnd(28)} no relation found`); continue }

    const outers = rel.members
      .filter(m => m.type === 'way' && (m.role === 'outer' || m.role === '') && m.geometry)
      .map(m => m.geometry)
    const ring = stitch(outers)
    if (!ring) { console.log(`✗ ${area.padEnd(28)} could not stitch ring`); continue }

    const simplified = simplifyRing(ring)
    let w = Infinity, s = Infinity, e = -Infinity, n = -Infinity
    for (const [lng, lat] of simplified) {
      if (lng < w) w = lng; if (lng > e) e = lng
      if (lat < s) s = lat; if (lat > n) n = lat
    }
    out[area] = {
      name: rel.tags?.['name:en'] || rel.tags?.name || area,
      kind: `overpass/${rel.tags?.boundary ?? rel.tags?.place ?? 'relation'}`,
      bounds: [[w, s], [e, n]],
      geometry: { type: 'Polygon', coordinates: [simplified] },
    }
    console.log(`✓ ${area.padEnd(28)} ${out[area].name} [${out[area].kind}] ${simplified.length} pts`)
  } catch (err) {
    console.log(`✗ ${area.padEnd(28)} ${err.message}`)
  }
  await sleep(2000)   // be gentle with the public Overpass instance
}

writeFileSync(FILE, JSON.stringify(out))
console.log(`\nTotal ${Object.keys(out).length} boundaries — ${(JSON.stringify(out).length / 1024).toFixed(1)} KB`)

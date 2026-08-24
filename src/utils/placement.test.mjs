import {
  computePlacements, estimatePillW,
  PILL_H, DOT_SIZE,
} from './placement.js'

/* Rendered geometry (no breathing margin) — what the user actually sees */
const renderedRect = (e, mode) => {
  const w = mode === 'pill' ? estimatePillW(e.label) : DOT_SIZE
  const h = mode === 'pill' ? PILL_H : DOT_SIZE
  return { x1: e.x - w / 2, y1: e.y - h / 2, x2: e.x + w / 2, y2: e.y + h / 2 }
}
const overlap = (a, b) => {
  const ox = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1)
  const oy = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1)
  return ox > 0 && oy > 0 ? Math.min(ox, oy) : 0
}

let rng = 12345
const rand = () => ((rng = (rng * 1664525 + 1013904223) & 0xffffffff) >>> 0) / 0xffffffff

function makeScenario(name, count, spread, areas) {
  const entries = []
  for (let i = 0; i < count; i++) {
    const area = areas[i % areas.length]
    entries.push({
      id: i,
      x: 400 + (rand() - 0.5) * spread,
      y: 400 + (rand() - 0.5) * spread,
      label: `EGP ${(rand() * 25 + 1).toFixed(1)}M`,
      area,
    })
  }
  return { name, entries }
}

const areas = ['New Cairo', 'Sheikh Zayed', 'North Coast']
const popularity = new Map([['New Cairo', 120], ['Sheikh Zayed', 40], ['North Coast', 8]])

const scenarios = [
  makeScenario('country zoom (very dense, 500 pins in 300px)', 500, 300, areas),
  makeScenario('city zoom (200 pins in 900px)', 200, 900, areas),
  makeScenario('street zoom (40 pins spread over 1600px)', 40, 1600, areas),
  makeScenario('pathological (100 pins on identical point)', 100, 0, areas),
]

let failures = 0
for (const { name, entries } of scenarios) {
  const { modes, hidden } = computePlacements(entries, popularity, entries[5]?.id ?? null)

  const shown = entries
    .map(e => ({ e, mode: modes.get(e.id) }))
    .filter(x => x.mode !== 'hidden')

  let worst = 0, pairs = 0
  for (let i = 0; i < shown.length; i++)
    for (let j = i + 1; j < shown.length; j++) {
      const o = overlap(renderedRect(shown[i].e, shown[i].mode), renderedRect(shown[j].e, shown[j].mode))
      if (o > 0) { pairs++; worst = Math.max(worst, o) }
    }

  const pills = shown.filter(s => s.mode === 'pill')
  const dots  = shown.filter(s => s.mode === 'dot')
  // priority checks
  const selectedKeptPill = modes.get(entries[5]?.id) === 'pill'
  const topAreaShare = pills.filter(p => p.e.area === 'New Cairo').length / (pills.length || 1)

  const ok = pairs === 0 && selectedKeptPill
  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  ${name}\n` +
    `      pills=${pills.length} dots=${dots.length} hidden=${hidden} ` +
    `overlappingPairs=${pairs} worstOverlapPx=${worst.toFixed(1)}\n` +
    `      selectedKeptPill=${selectedKeptPill} busiestAreaShareOfPills=${(topAreaShare * 100).toFixed(0)}%`
  )
}

console.log(failures === 0 ? '\nALL SCENARIOS PASS — zero overlaps at every density' : `\n${failures} SCENARIO(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)

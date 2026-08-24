import {
  computePlacements, repairOverlaps, estimatePillW,
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

/* ── repair pass: model drift must be corrected against measured DOM ──── */
{
  // Simulate rendered rects that drift up to ±14px from the model, which is
  // what produced real overlaps on the deployed build.
  const drift = () => (rand() - 0.5) * 28
  const sim = []
  for (let i = 0; i < 60; i++) {
    const cx = 400 + (rand() - 0.5) * 700, cy = 400 + (rand() - 0.5) * 700
    sim.push({ id: i, cx, cy, mode: 'pill', w: 82 + drift(), h: PILL_H })
  }
  const state = new Map(sim.map(s => [s.id, s]))
  const get = (id) => {
    const s = state.get(id)
    if (!s) return null
    return {
      get mode() { return s.mode },
      rect: () => {
        const w = s.mode === 'pill' ? s.w : DOT_SIZE
        const h = s.mode === 'pill' ? s.h : DOT_SIZE
        return { left: s.cx - w/2, right: s.cx + w/2, top: s.cy - h/2, bottom: s.cy + h/2 }
      },
      setMode: (m) => { s.mode = m },
    }
  }
  const order = sim.map(s => s.id)
  const before = (() => {
    let n = 0
    for (let i = 0; i < sim.length; i++) for (let j = i+1; j < sim.length; j++) {
      const a = get(sim[i].id).rect(), b = get(sim[j].id).rect()
      if (Math.min(a.right,b.right) > Math.max(a.left,b.left) && Math.min(a.bottom,b.bottom) > Math.max(a.top,b.top)) n++
    }
    return n
  })()

  repairOverlaps(order, get)

  const shown = sim.filter(s => s.mode !== 'hidden')
  let after = 0
  for (let i = 0; i < shown.length; i++) for (let j = i+1; j < shown.length; j++) {
    const a = get(shown[i].id).rect(), b = get(shown[j].id).rect()
    if (Math.min(a.right,b.right) > Math.max(a.left,b.left) && Math.min(a.bottom,b.bottom) > Math.max(a.top,b.top)) after++
  }
  const ok = after === 0
  if (!ok) failures++
  console.log(
    `${ok ? 'PASS' : 'FAIL'}  repair pass on drifted DOM rects\n` +
    `      overlapsBefore=${before} overlapsAfter=${after} ` +
    `shown=${shown.length}/${sim.length}`
  )
}

console.log(failures === 0 ? '\nALL SCENARIOS PASS — zero overlaps at every density' : `\n${failures} SCENARIO(S) FAILED`)
process.exit(failures === 0 ? 0 : 1)

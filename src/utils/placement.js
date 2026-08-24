/**
 * Screen-space pin placement.
 *
 * Guarantees, at every zoom level:
 *  - no two rendered markers overlap (each keeps a breathing margin)
 *  - the most in-demand areas keep the readable price pills
 *  - anything that cannot breathe is hidden rather than stacked
 *
 * Pure function of screen coordinates → render modes, so it can be unit
 * tested without a map instance.
 */

export const PILL_H     = 30   // rendered pill height (px)
export const PILL_GAP   = 8    // breathing room around a price pill (px)
export const DOT_SIZE   = 12   // rendered dot diameter (px)
export const DOT_GAP    = 7    // breathing room around a dot (px)
export const HOVER_ROOM = 6    // extra room so hover scaling never collides

export const estimatePillW = (label) => label.length * 7.4 + 26

const intersects = (a, b) =>
  a.x1 < b.x2 && a.x2 > b.x1 && a.y1 < b.y2 && a.y2 > b.y1

const rectAt = (pt, w, h) => ({
  x1: pt.x - w / 2, y1: pt.y - h / 2,
  x2: pt.x + w / 2, y2: pt.y + h / 2,
})

/**
 * @param entries    [{ id, x, y, label, area }] — already viewport-filtered
 * @param popularity Map<area, projectCount> — busier areas win pills
 * @param selectedId the project that must always keep its pill
 * @returns { modes: Map<id,'pill'|'dot'|'hidden'>, hidden: number }
 */
export function computePlacements(entries, popularity = new Map(), selectedId = null) {
  // Priority: selected → busiest area → incoming (list sort) order
  const ordered = entries.map((e, i) => ({ ...e, i })).sort((a, b) => {
    if (a.id === selectedId) return -1
    if (b.id === selectedId) return 1
    const pd = (popularity.get(b.area) ?? 0) - (popularity.get(a.area) ?? 0)
    return pd !== 0 ? pd : a.i - b.i
  })

  const placed = []
  const modes  = new Map()
  const leftovers = []

  // Tier 1 — price pills
  for (const e of ordered) {
    const rect = rectAt(e, estimatePillW(e.label) + PILL_GAP, PILL_H + PILL_GAP)
    if (placed.some(r => intersects(rect, r))) {
      leftovers.push(e)
    } else {
      placed.push(rect)
      modes.set(e.id, 'pill')
    }
  }

  // Tier 2 — dots (tested against pills *and* other dots)
  const dotBox = DOT_SIZE + DOT_GAP + HOVER_ROOM
  let hidden = 0
  for (const e of leftovers) {
    const rect = rectAt(e, dotBox, dotBox)
    if (placed.some(r => intersects(rect, r))) {
      modes.set(e.id, 'hidden')   // Tier 3 — never stack
      hidden++
    } else {
      placed.push(rect)
      modes.set(e.id, 'dot')
    }
  }

  return { modes, hidden }
}

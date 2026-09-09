import { useEffect, useState } from 'react'

/**
 * One source of truth for the layout breakpoints.
 *
 * The same three widths are mirrored in index.css, so styling stays in CSS
 * and only genuinely behavioural differences (a bottom sheet instead of a
 * side panel, where the camera centres a project) reach into JavaScript.
 *
 *   mobile   < 768   compact header, full-bleed map, list in a bottom sheet
 *   tablet   < 1200  slimmer floating panel, drawer covers most of the map
 *   desktop  ≥ 1200  panel + map + drawer side by side
 */
export const BREAKPOINTS = { mobile: 768, tablet: 1200 }

const read = () => {
  if (typeof window === 'undefined') return 'desktop'
  const w = window.innerWidth
  if (w < BREAKPOINTS.mobile) return 'mobile'
  if (w < BREAKPOINTS.tablet) return 'tablet'
  return 'desktop'
}

export function useBreakpoint() {
  const [bp, setBp] = useState(read)

  useEffect(() => {
    const mqs = [
      window.matchMedia(`(max-width: ${BREAKPOINTS.mobile - 1}px)`),
      window.matchMedia(`(max-width: ${BREAKPOINTS.tablet - 1}px)`),
    ]
    const update = () => setBp(read())
    mqs.forEach(mq => mq.addEventListener('change', update))
    window.addEventListener('orientationchange', update)
    return () => {
      mqs.forEach(mq => mq.removeEventListener('change', update))
      window.removeEventListener('orientationchange', update)
    }
  }, [])

  return {
    breakpoint: bp,
    isMobile:  bp === 'mobile',
    isTablet:  bp === 'tablet',
    isDesktop: bp === 'desktop',
    /** the map is behind everything on mobile — sheets sit on top of it */
    isCompact: bp !== 'desktop',
  }
}

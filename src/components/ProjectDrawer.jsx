import { useEffect, useMemo } from 'react'

/**
 * ProjectDrawer — NAVI hand-off design (node 20959:151193).
 * A floating panel over the right of the map: photo mosaic, project
 * header, the six headline figures, the explore tiles, and the unit
 * price list.
 */

const PHOTOS = [
  'https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=900&q=70',
  'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=600&q=70',
  'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=600&q=70',
  'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=600&q=70',
  'https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?auto=format&fit=crop&w=600&q=70',
]

const BADGE_STYLE = {
  Trendy:    { bg: '#EF476F', shadow: '0 4px 12px rgba(239,71,111,0.15)' },
  Incentive: { bg: '#FF6006', shadow: '0 4px 12px rgba(255,96,6,0.1)' },
}

const FINISHING = ['Not Finished', 'Semi Finished', 'Finished', 'Furnished', 'Flexi Finished']

/** Deterministic unit rows per project — the columns of the hand-off table */
function buildUnits(project) {
  const rows = []
  let seed = project.id * 7919
  const rand = (n) => {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff
    return seed % n
  }
  for (let i = 0; i < 8; i++) {
    const bua  = project.buaValue + rand(90)
    const cash = project.priceValue + rand(40) * 100_000
    rows.push({
      code: `#${12340 + project.id % 900 + i}`,
      building: 12 + i,
      finishing: FINISHING[rand(FINISHING.length)],
      bua: `${bua} M²`,
      floor: rand(12) + 1,
      beds: 1 + rand(4),
      baths: 1 + rand(3),
      outdoor: rand(4) ? `${5 + rand(30)} M²` : '-',
      garden:  rand(4) ? `${5 + rand(30)} M²` : '-',
      roof:    rand(4) ? `${5 + rand(30)} M²` : '-',
      terrace: rand(4) ? `${5 + rand(30)} M²` : '-',
      cash: `${cash.toLocaleString()} EGP`,
      highest: `${Math.round(cash * 1.18).toLocaleString()} EGP`,
    })
  }
  return rows
}

/* ── icons (24px, Untitled-UI stroke style) ─────────────────────────────── */
const IconPin = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" stroke="currentColor" strokeWidth="1.6"/>
    <path d="M12 22s7-5.5 7-11a7 7 0 1 0-14 0c0 5.5 7 11 7 11Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>
)
const IconImage = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="3" y="4.5" width="18" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
    <circle cx="8.5" cy="10" r="1.6" stroke="currentColor" strokeWidth="1.6"/>
    <path d="m4 17 4.6-4.3a2 2 0 0 1 2.7 0L20 19.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>
)
const IconVideo = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <rect x="2.5" y="6" width="13" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6"/>
    <path d="m15.5 12.8 4.3 2.9a.8.8 0 0 0 1.2-.7V9a.8.8 0 0 0-1.2-.7l-4.3 2.9v1.6Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>
)
const IconLayers = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="m12 3 9 4.5-9 4.5-9-4.5L12 3Z" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
    <path d="m3 16.5 9 4.5 9-4.5M3 12l9 4.5L21 12" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"/>
  </svg>
)
const IconDownload = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 20 20" fill="none">
    <path d="M5.5 12.5a3.5 3.5 0 0 1 .6-6.95 4.5 4.5 0 0 1 8.5 1.2 3.2 3.2 0 0 1-.6 6.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 9v8m0 0 2.5-2.5M10 17l-2.5-2.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconMaximize = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M12 3h5v5M8 17H3v-5M17 3l-6.5 6.5M3 17l6.5-6.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)
const IconExternal = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M12 3h5v5M17 3l-7.5 7.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15.5 12v3.5A1.5 1.5 0 0 1 14 17H5a1.5 1.5 0 0 1-1.5-1.5v-9A1.5 1.5 0 0 1 5 5h3.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
)
const IconMoney = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <rect x="1.5" y="3.8" width="13" height="8.4" rx="1.6" stroke="currentColor" strokeWidth="1.3"/>
    <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.3"/>
  </svg>
)
const IconPinSmall = () => (
  <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
    <path d="M6 .8C3.4.8 1.3 2.9 1.3 5.5 1.3 9 6 13.2 6 13.2S10.7 9 10.7 5.5C10.7 2.9 8.6.8 6 .8Z" fill="#4C64FF"/>
    <circle cx="6" cy="5.4" r="1.7" fill="#fff"/>
  </svg>
)

export default function ProjectDrawer({ project, onClose, closing = false }) {
  const units = useMemo(() => buildUnits(project), [project])

  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  const photo = (i) => PHOTOS[(project.id + i) % PHOTOS.length]

  return (
    <aside className={`pdrawer${closing ? ' pdrawer--closing' : ''}`}>
      <button className="pdrawer-close" onClick={onClose} aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <path d="M13.5 4.5l-9 9M4.5 4.5l9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
        </svg>
      </button>

      {/* Photo mosaic */}
      <div className="pdrawer-photos">
        <div className="pdrawer-photo pdrawer-photo--main" style={{ backgroundImage: `url('${photo(0)}')` }} />
        <div className="pdrawer-photo-col">
          <div className="pdrawer-photo" style={{ backgroundImage: `url('${photo(1)}')` }} />
          <div className="pdrawer-photo" style={{ backgroundImage: `url('${photo(2)}')` }} />
        </div>
        <div className="pdrawer-photo-col">
          <div className="pdrawer-photo" style={{ backgroundImage: `url('${photo(3)}')` }} />
          <div className="pdrawer-photo" style={{ backgroundImage: `url('${photo(4)}')` }} />
        </div>
      </div>

      <div className="pdrawer-info">
        {/* Header */}
        <div className="pdrawer-head">
          <div className="pdrawer-logo">{project.developer.slice(0, 2).toUpperCase()}</div>

          <div className="pdrawer-titles">
            <div className="pdrawer-meta">
              <span>{project.developer}</span>
              <span className="pdrawer-sep">|</span>
              <span className="pdrawer-loc"><IconPinSmall /> {project.location}</span>
            </div>
            <div className="pdrawer-namerow">
              <h2 className="pdrawer-name">{project.name}</h2>
              {project.badges.map(b => (
                <span key={b} className="pdrawer-badge" style={{ background: BADGE_STYLE[b].bg, boxShadow: BADGE_STYLE[b].shadow }}>
                  {b === 'Incentive' ? <IconMoney /> : '🔥'} {b}
                </span>
              ))}
            </div>
          </div>

          <div className="pdrawer-actions">
            <button type="button" className="pdrawer-pdf">Download PDF</button>
            <span className="pdrawer-updated">Last Update: {project.lastUpdate}</span>
          </div>
        </div>

        {/* Headline figures */}
        <div className="pdrawer-stats">
          {[
            ['Start Price',   project.price],
            ['Start BUA',     project.bua],
            ['Delivery',      project.delivery],
            ['Cash Discount', project.cashDiscount],
            ['Maintance',     project.maintenance],
            ['Parking Fees',  project.parking],
          ].map(([label, value]) => (
            <div key={label} className="pdrawer-stat">
              <span className="pdrawer-stat-label">{label}</span>
              <span className="pdrawer-stat-value">{value}</span>
            </div>
          ))}
        </div>

        {/* Explore tiles */}
        <div className="pdrawer-explore">
          <button type="button" className="pdrawer-tile"><IconPin /><span>Location</span></button>
          <button type="button" className="pdrawer-tile"><IconImage /><span>Gallery</span></button>
          <button type="button" className="pdrawer-tile"><IconVideo /><span>Video</span></button>
          <button type="button" className="pdrawer-tile pdrawer-tile--off" disabled><IconLayers /><span>Layouts</span></button>
        </div>
      </div>

      {/* Price list */}
      <section className="pdrawer-pricelist">
        <div className="pdrawer-pl-bar">
          <span className="pdrawer-pl-tab">Price List</span>
          <button type="button" className="pdrawer-pl-export">Export <IconDownload /></button>
          <button type="button" className="pdrawer-pl-expand" aria-label="Expand"><IconMaximize /></button>
        </div>

        <div className="pdrawer-table-wrap">
          <table className="pdrawer-table">
            <thead>
              <tr>
                {['Unit Code','Building No','Finishing','BUA','Floor','Bedrooms','Bathrooms',
                  'Outdoor','Garden','Roof','Terrace','Cash price','Highest Plan Price','PDF','Payment Plan']
                  .map(h => <th key={h}>{h}</th>)}
              </tr>
            </thead>
            <tbody>
              {units.map((u, i) => (
                <tr key={u.code + i}>
                  <td>{u.code}</td>
                  <td>{u.building}</td>
                  <td>{u.finishing}</td>
                  <td>{u.bua}</td>
                  <td>{u.floor}</td>
                  <td>{u.beds}</td>
                  <td>{u.baths}</td>
                  <td>{u.outdoor}</td>
                  <td>{u.garden}</td>
                  <td>{u.roof}</td>
                  <td>{u.terrace}</td>
                  <td>{u.cash}</td>
                  <td>{u.highest}</td>
                  <td><button type="button" className="pdrawer-cell-btn" aria-label="Download unit PDF"><IconDownload /></button></td>
                  <td><button type="button" className="pdrawer-cell-btn" aria-label="Open payment plan"><IconExternal /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </aside>
  )
}

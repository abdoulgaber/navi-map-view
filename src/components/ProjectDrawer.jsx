import { useEffect } from 'react'

const BADGE_CONFIG = {
  Trendy:    { icon: '🔥', color: '#FFFFFF', bg: '#EF476F' },
  Incentive: { icon: '💰', color: '#FFFFFF', bg: '#FF6006' },
}

const UNIT_ICONS = {
  Studio:     '🏠',
  Apartment:  '🏢',
  Duplex:     '🏘',
  Penthouse:  '🌆',
  Villa:      '🏡',
  'Twin House': '🏗',
  'Town House': '🏙',
}

const DUMMY_PRICE_ROWS = [
  { type: 'Studio',    area: '55',  floor: '2',  price: '2,100,000',  downPayment: '10%', years: '6',  monthly: '26,250',  total: '2,450,000' },
  { type: 'Apartment', area: '90',  floor: '3',  price: '3,850,000',  downPayment: '15%', years: '7',  monthly: '38,512',  total: '4,434,000' },
  { type: 'Apartment', area: '110', floor: '5',  price: '4,950,000',  downPayment: '15%', years: '7',  monthly: '49,500',  total: '5,693,000' },
  { type: 'Duplex',    area: '160', floor: '8',  price: '7,200,000',  downPayment: '20%', years: '8',  monthly: '60,000',  total: '8,064,000' },
  { type: 'Penthouse', area: '220', floor: '10', price: '12,500,000', downPayment: '25%', years: '10', monthly: '78,125',  total: '14,025,000' },
  { type: 'Villa',     area: '350', floor: 'G',  price: '18,000,000', downPayment: '30%', years: '7',  monthly: '150,000', total: '19,800,000' },
  { type: 'Twin House',area: '280', floor: 'G',  price: '14,500,000', downPayment: '25%', years: '8',  monthly: '113,281', total: '16,166,000' },
  { type: 'Town House',area: '210', floor: 'G',  price: '10,800,000', downPayment: '20%', years: '7',  monthly: '90,000',  total: '11,880,000' },
]

export default function ProjectDrawer({ project, onClose }) {
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  if (!project) return null

  return (
    <>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside className="drawer">
        {/* Header */}
        <div className="drawer-header">
          <div className="drawer-header-meta">
            <span className="drawer-developer">{project.developer}</span>
            <span className="drawer-location">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1C4.07 1 2.5 2.57 2.5 4.5C2.5 7 6 11 6 11C6 11 9.5 7 9.5 4.5C9.5 2.57 7.93 1 6 1ZM6 5.75C5.31 5.75 4.75 5.19 4.75 4.5C4.75 3.81 5.31 3.25 6 3.25C6.69 3.25 7.25 3.81 7.25 4.5C7.25 5.19 6.69 5.75 6 5.75Z" fill="#475467"/>
              </svg>
              {project.location}
            </span>
          </div>
          <button className="drawer-close" onClick={onClose} aria-label="Close">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M15 5L5 15M5 5L15 15" stroke="#475467" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>

        <div className="drawer-body">
          {/* Gallery */}
          <div className="drawer-gallery">
            <div className="drawer-gallery-main" style={{ background: 'linear-gradient(135deg, #e8edff 0%, #c7d2fe 100%)' }}>
              <span className="drawer-gallery-placeholder">📸</span>
            </div>
            <div className="drawer-gallery-side">
              <div className="drawer-gallery-thumb" style={{ background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)' }}>
                <span className="drawer-gallery-placeholder" style={{ fontSize: 20 }}>🌿</span>
              </div>
              <div className="drawer-gallery-thumb" style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #bbf7d0 100%)' }}>
                <span className="drawer-gallery-placeholder" style={{ fontSize: 20 }}>🏊</span>
              </div>
              <div className="drawer-gallery-thumb drawer-gallery-thumb--more" style={{ background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)' }}>
                <span>+12 Photos</span>
              </div>
            </div>
          </div>

          {/* Project title + badges */}
          <div className="drawer-title-row">
            <h2 className="drawer-title">{project.name}</h2>
            <div className="drawer-badges">
              {project.badges.map(b => {
                const cfg = BADGE_CONFIG[b] || {}
                return (
                  <span key={b} className="project-badge" style={{ color: cfg.color, background: cfg.bg }}>
                    {cfg.icon} {b}
                  </span>
                )
              })}
            </div>
          </div>

          <p className="drawer-description">{project.description}</p>

          {/* Stats grid */}
          <div className="drawer-stats">
            <div className="drawer-stat">
              <span className="drawer-stat-label">Start Price</span>
              <span className="drawer-stat-value">{project.price}</span>
            </div>
            <div className="drawer-stat">
              <span className="drawer-stat-label">Start BUA</span>
              <span className="drawer-stat-value">{project.bua}</span>
            </div>
            <div className="drawer-stat">
              <span className="drawer-stat-label">Delivery</span>
              <span className="drawer-stat-value">{project.delivery}</span>
            </div>
            <div className="drawer-stat">
              <span className="drawer-stat-label">Cash Discount</span>
              <span className="drawer-stat-value">{project.cashDiscount}</span>
            </div>
            <div className="drawer-stat">
              <span className="drawer-stat-label">Maintenance</span>
              <span className="drawer-stat-value">{project.maintenance}</span>
            </div>
            <div className="drawer-stat">
              <span className="drawer-stat-label">Parking</span>
              <span className="drawer-stat-value">{project.parking}</span>
            </div>
          </div>

          {/* Unit types */}
          <div className="drawer-units-section">
            <h3 className="drawer-section-title">Available Unit Types</h3>
            <div className="drawer-units">
              {project.units.map(u => (
                <div key={u} className="drawer-unit-chip">
                  <span>{UNIT_ICONS[u] || '🏠'}</span>
                  <span>{u}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Price list table */}
          <div className="drawer-pricelist-section">
            <div className="drawer-pricelist-header">
              <h3 className="drawer-section-title">Price List</h3>
              <span className="drawer-last-update">Last Update: {project.lastUpdate}</span>
            </div>
            <div className="drawer-table-wrapper">
              <table className="drawer-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Area M²</th>
                    <th>Floor</th>
                    <th>Price EGP</th>
                    <th>Down %</th>
                    <th>Years</th>
                    <th>Monthly EGP</th>
                    <th>Total EGP</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {DUMMY_PRICE_ROWS.map((row, i) => (
                    <tr key={i}>
                      <td>{row.type}</td>
                      <td>{row.area}</td>
                      <td>{row.floor}</td>
                      <td>{row.price}</td>
                      <td>{row.downPayment}</td>
                      <td>{row.years}</td>
                      <td>{row.monthly}</td>
                      <td>{row.total}</td>
                      <td>
                        <button className="table-action-btn" title="View details">
                          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                            <path d="M6 3L11 8L6 13" stroke="#475467" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                          </svg>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer CTA */}
        <div className="drawer-footer">
          <button className="btn-primary" style={{ flex: 1 }}>View Full Price List</button>
          <button className="btn-outline">Share</button>
        </div>
      </aside>
    </>
  )
}

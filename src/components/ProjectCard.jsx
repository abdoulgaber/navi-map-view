const BADGE_CONFIG = {
  Trendy:    { icon: '🔥', bg: '#EF476F', shadow: '0 2px 12px rgba(239,71,111,0.2)' },
  Incentive: { icon: '💰', bg: '#FF6006', shadow: '0 4px 12px rgba(255,96,6,0.1)' },
}

const TYPE_CONFIG = {
  Residential: { color: '#4C64FF', bg: '#E8EBFF' },
  Mixed:       { color: '#7C3AED', bg: '#F5F3FF' },
  Commercial:  { color: '#B45309', bg: '#FFFBEB' },
}

const PinIcon = () => (
  <svg width="12" height="14" viewBox="0 0 12 14" fill="none">
    <path d="M6 0.5C3.1 0.5 0.75 2.85 0.75 5.75C0.75 9.5 6 13.5 6 13.5C6 13.5 11.25 9.5 11.25 5.75C11.25 2.85 8.9 0.5 6 0.5Z" fill="#4C64FF"/>
    <circle cx="6" cy="5.75" r="1.9" fill="#FFFFFF"/>
  </svg>
)

const ListIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M4.5 3.5H12M4.5 7H12M4.5 10.5H12M2 3.5H2.006M2 7H2.006M2 10.5H2.006"
      stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

export default function ProjectCard({ project, active, compareSelected, onClick }) {
  const typeStyle = TYPE_CONFIG[project.type] || TYPE_CONFIG.Residential
  const deliveryLabel = project.deliveryValue === 0
    ? 'Ready Now'
    : `${project.deliveryValue}-Year Delivery`

  return (
    <article
      className={`pcard${active ? ' pcard--active' : ''}${compareSelected ? ' pcard--compare' : ''}`}
      onClick={() => onClick(project)}
    >
      {/* Floating badges over the top edge */}
      {project.badges.length > 0 && (
        <div className="pcard-badges">
          {project.badges.map(b => {
            const cfg = BADGE_CONFIG[b]
            return (
              <span
                key={b}
                className="pcard-badge"
                style={{ background: cfg.bg, boxShadow: cfg.shadow }}
              >
                {cfg.icon} {b}
              </span>
            )
          })}
        </div>
      )}

      {compareSelected && <span className="compare-check">✓</span>}

      <div className="pcard-head">
        <div className="pcard-logo" style={{ background: typeStyle.color }}>
          {project.developer.slice(0, 2).toUpperCase()}
        </div>

        <div className="pcard-info">
          <span className="pcard-dev">{project.developer}</span>
          <div className="pcard-titlerow">
            <span className="pcard-name">{project.name}</span>
            <span className="pcard-sep">|</span>
            <span className="pcard-loc"><PinIcon /> {project.location}</span>
            <span
              className="pcard-type"
              style={{ color: typeStyle.color, background: typeStyle.bg }}
            >
              {project.type}
            </span>
          </div>
        </div>

        <button type="button" className="pcard-pricelist" onClick={(e) => { e.stopPropagation(); onClick(project) }}>
          Price List <ListIcon />
        </button>
      </div>

      <p className="pcard-desc">{project.description}</p>

      <div className="pcard-stats">
        <span>Starting {project.price}</span>
        <span>Starting BUA {project.bua}</span>
        <span>{deliveryLabel}</span>
      </div>
    </article>
  )
}

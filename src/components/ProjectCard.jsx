const BADGE_CONFIG = {
  Trendy:    { icon: '🔥', color: '#FD853A', bg: '#FFF4ED' },
  Incentive: { icon: '💰', color: '#079455', bg: '#ECFDF3' },
}

const TYPE_CONFIG = {
  Residential: { color: '#4C64FF', bg: '#E8EBFF' },
  Mixed:       { color: '#7C3AED', bg: '#F5F3FF' },
  Commercial:  { color: '#B45309', bg: '#FFFBEB' },
}

export default function ProjectCard({ project, active, onClick }) {
  const typeStyle = TYPE_CONFIG[project.type] || TYPE_CONFIG.Residential

  return (
    <article
      className={`project-card${active ? ' project-card--active' : ''}`}
      onClick={() => onClick(project)}
    >
      {/* Top-right badges */}
      <div className="project-card-badges">
        {project.badges.map(b => {
          const cfg = BADGE_CONFIG[b] || {}
          return (
            <span key={b} className="project-badge" style={{ color: cfg.color, background: cfg.bg }}>
              {cfg.icon} {b}
            </span>
          )
        })}
      </div>

      <div className="project-card-header">
        <div
          className="project-card-avatar"
          style={{ background: typeStyle.color }}
        >
          {project.developer.slice(0, 2).toUpperCase()}
        </div>

        <div className="project-card-meta">
          <span className="project-card-developer">{project.developer}</span>

          {/* Name + type tag + location on one row */}
          <div className="project-card-title-row">
            <span className="project-card-name">{project.name}</span>

            {/* Project type tag */}
            <span
              className="project-type-tag"
              style={{ color: typeStyle.color, background: typeStyle.bg }}
            >
              {project.type}
            </span>

            <span className="project-card-sep">|</span>

            <span className="project-card-location">
              <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                <path d="M6 1C4.07 1 2.5 2.57 2.5 4.5C2.5 7 6 11 6 11S9.5 7 9.5 4.5C9.5 2.57 7.93 1 6 1Zm0 4.75A1.25 1.25 0 1 1 6 3.25a1.25 1.25 0 0 1 0 2.5Z" fill="#475467"/>
              </svg>
              {project.location}
            </span>
          </div>
        </div>
      </div>

      <p className="project-card-description">{project.description}</p>

      <div className="project-card-stats">
        <span>Starting {project.price}</span>
        <span className="project-card-dot">·</span>
        <span>BUA {project.bua}</span>
        <span className="project-card-dot">·</span>
        <span>{project.delivery}</span>
      </div>
    </article>
  )
}

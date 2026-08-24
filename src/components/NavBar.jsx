export default function NavBar() {
  const navItems = [
    { label: 'Project Availability' },
    { label: 'Maps', active: true, tag: 'New' },
    { label: 'Launches & Offers section' },
    { label: 'Units comparison' },
    { label: 'Units AI', suffix: '“Coming soon”', muted: true },
  ]

  return (
    <header className="navbar">
      <div className="navbar-logo">
        <span className="logo-engaz">ENGAZ</span>
        <span className="logo-navi">Navi</span>
      </div>

      <nav className="navbar-nav">
        {navItems.map(item => (
          <a
            key={item.label}
            href="#"
            className={`nav-link${item.active ? ' nav-link--active' : ''}${item.muted ? ' nav-link--muted' : ''}`}
          >
            {item.label}
            {item.suffix && <span className="nav-link-suffix"> {item.suffix}</span>}
            {item.tag && <sup className="nav-new-tag">{item.tag}</sup>}
          </a>
        ))}
      </nav>

      <div className="navbar-actions">
        <button className="btn-back-crm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6.5 3.5L3 7L6.5 10.5M3 7H10C11.6569 7 13 8.34315 13 10V12.5"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to CRM
        </button>
        <div className="navbar-avatar">AO</div>
      </div>
    </header>
  )
}

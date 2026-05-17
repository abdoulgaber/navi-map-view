export default function NavBar() {
  const navItems = [
    { label: 'Project Availability' },
    { label: 'Maps', active: true },
    { label: 'Launches & Offers' },
    { label: 'Units Comparison' },
    { label: 'Units AI', suffix: '– Coming soon' },
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
            className={`nav-link${item.active ? ' nav-link--active' : ''}`}
          >
            {item.label}
            {item.suffix && <span className="nav-link-suffix"> {item.suffix}</span>}
          </a>
        ))}
      </nav>

      <div className="navbar-actions">
        <button className="btn-back-crm">
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13 8H3M3 8L7 4M3 8L7 12" stroke="#4C64FF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back to CRM
        </button>
        <div className="navbar-avatar">AO</div>
      </div>
    </header>
  )
}

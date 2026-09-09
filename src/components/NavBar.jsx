import { useEffect, useState } from 'react'

const NAV_ITEMS = [
  { label: 'Project Availability' },
  { label: 'Maps', active: true, tag: 'New' },
  { label: 'Launches & Offers section' },
  { label: 'Units comparison' },
  { label: 'Units AI', suffix: '“Coming soon”', muted: true },
]

const IconBack = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
    <path d="M6.5 3.5L3 7L6.5 10.5M3 7H10C11.6569 7 13 8.34315 13 10V12.5"
      stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
)

const IconHelp = () => (
  <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
    <circle cx="9" cy="9" r="7" stroke="currentColor" strokeWidth="1.5"/>
    <path d="M7.2 6.9a1.9 1.9 0 1 1 2.6 1.75c-.5.2-.8.66-.8 1.2v.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    <circle cx="9" cy="12.6" r="0.8" fill="currentColor"/>
  </svg>
)

export default function NavBar() {
  const [menuOpen, setMenuOpen] = useState(false)

  // never leave the menu open behind a resize into the desktop layout
  useEffect(() => {
    const close = () => setMenuOpen(false)
    window.addEventListener('resize', close)
    return () => window.removeEventListener('resize', close)
  }, [])

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <>
      <header className="navbar">
        {/* compact layouts lead with the menu button instead of the nav */}
        <button
          type="button"
          className="navbar-burger"
          aria-label="Open menu"
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen(true)}
        >
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
          </svg>
        </button>

        <div className="navbar-logo">
          <span className="logo-engaz">ENGAZ</span>
          <span className="logo-navi">Navi</span>
        </div>

        <nav className="navbar-nav">
          {NAV_ITEMS.map(item => (
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
          <button type="button" className="navbar-help">
            <IconHelp /> <span>Need Help</span>
          </button>
          <button className="btn-back-crm">
            <IconBack />
            Back to CRM
          </button>
          <div className="navbar-avatar">AO</div>
        </div>
      </header>

      {/* Mobile / tablet menu */}
      {menuOpen && (
        <>
          <div className="navmenu-backdrop" onClick={() => setMenuOpen(false)} />
          <nav className="navmenu">
            <div className="navmenu-head">
              <div className="navbar-logo">
                <span className="logo-engaz">ENGAZ</span>
                <span className="logo-navi">Navi</span>
              </div>
              <button type="button" className="navmenu-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                  <path d="M13.5 4.5l-9 9M4.5 4.5l9 9" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"/>
                </svg>
              </button>
            </div>

            <div className="navmenu-links">
              {NAV_ITEMS.map(item => (
                <a
                  key={item.label}
                  href="#"
                  className={`navmenu-link${item.active ? ' navmenu-link--active' : ''}${item.muted ? ' navmenu-link--muted' : ''}`}
                  onClick={() => setMenuOpen(false)}
                >
                  {item.label}
                  {item.suffix && <span className="nav-link-suffix"> {item.suffix}</span>}
                  {item.tag && <sup className="nav-new-tag">{item.tag}</sup>}
                </a>
              ))}
            </div>

            <div className="navmenu-foot">
              <button className="btn-back-crm"><IconBack /> Back to CRM</button>
            </div>
          </nav>
        </>
      )}
    </>
  )
}

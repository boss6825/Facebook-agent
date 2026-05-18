import { useState } from 'react'
import {
  IconChat, IconDashboard, IconHistory, IconMoon, IconSettings, IconSun, IconZap,
} from './Icons.jsx'

const NAV_ITEMS = [
  { id: 'chat', label: 'Chat', icon: IconChat },
  { id: 'dashboard', label: 'Dashboard', icon: IconDashboard },
  { id: 'history', label: 'History', icon: IconHistory },
]

export default function Sidebar({
  currentPage,
  onNavigate,
  backendConnected,
  isSetup,
  onOpenSettings,
  theme,
  onToggleTheme,
}) {
  const [hoveredItem, setHoveredItem] = useState(null)
  const ThemeIcon = theme === 'dark' ? IconSun : IconMoon

  return (
    <aside style={styles.container}>
      <div style={styles.brand}>
        <div style={styles.logoCircle}>
          <IconZap size={18} />
        </div>
        <div style={styles.brandInfo}>
          <span style={styles.brandText}>FB Agent</span>
          <span style={styles.brandSub}>Social Autopilot</span>
        </div>
      </div>

      <nav style={styles.nav}>
        <div style={styles.navLabel}>MENU</div>
        {NAV_ITEMS.map((item) => {
          const isActive = currentPage === item.id
          const isHovered = hoveredItem === item.id
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              onMouseEnter={() => setHoveredItem(item.id)}
              onMouseLeave={() => setHoveredItem(null)}
              style={{
                ...styles.navItem,
                ...(isActive ? styles.navItemActive : {}),
                ...(isHovered && !isActive ? styles.navItemHover : {}),
              }}
            >
              <div
                style={{
                  ...styles.navIconWrap,
                  ...(isActive ? styles.navIconWrapActive : {}),
                }}
              >
                <Icon size={16} />
              </div>
              <span>{item.label}</span>
              {isActive && <div style={styles.activeIndicator} />}
            </button>
          )
        })}
      </nav>

      <div style={styles.bottomSection}>
        <button
          onClick={onToggleTheme}
          onMouseEnter={() => setHoveredItem('theme')}
          onMouseLeave={() => setHoveredItem(null)}
          style={{
            ...styles.navItem,
            ...(hoveredItem === 'theme' ? styles.navItemHover : {}),
          }}
        >
          <div style={styles.navIconWrap}>
            <ThemeIcon size={16} />
          </div>
          <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
        </button>

        <button
          onClick={onOpenSettings}
          onMouseEnter={() => setHoveredItem('settings')}
          onMouseLeave={() => setHoveredItem(null)}
          style={{
            ...styles.navItem,
            ...(hoveredItem === 'settings' ? styles.navItemHover : {}),
          }}
        >
          <div style={styles.navIconWrap}>
            <IconSettings size={16} />
          </div>
          <span>Settings</span>
        </button>

        <div style={styles.statusBar}>
          <div style={styles.statusDotOuter}>
            <div
              style={{
                ...styles.statusDot,
                background: backendConnected ? (isSetup ? '#10B981' : '#F59E0B') : '#EF4444',
                boxShadow: backendConnected
                  ? isSetup
                    ? '0 0 8px rgba(16, 185, 129, 0.4)'
                    : '0 0 8px rgba(245, 158, 11, 0.4)'
                  : '0 0 8px rgba(239, 68, 68, 0.4)',
              }}
            />
          </div>
          <span style={styles.statusText}>
            {backendConnected ? (isSetup ? 'Connected' : 'Setup needed') : 'Backend offline'}
          </span>
        </div>
      </div>
    </aside>
  )
}

const styles = {
  container: {
    width: 'var(--sidebar-width)',
    minWidth: 'var(--sidebar-width)',
    height: '100%',
    background: 'var(--sidebar-bg)',
    borderRight: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    padding: 0,
    userSelect: 'none',
  },
  brand: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '22px 20px 22px',
  },
  logoCircle: {
    width: 38,
    height: 38,
    borderRadius: 12,
    background: 'var(--primary-gradient)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: 'var(--shadow-primary)',
  },
  brandInfo: {
    display: 'flex',
    flexDirection: 'column',
  },
  brandText: {
    fontSize: 16,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.3px',
    lineHeight: 1.2,
  },
  brandSub: {
    fontSize: 11,
    color: 'var(--text-muted)',
    fontWeight: 600,
    marginTop: 1,
  },
  nav: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    padding: '8px 12px',
    flex: 1,
  },
  navLabel: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-muted)',
    letterSpacing: '0.1em',
    padding: '12px 12px 8px',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    padding: '9px 12px',
    borderRadius: 10,
    border: 'none',
    background: 'transparent',
    color: 'var(--text-secondary)',
    fontSize: 13.5,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 180ms ease',
    textAlign: 'left',
    width: '100%',
    position: 'relative',
  },
  navItemActive: {
    background: 'var(--primary-light)',
    color: 'var(--primary-text)',
    fontWeight: 600,
  },
  navItemHover: {
    background: 'var(--bg-muted)',
    color: 'var(--text)',
  },
  navIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 8,
    background: 'transparent',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 180ms ease',
    flexShrink: 0,
  },
  navIconWrapActive: {
    background: 'var(--primary)',
    color: '#fff',
    boxShadow: '0 2px 8px rgba(99, 102, 241, 0.3)',
  },
  activeIndicator: {
    position: 'absolute',
    right: 12,
    top: '50%',
    transform: 'translateY(-50%)',
    width: 5,
    height: 5,
    borderRadius: '50%',
    background: 'var(--primary)',
  },
  bottomSection: {
    padding: '12px 12px 18px',
    borderTop: '1px solid var(--border-subtle)',
    display: 'flex',
    flexDirection: 'column',
    gap: 6,
  },
  statusBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '10px 12px',
    borderRadius: 10,
    background: 'var(--bg-muted)',
  },
  statusDotOuter: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: '50%',
    flexShrink: 0,
  },
  statusText: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    fontWeight: 600,
  },
}

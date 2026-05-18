import { useState } from 'react'
import {
  IconAlertCircle, IconChat, IconCheck, IconHistory, IconLoader, IconRefresh,
} from './Icons.jsx'

export default function DashboardView({ tasks, onRefresh }) {
  const [hoveredCard, setHoveredCard] = useState(null)
  const taskList = Object.values(tasks).sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
  )
  const total = taskList.length
  const successful = taskList.filter((t) => t.status === 'done').length
  const failed = taskList.filter((t) => t.status === 'error').length
  const running = taskList.filter(
    (t) =>
      t.status === 'running' ||
      t.status === 'pending' ||
      t.status === 'processing' ||
      t.status === 'publishing' ||
      t.status === 'draft',
  ).length
  const rate = total > 0 ? Math.round((successful / total) * 100) : 0

  const statCards = [
    { label: 'Total Commands', value: total, sub: 'all time', color: 'var(--primary)', bg: 'var(--primary-light)', Icon: IconChat },
    { label: 'Successful', value: successful, sub: `${rate}% success rate`, color: 'var(--success)', bg: 'var(--success-light)', Icon: IconCheck },
    { label: 'Failed', value: failed, sub: `${total > 0 ? 100 - rate : 0}% failure rate`, color: 'var(--error)', bg: 'var(--error-light)', Icon: IconAlertCircle },
    { label: 'In Progress', value: running, sub: 'currently running', color: 'var(--warning)', bg: 'var(--warning-light)', Icon: IconLoader },
  ]

  const recentTasks = taskList.slice(0, 8)

  const statusColors = {
    done: { color: 'var(--success)', bg: 'var(--success-light)', label: 'Done' },
    error: { color: 'var(--error)', bg: 'var(--error-light)', label: 'Failed' },
    running: { color: 'var(--primary)', bg: 'var(--primary-light)', label: 'Running' },
    publishing: { color: 'var(--primary)', bg: 'var(--primary-light)', label: 'Publishing' },
    processing: { color: 'var(--primary)', bg: 'var(--primary-light)', label: 'Processing' },
    draft: { color: 'var(--primary)', bg: 'var(--primary-light)', label: 'Draft' },
    pending: { color: 'var(--warning)', bg: 'var(--warning-light)', label: 'Pending' },
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Dashboard</h1>
          <p style={styles.headerSub}>Overview of your agent activity</p>
        </div>
        <div style={styles.headerRight}>
          <button style={styles.refreshBtn} onClick={() => onRefresh?.()}>
            <IconRefresh size={14} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.statsGrid}>
          {statCards.map((card, i) => {
            const { Icon } = card
            const isHovered = hoveredCard === i
            return (
              <div
                key={i}
                style={{
                  ...styles.statCard,
                  animationDelay: `${i * 60}ms`,
                  transform: isHovered ? 'translateY(-2px)' : 'translateY(0)',
                  boxShadow: isHovered ? 'var(--shadow-md)' : 'var(--shadow-sm)',
                }}
                onMouseEnter={() => setHoveredCard(i)}
                onMouseLeave={() => setHoveredCard(null)}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 12,
                      background: card.bg,
                      color: card.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Icon size={18} />
                  </div>
                </div>
                <div style={styles.statValue}>{card.value}</div>
                <div style={styles.statLabel}>{card.label}</div>
                <div style={styles.statSub}>{card.sub}</div>
              </div>
            )
          })}
        </div>

        <div style={styles.section}>
          <h2 style={styles.sectionTitle}>Recent Activity</h2>
          {recentTasks.length === 0 ? (
            <div style={styles.emptyState}>
              <div style={{
                width: 48,
                height: 48,
                borderRadius: 14,
                background: 'var(--bg-muted)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'var(--text-muted)',
              }}>
                <IconHistory size={22} />
              </div>
              <p style={{ margin: 0, fontWeight: 500 }}>No activity yet</p>
              <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>Start by sending a command in Chat.</p>
            </div>
          ) : (
            <div style={styles.activityList}>
              {recentTasks.map((task, i) => {
                const sc = statusColors[task.status] || statusColors.pending
                const time = task.timestamp
                  ? new Date(task.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                  : ''
                const date = task.timestamp
                  ? new Date(task.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })
                  : ''
                return (
                  <div key={task.id || i} style={styles.activityItem}>
                    <div
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: '50%',
                        background: sc.color,
                        flexShrink: 0,
                        marginTop: 5,
                        boxShadow: `0 0 6px ${sc.color}`,
                      }}
                    />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={styles.activityCmd}>{task.command || 'Unknown command'}</div>
                      <div style={styles.activityTime}>
                        {date} {time}
                      </div>
                    </div>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: sc.color,
                        background: sc.bg,
                        padding: '4px 10px',
                        borderRadius: 8,
                        flexShrink: 0,
                      }}
                    >
                      {sc.label}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

const styles = {
  container: { display: 'flex', flexDirection: 'column', height: '100%', flex: 1 },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '20px 32px',
    borderBottom: '1px solid var(--border-subtle)',
    background: '#fff',
    flexShrink: 0,
  },
  title: { fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' },
  headerSub: { fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2, fontWeight: 400 },
  headerRight: { display: 'flex', gap: 8 },
  refreshBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 16px',
    borderRadius: 10,
    border: '1px solid var(--border)',
    background: '#fff',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 150ms',
    boxShadow: 'var(--shadow-xs)',
  },
  content: { flex: 1, overflowY: 'auto', padding: 32 },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(210px, 1fr))',
    gap: 16,
    marginBottom: 36,
  },
  statCard: {
    padding: 22,
    background: '#fff',
    border: '1px solid var(--border-subtle)',
    borderRadius: 16,
    animation: 'fadeInUp 400ms ease both',
    transition: 'all 250ms ease',
    cursor: 'default',
  },
  statLabel: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    marginTop: 4,
  },
  statValue: { fontSize: 34, fontWeight: 700, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1 },
  statSub: { fontSize: 12, color: 'var(--text-muted)', marginTop: 6 },
  section: {},
  sectionTitle: { fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 14, letterSpacing: '-0.2px' },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: '48px 20px',
    color: 'var(--text-secondary)',
    fontSize: 14,
    background: '#fff',
    borderRadius: 16,
    border: '1px dashed var(--border)',
  },
  activityList: {
    display: 'flex',
    flexDirection: 'column',
    border: '1px solid var(--border-subtle)',
    borderRadius: 14,
    background: '#fff',
    overflow: 'hidden',
    boxShadow: 'var(--shadow-xs)',
  },
  activityItem: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '14px 18px',
    borderBottom: '1px solid var(--border-subtle)',
    transition: 'background 150ms ease',
  },
  activityCmd: {
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  activityTime: { fontSize: 11, color: 'var(--text-muted)', marginTop: 2 },
}

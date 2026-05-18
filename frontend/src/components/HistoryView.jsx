import { useState } from 'react'
import {
  IconAlertCircle, IconCheck, IconHistory, IconLoader,
} from './Icons.jsx'

const STATUS_MAP = {
  done: { color: '#10B981', bg: '#ECFDF5', label: 'Completed', Icon: IconCheck },
  error: { color: '#EF4444', bg: '#FEF2F2', label: 'Failed', Icon: IconAlertCircle },
  running: { color: '#6366F1', bg: '#EEF2FF', label: 'Running', Icon: IconLoader },
  publishing: { color: '#6366F1', bg: '#EEF2FF', label: 'Publishing', Icon: IconLoader },
  processing: { color: '#6366F1', bg: '#EEF2FF', label: 'Processing', Icon: IconLoader },
  draft: { color: '#6366F1', bg: '#EEF2FF', label: 'Draft', Icon: IconLoader },
  pending: { color: '#F59E0B', bg: '#FFFBEB', label: 'Pending', Icon: IconHistory },
}

const isActive = (t) =>
  t.status === 'running' ||
  t.status === 'pending' ||
  t.status === 'processing' ||
  t.status === 'publishing' ||
  t.status === 'draft'

export default function HistoryView({ tasks }) {
  const [filter, setFilter] = useState('all')
  const taskList = Object.values(tasks).sort(
    (a, b) => (b.timestamp || 0) - (a.timestamp || 0),
  )

  const filtered =
    filter === 'all'
      ? taskList
      : taskList.filter((t) => (filter === 'active' ? isActive(t) : t.status === filter))

  const filters = [
    { id: 'all', label: 'All', count: taskList.length },
    { id: 'done', label: 'Completed', count: taskList.filter((t) => t.status === 'done').length },
    { id: 'error', label: 'Failed', count: taskList.filter((t) => t.status === 'error').length },
    { id: 'active', label: 'Active', count: taskList.filter(isActive).length },
  ]

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>History</h1>
          <p style={styles.headerSub}>Browse past commands and their results</p>
        </div>
      </div>

      <div style={styles.content}>
        <div style={styles.filterBar}>
          {filters.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              style={{
                ...styles.filterBtn,
                ...(filter === f.id ? styles.filterBtnActive : {}),
              }}
            >
              {f.label}
              <span
                style={{
                  ...styles.filterCount,
                  background: filter === f.id ? 'rgba(255,255,255,0.2)' : 'var(--bg-muted)',
                  color: filter === f.id ? '#fff' : 'var(--text-muted)',
                }}
              >
                {f.count}
              </span>
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
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
            <p style={{ margin: 0, fontWeight: 500 }}>
              {filter === 'all'
                ? 'No commands yet'
                : `No ${filter === 'active' ? 'active' : filter} tasks`}
            </p>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
              {filter === 'all'
                ? 'Start chatting to see history here.'
                : 'Try a different filter.'}
            </p>
          </div>
        ) : (
          <div style={styles.list}>
            {filtered.map((task, i) => {
              const sc = STATUS_MAP[task.status] || STATUS_MAP.pending
              const ts = task.timestamp ? new Date(task.timestamp) : null
              const timeStr = ts ? ts.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''
              const dateStr = ts
                ? ts.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })
                : ''
              const duration =
                task.completedAt && task.timestamp
                  ? `${Math.round((task.completedAt - task.timestamp) / 1000)}s`
                  : null
              const { Icon } = sc
              return (
                <div
                  key={task.id || i}
                  style={{
                    ...styles.taskItem,
                    animation: `slideInRight 300ms ease ${i * 40}ms both`,
                  }}
                >
                  <div
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 11,
                      background: sc.bg,
                      color: sc.color,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0,
                    }}
                  >
                    <Icon size={17} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={styles.taskCmd}>{task.command || 'Unknown'}</div>
                    <div style={styles.taskMeta}>
                      <span>
                        {dateStr} at {timeStr}
                      </span>
                      {duration && <span> · {duration}</span>}
                    </div>
                    {task.result && task.status === 'done' && (
                      <div style={styles.taskResult}>{task.result}</div>
                    )}
                    {(task.error || (task.result && task.status === 'error')) && (
                      <div style={{ ...styles.taskResult, color: '#DC2626' }}>
                        {task.error || task.result}
                      </div>
                    )}
                    {task.generated && task.status === 'done' && (
                      <div
                        style={{
                          marginTop: 8,
                          padding: '10px 12px',
                          background: 'var(--bg-alt)',
                          borderLeft: '3px solid var(--primary)',
                          borderRadius: '0 8px 8px 0',
                          fontSize: 12,
                          color: 'var(--text-secondary)',
                          lineHeight: 1.6,
                          whiteSpace: 'pre-wrap',
                        }}
                      >
                        {task.generated}
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 11,
                      fontWeight: 600,
                      color: sc.color,
                      background: sc.bg,
                      padding: '5px 12px',
                      borderRadius: 8,
                      flexShrink: 0,
                      whiteSpace: 'nowrap',
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
  content: { flex: 1, overflowY: 'auto', padding: 32 },
  filterBar: {
    display: 'flex',
    gap: 6,
    marginBottom: 20,
    flexWrap: 'wrap',
    background: 'var(--bg-muted)',
    padding: 4,
    borderRadius: 12,
    width: 'fit-content',
  },
  filterBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '8px 14px',
    borderRadius: 9,
    border: 'none',
    background: 'transparent',
    fontSize: 13,
    fontWeight: 500,
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    transition: 'all 180ms ease',
  },
  filterBtnActive: {
    background: 'var(--primary)',
    color: '#fff',
    boxShadow: 'var(--shadow-primary)',
  },
  filterCount: {
    fontSize: 11,
    fontWeight: 600,
    padding: '1px 7px',
    borderRadius: 6,
    minWidth: 20,
    textAlign: 'center',
  },
  emptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    padding: '52px 20px',
    color: 'var(--text-secondary)',
    fontSize: 14,
    background: '#fff',
    borderRadius: 16,
    border: '1px dashed var(--border)',
  },
  list: { display: 'flex', flexDirection: 'column', gap: 8 },
  taskItem: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 14,
    padding: '18px 20px',
    borderRadius: 14,
    border: '1px solid var(--border-subtle)',
    background: '#fff',
    transition: 'all 200ms ease',
    boxShadow: 'var(--shadow-xs)',
  },
  taskCmd: {
    fontSize: 14,
    fontWeight: 600,
    color: 'var(--text)',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
  },
  taskMeta: { fontSize: 12, color: 'var(--text-muted)', marginTop: 3 },
  taskResult: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginTop: 6,
    lineHeight: 1.6,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: '-webkit-box',
    WebkitLineClamp: 2,
    WebkitBoxOrient: 'vertical',
  },
}

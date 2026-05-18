import { useState } from 'react'
import { api } from '../api.js'
import {
  IconAlertCircle, IconCheck, IconClose, IconEye, IconEyeOff, IconLogout,
} from './Icons.jsx'

export default function CredentialModal({ isSetup, onClose, onSave, onLogout }) {
  const [pageId, setPageId] = useState('')
  const [pageAccessToken, setPageAccessToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loggingOut, setLoggingOut] = useState(false)

  async function handleSave() {
    if (!pageId.trim() || !pageAccessToken.trim()) {
      setError('Please fill in both fields')
      return
    }
    setSaving(true)
    setError('')
    setSuccess('')
    try {
      await api.saveCredentials(pageId.trim(), pageAccessToken.trim())
      onSave()
    } catch (e) {
      setError(e.message || 'Could not connect to backend')
    } finally {
      setSaving(false)
    }
  }

  async function handleLogout() {
    setLoggingOut(true)
    setError('')
    setSuccess('')
    try {
      await api.logout()
      setSuccess('Credentials removed successfully. You can connect another account now.')
      await onLogout?.()
    } catch (e) {
      setError(e.message || 'Failed to logout')
    } finally {
      setLoggingOut(false)
    }
  }

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={styles.header}>
          <h2 style={styles.title}>{isSetup ? 'Facebook Connection' : 'Connect Facebook'}</h2>
          <button style={styles.closeBtn} onClick={onClose} aria-label="Close">
            <IconClose size={18} />
          </button>
        </div>

        {isSetup ? (
          <div style={styles.body}>
            <div style={styles.connectedCard}>
              <div style={styles.connectedIcon}>
                <IconCheck size={20} />
              </div>
              <div>
                <div style={styles.connectedTitle}>Facebook Connected</div>
                <div style={styles.connectedSub}>
                  Your Page API credentials are stored locally on this server.
                </div>
              </div>
            </div>
            <button
              style={styles.logoutBtn}
              onClick={handleLogout}
              disabled={loggingOut}
            >
              <IconLogout size={16} />
              {loggingOut ? 'Disconnecting...' : 'Disconnect Page Token'}
            </button>
            {error && (
              <div style={styles.error}>
                <IconAlertCircle size={14} />
                {error}
              </div>
            )}
            {success && (
              <div style={styles.success}>
                <IconCheck size={14} />
                {success}
              </div>
            )}
          </div>
        ) : (
          <div style={styles.body}>
            <p style={styles.description}>
              Enter the Facebook Page ID and Page access token used by the Graph API.
              Add FACEBOOK_APP_SECRET in Backend/.env if your Meta app requires app secret proof.
            </p>

            <div style={styles.field}>
              <label style={styles.label}>Page ID</label>
              <input
                type="text"
                value={pageId}
                onChange={(e) => setPageId(e.target.value)}
                placeholder="123456789012345"
                style={styles.input}
                autoFocus
                onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-glow)' }}
                onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
              />
            </div>

            <div style={styles.field}>
              <label style={styles.label}>Page Access Token</label>
              <div style={styles.passwordWrap}>
                <input
                  type={showToken ? 'text' : 'password'}
                  value={pageAccessToken}
                  onChange={(e) => setPageAccessToken(e.target.value)}
                  placeholder="EAAB..."
                  style={{ ...styles.input, paddingRight: 44 }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()}
                  onFocus={(e) => { e.target.style.borderColor = 'var(--primary)'; e.target.style.boxShadow = '0 0 0 3px var(--primary-glow)' }}
                  onBlur={(e) => { e.target.style.borderColor = 'var(--border)'; e.target.style.boxShadow = 'none' }}
                />
                <button
                  style={styles.eyeBtn}
                  onClick={() => setShowToken(!showToken)}
                  type="button"
                  aria-label={showToken ? 'Hide token' : 'Show token'}
                >
                  {showToken ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>
            </div>

            {error && (
              <div style={styles.error}>
                <IconAlertCircle size={14} />
                {error}
              </div>
            )}
            {success && (
              <div style={styles.success}>
                <IconCheck size={14} />
                {success}
              </div>
            )}

            <button
              style={{
                ...styles.saveBtn,
                opacity: saving ? 0.7 : 1,
              }}
              onClick={handleSave}
              disabled={saving}
            >
              {saving ? 'Connecting...' : 'Connect Page'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(15, 23, 42, 0.5)',
    backdropFilter: 'blur(8px)',
    WebkitBackdropFilter: 'blur(8px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
    animation: 'fadeIn 200ms ease',
  },
  modal: {
    background: 'var(--bg-elevated)',
    borderRadius: 20,
    width: 440,
    maxWidth: '90vw',
    boxShadow: 'var(--shadow-xl)',
    animation: 'fadeInUp 300ms ease',
    overflow: 'hidden',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '22px 24px',
    borderBottom: '1px solid var(--border-subtle)',
  },
  title: {
    fontSize: 17,
    fontWeight: 700,
    color: 'var(--text)',
    letterSpacing: '-0.2px',
  },
  closeBtn: {
    background: 'var(--bg-muted)',
    border: 'none',
    color: 'var(--text-muted)',
    padding: 6,
    borderRadius: 8,
    display: 'flex',
    cursor: 'pointer',
    transition: 'all 150ms',
  },
  body: {
    padding: 24,
    display: 'flex',
    flexDirection: 'column',
    gap: 16,
  },
  description: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    lineHeight: 1.7,
  },
  field: { display: 'flex', flexDirection: 'column', gap: 7 },
  label: { fontSize: 13, fontWeight: 600, color: 'var(--text)' },
  input: {
    padding: '11px 14px',
    borderRadius: 11,
    border: '1.5px solid var(--border)',
    fontSize: 14,
    outline: 'none',
    transition: 'all 200ms ease',
    width: '100%',
    background: 'var(--bg-alt)',
    color: 'var(--text)',
  },
  passwordWrap: { position: 'relative' },
  eyeBtn: {
    position: 'absolute',
    right: 10,
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    padding: 4,
    display: 'flex',
    cursor: 'pointer',
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 13,
    color: 'var(--error)',
    padding: '10px 14px',
    background: 'var(--error-light)',
    borderRadius: 10,
  },
  success: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 13,
    color: 'var(--success-text)',
    padding: '10px 14px',
    background: 'var(--success-light)',
    borderRadius: 10,
    border: '1px solid #D1FAE5',
  },
  saveBtn: {
    padding: '12px 20px',
    borderRadius: 11,
    border: 'none',
    background: 'var(--primary-gradient)',
    color: '#fff',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 180ms ease',
    marginTop: 4,
    boxShadow: 'var(--shadow-primary)',
  },
  connectedCard: {
    display: 'flex',
    alignItems: 'center',
    gap: 14,
    padding: 18,
    background: 'var(--success-light)',
    borderRadius: 14,
    border: '1px solid #D1FAE5',
  },
  connectedIcon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    background: '#10B981',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
  },
  connectedTitle: { fontSize: 14, fontWeight: 600, color: 'var(--success-text)' },
  connectedSub: { fontSize: 12.5, color: 'var(--success-text)', marginTop: 2, lineHeight: 1.5 },
  logoutBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: 11,
    borderRadius: 11,
    border: '1.5px solid var(--border)',
    background: 'var(--bg-elevated)',
    color: 'var(--text-secondary)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    transition: 'all 150ms',
  },
}

import { useEffect, useRef, useState } from 'react'
import {
  IconAlertCircle, IconCheck, IconEdit, IconHistory, IconLoader, IconSend, IconZap,
} from './Icons.jsx'

const QUICK_ACTIONS = [
  'Post about AI trends on Facebook',
  'Post a company update',
]

const STATUS_CONFIG = {
  processing: { color: 'var(--primary)', bg: 'var(--primary-light)', label: 'Processing', Icon: IconLoader },
  pending: { color: 'var(--warning)', bg: 'var(--warning-light)', label: 'Queued', Icon: IconHistory },
  running: { color: 'var(--primary)', bg: 'var(--primary-light)', label: 'Running', Icon: IconLoader },
  publishing: { color: 'var(--primary)', bg: 'var(--primary-light)', label: 'Publishing', Icon: IconLoader },
  done: { color: 'var(--success)', bg: 'var(--success-light)', label: 'Completed', Icon: IconCheck },
  error: { color: 'var(--error)', bg: 'var(--error-light)', label: 'Failed', Icon: IconAlertCircle },
}

function normalizeFacebookUrl(raw) {
  const text = (raw || '').trim()
  if (!text) return null

  let value = text
  if (!/^https?:\/\//i.test(value)) value = `https://${value}`

  try {
    const parsed = new URL(value)
    const host = parsed.hostname.toLowerCase()
    const isFacebook = host === 'facebook.com' || host.endsWith('.facebook.com')
    const isFbWatch = host === 'fb.watch' || host.endsWith('.fb.watch')
    return isFacebook || isFbWatch ? parsed.toString() : null
  } catch {
    return null
  }
}

function isFacebookShareUrl(raw) {
  try {
    const parsed = new URL(raw)
    const parts = parsed.pathname.split('/').filter(Boolean)
    return parts.length >= 2 && parts[0].toLowerCase() === 'share'
  } catch {
    return false
  }
}

function ThinkingDots() {
  return (
    <div style={{ display: 'flex', gap: 5, padding: '4px 0' }}>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: 'var(--primary)',
            opacity: 0.6,
            animation: `pulse 1.4s ease-in-out ${i * 0.16}s infinite`,
          }}
        />
      ))}
    </div>
  )
}

function BotAvatar() {
  return (
    <div
      style={{
        width: 34,
        height: 34,
        borderRadius: 11,
        background: 'var(--primary-gradient)',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
        fontSize: 13,
        fontWeight: 700,
        boxShadow: '0 2px 8px rgba(99, 102, 241, 0.25)',
      }}
    >
      <IconZap size={15} />
    </div>
  )
}

function TaskStatusCard({ task }) {
  const cfg = STATUS_CONFIG[task.status] || STATUS_CONFIG.pending
  const { Icon } = cfg
  return (
    <div
      style={{
        border: `1px solid ${task.status === 'error' ? '#FECACA' : 'var(--border)'}`,
        borderRadius: 14,
        padding: '16px 18px',
        background: 'var(--bg-elevated)',
        maxWidth: 460,
        animation: 'fadeInUp 300ms ease',
        boxShadow: 'var(--shadow-sm)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div
          style={{
            width: 30,
            height: 30,
            borderRadius: 9,
            background: cfg.bg,
            color: cfg.color,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon size={15} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: cfg.color }}>{cfg.label}</span>
      </div>

      {task.result && task.status === 'done' && (
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.6, margin: 0 }}>
          {task.result}
        </p>
      )}
      {task.status === 'error' && (
        <p style={{ fontSize: 13, color: 'var(--error)', lineHeight: 1.6, margin: 0 }}>
          {task.error || task.result || 'Task failed.'}
        </p>
      )}
      {task.status === 'publishing' && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          {task.action === 'comment'
            ? 'Posting comment through the Graph API...'
            : 'Posting to the Page through the Graph API...'}
        </p>
      )}
      {task.status === 'running' && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Publishing through the Graph API...
        </p>
      )}
      {(task.status === 'pending' || task.status === 'processing') && (
        <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: 0 }}>
          Working on your command...
        </p>
      )}

      {task.generated && task.status === 'done' && (
        <div
          style={{
            marginTop: 12,
            padding: '12px 14px',
            background: 'var(--bg-alt)',
            borderLeft: '3px solid var(--primary)',
            borderRadius: '0 8px 8px 0',
            fontSize: 12.5,
            color: 'var(--text-secondary)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
          }}
        >
          <strong style={{ color: 'var(--text)', fontWeight: 600 }}>Published {task.action || 'content'}:</strong>
          <br />
          {task.generated}
        </div>
      )}
    </div>
  )
}

function DraftReviewCard({ draft, onPublish, onCancel, bubbleStyle }) {
  const [text, setText] = useState(draft.content || '')
  const publishing = draft.status === 'publishing'

  useEffect(() => {
    if (draft.content !== undefined) setText(draft.content)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft.id])

  return (
    <div
      style={{
        border: '1.5px solid var(--primary)',
        borderRadius: 16,
        padding: 18,
        background: 'var(--bg-elevated)',
        maxWidth: 500,
        animation: 'fadeInUp 300ms ease',
        boxShadow: '0 4px 20px rgba(99, 102, 241, 0.1)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 12 }}>
        <div
          style={{
            width: 28,
            height: 28,
            borderRadius: 8,
            background: 'var(--primary-light)',
            color: 'var(--primary-text)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <IconEdit size={13} />
        </div>
        <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--primary-text)' }}>
          Review draft — {draft.action || 'post'}
        </span>
      </div>

      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        disabled={publishing}
        rows={5}
        style={{
          width: '100%',
          background: 'var(--bg-alt)',
          border: '1.5px solid var(--border)',
          borderRadius: 10,
          padding: '12px 14px',
          fontSize: 14,
          color: 'var(--text)',
          outline: 'none',
          resize: 'vertical',
          minHeight: 100,
          lineHeight: 1.6,
          fontFamily: 'inherit',
          transition: 'border-color 200ms',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--primary)' }}
        onBlur={(e) => { e.target.style.borderColor = 'var(--border)' }}
      />

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 12,
        }}
      >
        <span style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 500 }}>{text.length} chars</span>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => onCancel(draft.id)}
            disabled={publishing}
            style={{
              padding: '8px 16px',
              borderRadius: 9,
              border: '1px solid var(--border)',
              background: 'var(--bg-elevated)',
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--text-secondary)',
              cursor: publishing ? 'not-allowed' : 'pointer',
              opacity: publishing ? 0.5 : 1,
              transition: 'all 150ms',
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onPublish(draft.id, text)}
            disabled={publishing || !text.trim()}
            style={{
              padding: '8px 18px',
              borderRadius: 9,
              border: 'none',
              background: publishing || !text.trim() ? 'var(--primary)' : 'var(--primary-gradient)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: publishing || !text.trim() ? 'not-allowed' : 'pointer',
              opacity: publishing || !text.trim() ? 0.55 : 1,
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              boxShadow: publishing || !text.trim() ? 'none' : 'var(--shadow-primary)',
              transition: 'all 150ms',
            }}
          >
            {publishing ? <IconLoader size={13} /> : null}
            {publishing ? 'Publishing...' : 'Publish'}
          </button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message, bubbleStyle, onPublishDraft, onCancelDraft }) {
  if (message.type === 'thinking') {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', animation: 'fadeInUp 200ms ease' }}>
        <BotAvatar />
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '6px 18px 18px 18px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          <ThinkingDots />
        </div>
      </div>
    )
  }

  if (message.type === 'task') {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', animation: 'fadeInUp 200ms ease' }}>
        <BotAvatar />
        <TaskStatusCard task={message.task} />
      </div>
    )
  }

  if (message.type === 'draft') {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', animation: 'fadeInUp 200ms ease' }}>
        <BotAvatar />
        <DraftReviewCard
          draft={message.draft}
          onPublish={onPublishDraft}
          onCancel={onCancelDraft}
          bubbleStyle={bubbleStyle}
        />
      </div>
    )
  }

  if (message.type === 'error') {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', animation: 'fadeInUp 200ms ease' }}>
        <BotAvatar />
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '6px 18px 18px 18px',
            background: 'var(--error-light)',
            border: '1px solid #FECACA',
            maxWidth: 460,
            fontSize: 14,
            color: 'var(--danger-text)',
            lineHeight: 1.6,
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  if (message.type === 'bot') {
    return (
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', animation: 'fadeInUp 200ms ease' }}>
        <BotAvatar />
        <div
          style={{
            padding: '14px 18px',
            borderRadius: '6px 18px 18px 18px',
            background: 'var(--bg-elevated)',
            border: '1px solid var(--border)',
            maxWidth: 500,
            fontSize: 14,
            color: 'var(--text)',
            lineHeight: 1.6,
            whiteSpace: 'pre-wrap',
            boxShadow: 'var(--shadow-xs)',
          }}
        >
          {message.content}
        </div>
      </div>
    )
  }

  // User message
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', animation: 'fadeInUp 200ms ease' }}>
      <div
        style={{
          padding: '14px 18px',
          borderRadius: '18px 18px 6px 18px',
          background: 'var(--primary-gradient)',
          color: '#fff',
          maxWidth: 500,
          fontSize: 14,
          lineHeight: 1.6,
          whiteSpace: 'pre-wrap',
          boxShadow: 'var(--shadow-primary)',
        }}
      >
        {message.content}
      </div>
    </div>
  )
}

function WelcomeMessage({ onPickPrompt }) {
  const [hoveredIdx, setHoveredIdx] = useState(null)
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        flex: 1,
        gap: 16,
        padding: 40,
        animation: 'fadeIn 600ms ease',
      }}
    >
      <div
        style={{
          width: 64,
          height: 64,
          borderRadius: 20,
          background: 'var(--primary-gradient)',
          color: '#fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(99, 102, 241, 0.3)',
          animation: 'subtleFloat 4s ease-in-out infinite',
        }}
      >
        <IconZap size={30} />
      </div>
      <h2 style={{ fontSize: 22, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
        FB Agent
      </h2>
      <p
        style={{
          fontSize: 14,
          color: 'var(--text-secondary)',
          textAlign: 'center',
          maxWidth: 380,
          lineHeight: 1.7,
        }}
      >
        Send a post command or switch to Comment mode to target a specific Facebook post link.
        Drafts are always generated for review before publishing.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12, width: '100%', maxWidth: 480 }}>
        {QUICK_ACTIONS.map((cmd, i) => (
          <button
            key={i}
            style={{
              padding: '12px 18px',
              borderRadius: 12,
              border: '1px solid var(--border)',
              background: hoveredIdx === i ? 'var(--primary-light)' : 'var(--bg-elevated)',
              fontSize: 13.5,
              fontWeight: 600,
              color: hoveredIdx === i ? 'var(--primary-text)' : 'var(--text-secondary)',
              cursor: 'pointer',
              transition: 'all 200ms ease',
              textAlign: 'left',
              lineHeight: 1.5,
              boxShadow: hoveredIdx === i ? '0 2px 8px rgba(99, 102, 241, 0.1)' : 'var(--shadow-xs)',
              borderColor: hoveredIdx === i ? 'var(--primary)' : 'var(--border)',
            }}
            onMouseEnter={() => setHoveredIdx(i)}
            onMouseLeave={() => setHoveredIdx(null)}
            onClick={() => onPickPrompt(cmd)}
          >
            <span style={{
              opacity: 0.5,
              marginRight: 8,
              fontSize: 12,
              fontWeight: 700,
              color: hoveredIdx === i ? 'var(--primary)' : 'var(--text-muted)',
            }}>
              {i + 1}.
            </span>
            {cmd}
          </button>
        ))}
      </div>
    </div>
  )
}

export default function ChatView({
  messages,
  onSendMessage,
  isSending,
  bubbleStyle = 'rounded',
  backendConnected,
  isSetup,
  onPublishDraft,
  onCancelDraft,
}) {
  const [composeMode, setComposeMode] = useState('command')
  const [inputValue, setInputValue] = useState('')
  const [commentUrl, setCommentUrl] = useState('')
  const [commentPrompt, setCommentPrompt] = useState('')
  const [urlError, setUrlError] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const messagesScrollRef = useRef(null)
  const inputRef = useRef(null)

  useEffect(() => {
    const el = messagesScrollRef.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    if (isSending) return

    if (composeMode === 'comment') {
      const brief = commentPrompt.trim()
      if (!brief) return

      const normalizedUrl = normalizeFacebookUrl(commentUrl)
      if (!normalizedUrl) {
        setUrlError('Enter a valid Facebook post URL from facebook.com or fb.watch.')
        return
      }
      setUrlError('')
      onSendMessage({
        mode: 'comment',
        targetUrl: normalizedUrl,
        contentBrief: brief,
        messagePreview: `Comment on ${normalizedUrl} saying: ${brief}`,
      })
      setCommentUrl('')
      setCommentPrompt('')
      return
    }

    const msg = inputValue.trim()
    if (!msg) return
    setInputValue('')
    onSendMessage(msg)
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const pickPrompt = (cmd) => {
    setComposeMode('command')
    setInputValue(cmd)
    setTimeout(() => inputRef.current?.focus(), 50)
  }

  const statusDot = backendConnected ? (isSetup ? 'var(--success)' : 'var(--warning)') : 'var(--error)'
  const statusLabel = backendConnected ? (isSetup ? 'Live' : 'Setup needed') : 'Offline'

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.headerTitle}>Chat</h1>
          <p style={styles.headerSub}>Send commands to manage your Facebook page</p>
        </div>
        <div style={styles.headerBadge}>
          <div style={{
            width: 7,
            height: 7,
            borderRadius: '50%',
            background: statusDot,
            boxShadow: `0 0 6px ${statusDot}`,
          }} />
          <span>{statusLabel}</span>
        </div>
      </div>

      <div style={styles.messagesArea} ref={messagesScrollRef}>
        {messages.length === 0 ? (
          <WelcomeMessage onPickPrompt={pickPrompt} />
        ) : (
          <div style={styles.messagesList}>
            {messages.map((msg, i) => (
              <MessageBubble
                key={msg.id || i}
                message={msg}
                bubbleStyle={bubbleStyle}
                onPublishDraft={onPublishDraft}
                onCancelDraft={onCancelDraft}
              />
            ))}
          </div>
        )}
      </div>

      <div style={styles.inputArea}>
        <div style={styles.modeSwitch}>
          {['command', 'comment'].map((mode) => (
            <button
              key={mode}
              onClick={() => setComposeMode(mode)}
              style={{
                ...styles.modeBtn,
                ...(composeMode === mode ? styles.modeBtnActive : {}),
              }}
              type="button"
            >
              {mode === 'command' ? 'Command' : 'Comment by Link'}
            </button>
          ))}
        </div>

        {composeMode === 'comment' ? (
          <div style={{
            ...styles.commentWrap,
            borderColor: inputFocused ? 'var(--primary)' : 'var(--border)',
            boxShadow: inputFocused ? '0 0 0 3px var(--primary-glow)' : 'var(--shadow-sm)',
          }}>
            <input
              type="text"
              value={commentUrl}
              onChange={(e) => {
                setCommentUrl(e.target.value)
                if (urlError) setUrlError('')
              }}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Facebook post URL (required)"
              style={{
                ...styles.input,
                ...(urlError ? styles.inputError : {}),
              }}
              disabled={isSending}
            />
            <div style={{ width: '100%', height: 1, background: 'var(--border-subtle)' }} />
            <div style={styles.commentPromptRow}>
              <input
                type="text"
                value={commentPrompt}
                onChange={(e) => setCommentPrompt(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                placeholder="What should the comment say?"
                style={styles.input}
                disabled={isSending}
              />
              <button
                onClick={handleSend}
                disabled={!commentPrompt.trim() || !commentUrl.trim() || isSending}
                style={{
                  ...styles.sendBtn,
                  opacity: commentPrompt.trim() && commentUrl.trim() && !isSending ? 1 : 0.35,
                  cursor:
                    !commentPrompt.trim() || !commentUrl.trim() || isSending
                      ? 'not-allowed'
                      : 'pointer',
                }}
                aria-label="Send comment task"
              >
                {isSending ? <IconLoader size={17} /> : <IconSend size={17} />}
              </button>
            </div>
            {urlError && <div style={styles.errorText}>{urlError}</div>}
          </div>
        ) : (
          <div style={{
            ...styles.inputWrap,
            borderColor: inputFocused ? 'var(--primary)' : 'var(--border)',
            boxShadow: inputFocused ? '0 0 0 3px var(--primary-glow)' : 'var(--shadow-sm)',
          }}>
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              placeholder="Type a command... e.g. 'post about AI trends'"
              style={styles.input}
              disabled={isSending}
            />
            <button
              onClick={handleSend}
              disabled={!inputValue.trim() || isSending}
              style={{
                ...styles.sendBtn,
                opacity: inputValue.trim() && !isSending ? 1 : 0.35,
                cursor: !inputValue.trim() || isSending ? 'not-allowed' : 'pointer',
              }}
              aria-label="Send"
            >
              {isSending ? <IconLoader size={17} /> : <IconSend size={17} />}
            </button>
          </div>
        )}
        <div style={styles.inputHint}>
          <kbd style={styles.kbd}>Enter</kbd>
          <span>to send</span>
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
    background: 'var(--bg-elevated)',
    flexShrink: 0,
  },
  headerTitle: { fontSize: 18, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.2px' },
  headerSub: { fontSize: 12.5, color: 'var(--text-muted)', marginTop: 2, fontWeight: 400 },
  headerBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: 7,
    fontSize: 12,
    color: 'var(--text-muted)',
    fontWeight: 500,
    padding: '6px 12px',
    borderRadius: 20,
    background: 'var(--bg-alt)',
    border: '1px solid var(--border-subtle)',
  },
  messagesArea: {
    flex: 1,
    overflowY: 'auto',
    padding: '28px 32px',
    display: 'flex',
    flexDirection: 'column',
    background: 'var(--bg-alt)',
  },
  messagesList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 18,
    maxWidth: 700,
    width: '100%',
    margin: '0 auto',
  },
  inputArea: {
    padding: '16px 32px 20px',
    borderTop: '1px solid var(--border-subtle)',
    background: 'var(--bg-elevated)',
    flexShrink: 0,
  },
  modeSwitch: {
    display: 'flex',
    gap: 4,
    maxWidth: 700,
    margin: '0 auto 12px',
    background: 'var(--bg-muted)',
    padding: 3,
    borderRadius: 10,
    width: 'fit-content',
  },
  modeBtn: {
    padding: '7px 16px',
    borderRadius: 8,
    border: 'none',
    background: 'transparent',
    fontSize: 12.5,
    fontWeight: 600,
    color: 'var(--text-muted)',
    cursor: 'pointer',
    transition: 'all 180ms ease',
  },
  modeBtnActive: {
    background: 'var(--bg-elevated)',
    color: 'var(--primary-text)',
    boxShadow: 'var(--shadow-sm)',
  },
  inputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    background: 'var(--bg-elevated)',
    border: '1.5px solid var(--border)',
    borderRadius: 14,
    padding: '4px 5px 4px 18px',
    maxWidth: 700,
    margin: '0 auto',
    transition: 'all 200ms ease',
  },
  commentWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    background: 'var(--bg-elevated)',
    border: '1.5px solid var(--border)',
    borderRadius: 14,
    padding: '6px 14px',
    maxWidth: 700,
    margin: '0 auto',
    transition: 'all 200ms ease',
  },
  commentPromptRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  input: {
    flex: 1,
    border: 'none',
    background: 'transparent',
    fontSize: 14,
    outline: 'none',
    color: 'var(--text)',
    padding: '10px 0',
  },
  inputError: {
    color: 'var(--danger-text)',
  },
  sendBtn: {
    width: 42,
    height: 42,
    borderRadius: 11,
    border: 'none',
    background: 'var(--primary-gradient)',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'all 180ms ease',
    flexShrink: 0,
    boxShadow: 'var(--shadow-primary)',
  },
  inputHint: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    fontSize: 11,
    color: 'var(--text-muted)',
    marginTop: 10,
  },
  kbd: {
    padding: '2px 6px',
    borderRadius: 5,
    border: '1px solid var(--border)',
    background: 'var(--bg-muted)',
    fontSize: 10,
    fontWeight: 600,
    fontFamily: 'inherit',
    color: 'var(--text-secondary)',
  },
  errorText: {
    fontSize: 12,
    color: 'var(--danger-text)',
    marginTop: 4,
    padding: '0 2px',
  },
}

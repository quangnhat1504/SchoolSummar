import { useEffect, useMemo, useState } from 'react'
import { Link, Route, Routes, useLocation, useNavigate, useParams } from 'react-router-dom'
import { Activity, ArrowRight, ArrowUpRight, BookOpen, BrainCircuit, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Copy, FileChartColumn, FileText, Folder, FolderOpen, FolderPlus, Grip, History, Menu, MessageCircle, MoreHorizontal, PanelRight, Plus, Search, Send, SlidersHorizontal, Sparkles, ThumbsDown, ThumbsUp, Trash2, X, ZoomIn, ZoomOut } from 'lucide-react'
import { Message, MessageContent, MessageResponse } from './components/ai-elements/message'
import { Conversation, ConversationContent } from './components/ai-elements/conversation'
import { collections, papers, processingSteps, sourceChunks, type Paper, type PaperStatus, type SourceChunk } from './data'
import { LandingPage } from './LandingPage'

const api = async (path: string, init?: RequestInit) => {
  const response = await fetch(path, { ...init, headers: { ...(init?.body instanceof FormData ? {} : { 'content-type': 'application/json' }), ...(init?.headers || {}) } })
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) throw new Error(payload.error?.message || 'Request failed')
  return payload.data
}

const toUiPaper = (paper: any, index = 0) => ({
  id: paper.id, title: paper.title || 'Untitled paper', authors: Array.isArray(paper.authors) ? paper.authors.join(', ') : paper.authors || 'Unknown authors', journal: paper.source || 'Research source', year: Number(paper.metadata?.year || new Date(paper.createdAt || Date.now()).getFullYear()), pages: Number(paper.pages || paper.metadata?.pages || 0), status: (paper.status || 'Processing') as PaperStatus, added: paper.added || 'Just now', collection: paper.collection || paper.metadata?.collection || 'Uncategorized', color: paper.color || ['#d9f5e9', '#e6e8ff', '#fff0c9', '#f5dce9'][index % 4],
})

const projectStorageKey = 'research-rag-projects'
const localPaperStorageKey = 'research-rag-local-papers'
const projectUpdatedEvent = 'research-rag-projects-updated'

const readProjects = () => {
  if (typeof window === 'undefined') return collections
  try {
    const stored = JSON.parse(window.localStorage.getItem(projectStorageKey) || 'null')
    return Array.isArray(stored) && stored.length ? stored : collections
  } catch { return collections }
}

const readLocalPapers = (): Paper[] => {
  if (typeof window === 'undefined') return []
  try {
    const stored = JSON.parse(window.localStorage.getItem(localPaperStorageKey) || '[]')
    return Array.isArray(stored) ? stored : []
  } catch { return [] }
}

const persistProjects = (next: typeof collections) => {
  window.localStorage.setItem(projectStorageKey, JSON.stringify(next))
  window.dispatchEvent(new Event(projectUpdatedEvent))
}

const persistLocalPapers = (next: Paper[]) => window.localStorage.setItem(localPaperStorageKey, JSON.stringify(next))

function useProjects() {
  const [projects, setProjects] = useState(readProjects)
  useEffect(() => {
    const sync = () => setProjects(readProjects())
    window.addEventListener('storage', sync)
    window.addEventListener(projectUpdatedEvent, sync)
    return () => { window.removeEventListener('storage', sync); window.removeEventListener(projectUpdatedEvent, sync) }
  }, [])
  return projects
}

type AuthUser = { id: string; email: string | null; displayName: string }
type ChatSession = { id: string; title: string; project?: string; createdAt?: string; created_at?: string; updatedAt?: string; updated_at?: string }

const slugify = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
const sessionDate = (session: ChatSession) => {
  const value = session.updatedAt || session.updated_at || session.createdAt || session.created_at
  if (!value) return 'New'
  const date = new Date(value)
  const today = new Date()
  if (date.toDateString() === today.toDateString()) return `Today · ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
  return date.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function Brand() { return <Link className="brand" to="/workspace"><span className="brand-mark"><span /><span /><span /></span><span><strong>RAG Research</strong><small>Assistant</small></span></Link> }
function IconButton({ label, children, onClick }: { label: string; children: React.ReactNode; onClick?: () => void }) { return <button className="icon-button" aria-label={label} title={label} onClick={onClick}>{children}</button> }
function StatusDot({ status }: { status: PaperStatus | string }) { const tone = status === 'Ready' || status === 'Complete' || status === 'OCR complete' || status === 'Embeddings ready' ? 'ready' : status === 'Needs review' ? 'review' : status === 'Failed' ? 'failed' : 'processing'; return <span className={`status-dot ${tone}`}><span />{status}</span> }

function Sidebar({ user, onLogout, onClose }: { user: AuthUser; onLogout: () => void; onClose?: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const projects = useProjects()
  const query = new URLSearchParams(location.search)
  const selectedProject = projects.find((project) => slugify(project.name) === query.get('project'))?.name ?? projects[0].name
  const selectedChat = query.get('chat')
  const [history, setHistory] = useState<ChatSession[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    let active = true
    setHistoryLoading(true)
    void api(`/api/v1/sessions?project=${encodeURIComponent(slugify(selectedProject))}`)
      .then((sessions) => { if (active) setHistory(Array.isArray(sessions) ? sessions : []) })
      .catch(() => { if (active) setHistory([]) })
      .finally(() => { if (active) setHistoryLoading(false) })
    return () => { active = false }
  }, [selectedProject, location.pathname, location.search])

  const openProject = (projectName: string) => {
    navigate(`/workspace?project=${slugify(projectName)}`)
    onClose?.()
  }

  return <aside className="sidebar">
    <div className="sidebar-top"><Brand />{onClose && <IconButton label="Close menu" onClick={onClose}><X size={18} /></IconButton>}</div>
    <button className="workspace-switcher"><span className="workspace-avatar">QM</span><span><b>Quantum Materials Lab</b><small>Personal workspace</small></span><ChevronDown size={15} /></button>

    <section className="sidebar-section projects-section" aria-labelledby="projects-label">
      <div className="sidebar-section-heading"><span id="projects-label">Projects</span><IconButton label="Manage projects and documents" onClick={() => { navigate('/documents'); onClose?.() }}><Plus size={15} /></IconButton></div>
      <div className="project-list">
        {projects.map((project) => <button className={`project-item ${project.name === selectedProject ? 'active' : ''}`} key={project.name} onClick={() => openProject(project.name)}>
          <span className="project-icon" style={{ color: project.accent, background: `${project.accent}18` }}><FolderOpen size={16} /></span>
          <span className="project-copy"><strong>{project.name}</strong><small>{project.count} {project.count === 1 ? 'paper' : 'papers'}</small></span>
          {project.name === selectedProject && <span className="project-active-dot" aria-label="Selected project" />}
        </button>)}
      </div>
    </section>

    <section className="sidebar-section history-section" aria-labelledby="chat-history-label">
      <div className="sidebar-section-heading"><span id="chat-history-label">Chat history</span><History size={15} /></div>
      <nav className="chat-history-list" aria-label={`${selectedProject} chat history`}>
        {historyLoading && <span className="chat-history-empty">Loading conversations…</span>}
        {!historyLoading && history.length === 0 && <span className="chat-history-empty"><MessageCircle size={14} /> No chats in this project yet</span>}
        {!historyLoading && history.map((chat) => <Link className={`chat-history-item ${selectedChat === chat.id ? 'active' : ''}`} to={`/workspace?project=${slugify(selectedProject)}&chat=${chat.id}`} key={chat.id} onClick={onClose}>
          <span className="history-item-icon"><MessageCircle size={14} /></span><span className="history-item-copy"><strong>{chat.title}</strong><small>{sessionDate(chat)}</small></span>
        </Link>)}
      </nav>
    </section>

    <div className="sidebar-spacer" />
    <button className="profile-card" onClick={onLogout} aria-label="Sign out" title="Sign out"><span className="profile-avatar">{(user.displayName || 'R').slice(0, 2).toUpperCase()}</span><span><b>{user.displayName}</b><small>{user.email || 'Demo workspace'}</small></span><ChevronDown size={15} /></button>
  </aside>
}

function AuthPage({ onAuthenticated }: { onAuthenticated: (user: AuthUser) => void }) {
  const navigate = useNavigate()
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [displayName, setDisplayName] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      const result = await api(`/api/v1/auth/${mode === 'login' ? 'login' : 'register'}`, {
        method: 'POST',
        body: JSON.stringify(mode === 'login' ? { email, password } : { email, password, displayName }),
      })
      onAuthenticated(result.user)
      navigate('/workspace')
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to authenticate')
    } finally {
      setSubmitting(false)
    }
  }

  return <main className="auth-page">
    <section className="auth-visual" aria-label="Research RAG features">
      <div className="auth-grid-glow" aria-hidden="true" />
      <div className="auth-orbit-map" aria-hidden="true"><span className="auth-orbit" /><span className="auth-orbit auth-orbit-small" /><i className="auth-orbit-node auth-node-a" /><i className="auth-orbit-node auth-node-b" /><i className="auth-orbit-node auth-node-c" /><span className="auth-orbit-core">R</span></div>
      <Brand />
      <div className="auth-visual-copy"><span className="eyebrow">PRIVATE RESEARCH WORKSPACE</span><h1>Keep every idea<br /><em>close to the evidence.</em></h1><p>Your papers, questions, and grounded answers stay organized in one calm workspace.</p><div className="auth-signal-line"><span className="auth-signal-pulse" /> <span>YOUR LIBRARY IS READY TO CONNECT</span><b>03</b></div></div>
      <div className="auth-proof-card"><div className="auth-proof-top"><span className="auth-proof-dot" /> PERSONAL LIBRARY <span>SECURE</span></div><strong>Research continuity</strong><p>Pick up a conversation exactly where you left it, across every project.</p><div className="auth-proof-lines"><i /><i /><i /></div></div>
      <div className="auth-visual-footer"><span className="auth-visual-note">Built for deeper reading · cited by default</span><span className="auth-footer-mark">RAG / 01</span></div>
    </section>
    <section className="auth-panel"><div className="auth-panel-inner">
      <div className="auth-panel-topline"><span><i /> ENCRYPTED WORKSPACE</span><b>LOCAL SESSION</b></div>
      <div className="auth-heading"><span className="eyebrow">{mode === 'login' ? 'WELCOME BACK' : 'START RESEARCHING'}</span><h2>{mode === 'login' ? 'Sign in to your workspace' : 'Create your research space'}</h2><p>{mode === 'login' ? 'Continue your projects and conversations.' : 'A private home for the questions worth pursuing.'}</p></div>
      <form className="auth-form" onSubmit={submit}>
        {mode === 'register' && <label>Name<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="Avery Kim" autoComplete="name" required /></label>}
        <label>Email<input value={email} onChange={(event) => setEmail(event.target.value)} type="email" placeholder="you@example.com" autoComplete="email" required /></label>
        <label>Password<input value={password} onChange={(event) => setPassword(event.target.value)} type="password" placeholder="At least 5 characters" autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={5} required />{mode === 'register' && <small className="password-hint"><span /> Five characters is enough to begin.</small>}</label>
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="auth-submit" type="submit" disabled={submitting}>{submitting ? 'Preparing your workspace…' : mode === 'login' ? 'Sign in' : 'Create account'}<ArrowRight size={16} /></button>
      </form>
      <p className="auth-switch">{mode === 'login' ? 'New to Research RAG?' : 'Already have an account?'} <button type="button" onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError('') }}>{mode === 'login' ? 'Create an account' : 'Sign in instead'}</button></p>
      <p className="auth-privacy"><CheckCircle2 size={14} /> Your account keeps papers and chats scoped to you.</p>
    </div></section>
  </main>
}

function Topbar({ title, subtitle, action, onMenu }: { title: string; subtitle?: string; action?: React.ReactNode; onMenu?: () => void }) { return <header className="page-topbar"><div className="topbar-title">{onMenu && <IconButton label="Open menu" onClick={onMenu}><Menu size={19} /></IconButton>}<div><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div></div>{action}</header> }
function Pipeline({ compact = false }: { compact?: boolean }) { return <section className={`pipeline ${compact ? 'compact' : ''}`}><div className="pipeline-header"><div><h2>Processing pipeline</h2><span>All up to date <CheckCircle2 size={14} /></span></div><Link to="/processing">View all jobs <ArrowRight size={14} /></Link></div><div className="pipeline-steps">{processingSteps.map((step, i) => <div className="pipeline-step" key={step.label}><div className={`step-icon ${step.icon}`}>{step.icon === 'layout' ? <Grip size={19} /> : step.icon === 'ocr' ? <b className="ocr-icon">T</b> : step.icon === 'chunk' ? <FileChartColumn size={19} /> : <BrainCircuit size={19} />}</div><div><strong>{i + 1}. {step.label}</strong>{!compact && <p>{step.detail}</p>}<span><CheckCircle2 size={13} />{step.status}</span></div>{i < 3 && <i className="step-connector" />}</div>)}</div></section> }

function PdfPreview({ page }: { page: number }) { return <div className="pdf-preview"><div className="pdf-paper"><div className="pdf-running-head">NATURE NEUROSCIENCE <span>RESULTS</span></div><h4>3.2 Attention and consolidation</h4><div className="pdf-lines">{Array.from({ length: 10 }).map((_, i) => <i key={i} />)}</div><div className="pdf-highlight">Items encoded under high attentional focus showed significantly greater stabilization of neural representations during sleep compared to low-attention encoding conditions.</div><div className="pdf-lines short">{Array.from({ length: 6 }).map((_, i) => <i key={i} />)}</div><small>{page}</small></div></div> }
function SourceInspector({ source, index, onSelect, onClose }: { source: SourceChunk; index: number; onSelect: (index: number) => void; onClose: () => void }) { return <aside className="source-inspector"><div className="inspector-header"><h2>Sources</h2><IconButton label="Close sources" onClick={onClose}><X size={17} /></IconButton></div><div className="source-pager"><span><ChevronLeft size={13} /> {index + 1} of {sourceChunks.length} <ChevronRight size={13} /></span><div><IconButton label="Previous source" onClick={() => onSelect(index ? index - 1 : 1)}><ChevronLeft size={15} /></IconButton><IconButton label="Next source" onClick={() => onSelect((index + 1) % 2)}><ChevronRight size={15} /></IconButton></div></div><div className="source-title-row"><span className="source-number">{index + 1}</span><div><h3>{source.title}</h3><p>{source.authors}, {source.journal}</p></div></div><div className="source-meta"><span><FileText size={14} /> Page {source.page}</span><span className="chunk-chip">Chunk 04</span><IconButton label="Open source"><ArrowUpRight size={15} /></IconButton></div><PdfPreview page={source.page} /><div className="pdf-controls"><IconButton label="Zoom out"><ZoomOut size={15} /></IconButton><span>100%</span><IconButton label="Zoom in"><ZoomIn size={15} /></IconButton><IconButton label="Fullscreen"><Grip size={15} /></IconButton></div><div className="inspector-section"><div className="section-heading"><h3>Selected passage</h3><IconButton label="Copy passage"><Copy size={14} /></IconButton></div><div className="passage-box">{source.passage}</div></div><div className="chunk-meta"><div><span>Chunk ID</span><code>{source.id}</code></div><div><span>Retrieval score</span><code>{source.score.toFixed(2)}</code></div></div><details className="why-source" open><summary>Why this source <ChevronDown size={15} /></summary><p>{source.reason}</p></details></aside> }

function Workspace({ onMenu }: { onMenu: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const query = new URLSearchParams(location.search)
  const projectKey = query.get('project') || slugify(collections[0].name)
  const requestedSessionId = query.get('chat')
  const [selected, setSelected] = useState(0)
  const [selectedModel, setSelectedModel] = useState('llama-3.1-8b-instant')
  const [question, setQuestion] = useState('')
  const [sending, setSending] = useState(false)
  const [sourcesOpen, setSourcesOpen] = useState(() => window.innerWidth > 760)
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<Array<{ id: string; role: 'user' | 'assistant'; content: string }>>([])
  const [error, setError] = useState('')

  useEffect(() => {
    let socket: WebSocket | undefined
    let disposed = false
    const load = async () => {
      try {
        const available = await api(`/api/v1/sessions?project=${encodeURIComponent(projectKey)}`)
        if (disposed) return
        let session: ChatSession | null = (available as ChatSession[]).find((item) => item.id === requestedSessionId) || null
        if (!session) session = (available as ChatSession[])[0] || null
        if (!session) {
          const createdSession: ChatSession = await api('/api/v1/sessions', { method: 'POST', body: JSON.stringify({ title: 'New research thread', project: projectKey }) })
          if (disposed) return
          session = createdSession
          navigate(`/workspace?project=${projectKey}&chat=${createdSession.id}`, { replace: true })
        }
        if (!session) throw new Error('Unable to open a research conversation')
        if (disposed) return
        const activeSession = session
        setSessionId(activeSession.id)
        const history = await api(`/api/v1/sessions/${activeSession.id}/messages`)
        setMessages(history.map((message: any) => ({ id: message.id, role: message.role, content: message.content })))
        const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws'
        socket = new WebSocket(`${protocol}://${window.location.host}/realtime`)
        socket.onmessage = (event) => {
          const message = JSON.parse(event.data)
          if (message.type === 'chat.started') setSending(true)
          if (message.type === 'chat.delta') setMessages((current) => { const found = current.find((item) => item.id === message.payload.messageId); if (found) return current.map((item) => item.id === found.id ? { ...item, content: item.content + message.payload.delta } : item); return [...current, { id: message.payload.messageId, role: 'assistant', content: message.payload.delta }] })
          if (message.type === 'chat.completed' || message.type === 'chat.failed') setSending(false)
        }
      } catch (loadError) { if (!disposed) setError(loadError instanceof Error ? loadError.message : 'Unable to connect to the research backend') }
    }
    void load()
    return () => { disposed = true; socket?.close() }
  }, [navigate, projectKey, requestedSessionId])

  const createNewChat = async () => {
    if (sending) return
    try {
      const session = await api('/api/v1/sessions', { method: 'POST', body: JSON.stringify({ title: 'New research thread', project: projectKey }) })
      setMessages([])
      setError('')
      navigate(`/workspace?project=${projectKey}&chat=${session.id}`)
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : 'Unable to start a new chat')
    }
  }

  const send = async () => {
    const content = question.trim()
    if (!content || !sessionId || sending) return
    setQuestion(''); setError(''); setSending(true)
    const optimistic = { id: `local-${Date.now()}`, role: 'user' as const, content }
    setMessages((current) => [...current, optimistic])
    try { await api(`/api/v1/sessions/${sessionId}/messages`, { method: 'POST', body: JSON.stringify({ content }) }) }
    catch (sendError) { setSending(false); setError(sendError instanceof Error ? sendError.message : 'Unable to send question') }
  }

  return (
    <div className="workspace-page">
      <Topbar
        title="Ask your papers"
        subtitle="Ask questions across your library. Answers are grounded in your sources."
        onMenu={onMenu}
        action={<div className="topbar-actions"><button className="outline-button" onClick={() => void createNewChat()}><Plus size={16} /> New chat</button><IconButton label="Toggle sources" onClick={() => setSourcesOpen(!sourcesOpen)}><PanelRight size={17} /></IconButton></div>}
      />
      <div className={`workspace-grid ${sourcesOpen ? '' : 'sources-hidden'}`}>
        <main className="conversation-pane">
          <Pipeline compact />
          <Conversation className="conversation-shell">
            <ConversationContent className="conversation-content">
              {messages.length === 0 && (
                <div className="empty-state">
                  <div className="empty-state-mark"><Sparkles size={20} /></div>
                  <div className="empty-state-copy">
                    <span className="empty-state-label">RESEARCH COPILOT</span>
                    <strong>Start with a question</strong>
                    <span>Ask about findings, methods, or connections across your papers.</span>
                  </div>
                  <div className="empty-state-features" aria-label="Research assistant features">
                    <span><FileText size={13} /> Grounded in your library</span>
                    <span><Sparkles size={13} /> Cited answers</span>
                  </div>
                </div>
              )}
              {messages.map((message) => (
                <Message key={message.id} from={message.role} className={message.role === 'user' ? 'user-message' : 'assistant-message'}>
                  {message.role === 'assistant' && <div className="assistant-avatar"><Sparkles size={15} /></div>}
                  <MessageContent className={message.role === 'user' ? 'user-bubble' : 'answer-content'}>
                    {message.role === 'assistant' ? <MessageResponse>{message.content}</MessageResponse> : message.content}
                  </MessageContent>
                  {message.role === 'assistant' && (
                    <div className="message-actions">
                      <IconButton label="Helpful"><ThumbsUp size={15} /></IconButton>
                      <IconButton label="Not helpful"><ThumbsDown size={15} /></IconButton>
                      <IconButton label="Copy answer"><Copy size={15} /></IconButton>
                    </div>
                  )}
                </Message>
              ))}
              {sending && (
                <Message from="assistant" className="assistant-message">
                  <div className="assistant-avatar"><Sparkles size={15} /></div>
                  <MessageContent className="answer-content"><span className="typing-dots"><i /><i /><i /></span></MessageContent>
                </Message>
              )}
            </ConversationContent>
          </Conversation>
          <div className="composer-wrap">
            <div className="composer">
              <label className="sr-only" htmlFor="research-question">Ask your research library</label>
              <textarea
                id="research-question"
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    void send()
                  }
                }}
                placeholder="Ask a follow-up question..."
                rows={1}
              />
              <div className="composer-footer">
                <select className="model-select" aria-label="Select model" value={selectedModel} onChange={e => setSelectedModel(e.target.value)}>
                  <option value="llama-3.1-8b-instant">Llama 3.1 8B</option>
                  <option value="llama-3.3-70b-versatile">Llama 3.3 70B</option>
                  <option value="mixtral-8x7b-32768">Mixtral 8x7B</option>
                </select>
                <button className={`send-button ${question.trim() ? 'ready' : ''}`} aria-label="Send question" onClick={() => void send()} disabled={!question.trim() || sending}>
                  <Send size={16} />
                </button>
              </div>
            </div>
            {error && <p className="form-error" role="alert">{error}</p>}
            <p className="grounding-note">Answers are grounded in your papers. Please verify important information.</p>
          </div>
        </main>
        {sourcesOpen && <SourceInspector source={sourceChunks[selected]} index={selected} onSelect={setSelected} onClose={() => setSourcesOpen(false)} />}
      </div>
    </div>
  )
}

function Papers({ onMenu }: { onMenu: () => void }) { const [query, setQuery] = useState(''); const [remote, setRemote] = useState<typeof papers | null>(null); const [error, setError] = useState(''); useEffect(() => { void api('/api/v1/papers').then((payload) => setRemote(payload.items.map(toUiPaper))).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load papers')) }, []); const source = remote || papers; const filtered = useMemo(() => source.filter(p => `${p.title} ${p.authors}`.toLowerCase().includes(query.toLowerCase())), [query, source]); return <div className="page-content"><Topbar title="Papers" subtitle="Your research library, ready for grounded answers." onMenu={onMenu} /><div className="library-toolbar"><div className="search-field"><Search size={16} /><input aria-label="Search papers" value={query} onChange={e => setQuery(e.target.value)} placeholder="Search papers, authors, DOI..." /></div><button className="filter-button"><SlidersHorizontal size={15} /> Filters</button><select aria-label="Filter papers"><option>All papers</option><option>Ready</option><option>Processing</option></select></div>{error && <p className="form-error" role="alert">{error}</p>}<div className="paper-summary"><div><span className="eyebrow">LIBRARY</span><strong>{filtered.length} papers</strong></div><span>Live data · updated just now</span></div><div className="paper-table"><div className="paper-table-head"><span>Paper</span><span>Collection</span><span>Pages</span><span>Status</span><span>Added</span><span /></div>{filtered.map(p => <Link className="paper-row" to={`/papers/${p.id}`} key={p.id}><span className="paper-info"><span className="paper-icon" style={{ background: p.color }}><FileText size={18} /></span><span><strong>{p.title}</strong><small>{p.authors} · {p.journal}, {p.year}</small></span></span><span className="collection-cell"><Folder size={14} />{p.collection}</span><span className="muted-cell">{p.pages || '—'} pages</span><StatusDot status={p.status} /><span className="muted-cell">{p.added}</span><ArrowUpRight size={16} className="row-arrow" /></Link>)}</div></div> }

function DocumentsPage({ onMenu }: { onMenu: () => void }) {
  const location = useLocation()
  const navigate = useNavigate()
  const projects = useProjects()
  const requestedProject = new URLSearchParams(location.search).get('project')
  const [selectedProjectName, setSelectedProjectName] = useState(() => projects.find((project) => slugify(project.name) === requestedProject)?.name || projects[0]?.name || '')
  const [remote, setRemote] = useState<Paper[] | null>(null)
  const [localPapers, setLocalPapers] = useState<Paper[]>(readLocalPapers)
  const [query, setQuery] = useState('')
  const [newProjectName, setNewProjectName] = useState('')
  const [newPaperTitle, setNewPaperTitle] = useState('')
  const [newPaperFile, setNewPaperFile] = useState<File | null>(null)
  const [paperSubmitting, setPaperSubmitting] = useState(false)
  const [projectFormOpen, setProjectFormOpen] = useState(false)
  const [paperFormOpen, setPaperFormOpen] = useState(false)
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [removedRemoteIds, setRemovedRemoteIds] = useState<string[]>([])

  useEffect(() => {
    void api('/api/v1/papers')
      .then((payload) => setRemote(payload.items.map(toUiPaper)))
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to load papers'))
  }, [])

  useEffect(() => {
    if (!projects.some((project) => project.name === selectedProjectName)) setSelectedProjectName(projects[0]?.name || '')
  }, [projects, selectedProjectName])

  const selectedProject = projects.find((project) => project.name === selectedProjectName)
  const allPapers = [...(remote || papers), ...localPapers]
  const projectPapers = useMemo(() => allPapers
    .filter((paper) => paper.collection === selectedProjectName && !removedRemoteIds.includes(paper.id))
    .filter((paper) => `${paper.title} ${paper.authors} ${paper.journal}`.toLowerCase().includes(query.toLowerCase())), [allPapers, query, removedRemoteIds, selectedProjectName])

  const selectProject = (name: string) => {
    setSelectedProjectName(name)
    navigate(`/documents?project=${slugify(name)}`, { replace: true })
  }

  const addProject = (event: React.FormEvent) => {
    event.preventDefault()
    const name = newProjectName.trim()
    if (!name) return
    if (projects.some((project) => project.name.toLowerCase() === name.toLowerCase())) {
      setNotice('A project with this name already exists.')
      return
    }
    const next = [...projects, { name, count: 0, description: 'A new research project ready for your papers.', accent: ['#159a7a', '#7867db', '#e5a846', '#d46b8b'][projects.length % 4] }]
    persistProjects(next)
    setSelectedProjectName(name)
    setNewProjectName('')
    setProjectFormOpen(false)
    setNotice(`Created “${name}”.`)
    navigate(`/documents?project=${slugify(name)}`, { replace: true })
  }

  const deleteProject = () => {
    if (!selectedProject || projects.length <= 1) {
      setNotice('Keep at least one project in your workspace.')
      return
    }
    if (!window.confirm(`Delete project “${selectedProject.name}”? Papers stay in your library.`)) return
    const next = projects.filter((project) => project.name !== selectedProject.name)
    persistProjects(next)
    setSelectedProjectName(next[0].name)
    setNotice(`Deleted “${selectedProject.name}”.`)
    navigate(`/documents?project=${slugify(next[0].name)}`, { replace: true })
  }

  const addPaper = async (event: React.FormEvent) => {
    event.preventDefault()
    const title = newPaperTitle.trim() || newPaperFile?.name.replace(/\.pdf$/i, '') || ''
    if (!title || !selectedProject) return
    setError('')
    setPaperSubmitting(true)
    try {
      if (newPaperFile) {
        const formData = new FormData()
        formData.append('file', newPaperFile)
        formData.append('title', title)
        formData.append('collection', selectedProject.name)
        const result = await api('/api/v1/papers/upload', { method: 'POST', body: formData })
        const uploaded = toUiPaper(result.paper)
        setRemote((current) => [uploaded, ...(current || [])])
      } else {
        const paper: Paper = { id: `local-${Date.now()}`, title, authors: 'Added in workspace', journal: 'Local document', year: new Date().getFullYear(), pages: 0, status: 'Ready', added: 'Just now', collection: selectedProject.name, color: `${selectedProject.accent}22` }
        const nextPapers = [...localPapers, paper]
        setLocalPapers(nextPapers)
        persistLocalPapers(nextPapers)
      }
      persistProjects(projects.map((project) => project.name === selectedProject.name ? { ...project, count: project.count + 1 } : project))
      setNewPaperTitle('')
      setNewPaperFile(null)
      setPaperFormOpen(false)
      setNotice(`Added “${title}” to ${selectedProject.name}.`)
    } catch (addError) {
      setError(addError instanceof Error ? addError.message : 'Unable to add document')
    } finally { setPaperSubmitting(false) }
  }

  const deletePaper = async (paper: Paper) => {
    if (!window.confirm(`Remove “${paper.title}” from this project?`)) return
    if (paper.id.startsWith('local-')) {
      const nextPapers = localPapers.filter((item) => item.id !== paper.id)
      setLocalPapers(nextPapers)
      persistLocalPapers(nextPapers)
    } else {
      try {
        await api(`/api/v1/papers/${paper.id}`, { method: 'DELETE' })
        setRemovedRemoteIds((current) => [...current, paper.id])
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete document')
        return
      }
    }
    persistProjects(projects.map((project) => project.name === selectedProjectName ? { ...project, count: Math.max(0, project.count - 1) } : project))
    setNotice(`Removed “${paper.title}”.`)
  }

  return <div className="page-content documents-page">
    <Topbar title="Document management" subtitle="Create projects and keep the papers inside each research thread organized." onMenu={onMenu} action={<button className="primary-button" onClick={() => { setPaperFormOpen(true); setNotice(''); setError('') }}><Plus size={16} /> Add paper</button>} />
    <div className="documents-layout">
      <section className="project-manager-panel" aria-labelledby="project-manager-title">
        <div className="manager-section-heading"><div><span className="eyebrow">WORKSPACE</span><h2 id="project-manager-title">Projects</h2></div><button className="text-button" onClick={() => { setProjectFormOpen(!projectFormOpen); setNotice('') }}><FolderPlus size={15} /> New project</button></div>
        {projectFormOpen && <form className="inline-manager-form" onSubmit={addProject}><label className="sr-only" htmlFor="new-project-name">Project name</label><input id="new-project-name" value={newProjectName} onChange={(event) => setNewProjectName(event.target.value)} placeholder="e.g. Sleep research" autoFocus /><button className="primary-button" type="submit">Create</button></form>}
        <div className="managed-project-list">
          {projects.map((project) => <button className={`managed-project ${project.name === selectedProjectName ? 'active' : ''}`} key={project.name} onClick={() => selectProject(project.name)}><span className="project-icon" style={{ color: project.accent, background: `${project.accent}18` }}><FolderOpen size={16} /></span><span><strong>{project.name}</strong><small>{project.count} {project.count === 1 ? 'paper' : 'papers'}</small></span><ArrowRight size={15} /></button>)}
        </div>
        <div className="project-manager-footer"><p>Projects keep your chats and papers together.</p><button className="danger-text-button" onClick={deleteProject} disabled={projects.length <= 1}><Trash2 size={14} /> Delete project</button></div>
      </section>
      <section className="document-manager-panel" aria-labelledby="document-manager-title">
        <div className="manager-section-heading document-heading"><div><span className="eyebrow">{selectedProject ? 'SELECTED PROJECT' : 'PAPERS'}</span><h2 id="document-manager-title">{selectedProject?.name || 'Choose a project'}</h2></div><div className="document-actions"><div className="search-field"><Search size={15} /><input aria-label="Search project papers" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search documents" /></div><Link className="text-button" to={selectedProject ? `/workspace?project=${slugify(selectedProject.name)}` : '/workspace'}>Open chat <ArrowUpRight size={14} /></Link></div></div>
        {paperFormOpen && <form className="inline-manager-form paper-form" onSubmit={(event) => void addPaper(event)}><label className="sr-only" htmlFor="new-paper-title">Paper title</label><input id="new-paper-title" value={newPaperTitle} onChange={(event) => setNewPaperTitle(event.target.value)} placeholder={`Add a paper to ${selectedProject?.name || 'this project'}`} autoFocus /><label className={`file-picker ${newPaperFile ? 'has-file' : ''}`} htmlFor="new-paper-file" title="Attach a PDF file"><FileText size={14} />{newPaperFile?.name || 'Attach PDF'}</label><input className="sr-only" id="new-paper-file" type="file" accept=".pdf,application/pdf" onChange={(event) => { const file = event.target.files?.[0] || null; if (file && !/\.pdf$/i.test(file.name)) { setError('Please choose a PDF file.'); event.currentTarget.value = ''; setNewPaperFile(null); return } setError(''); setNewPaperFile(file) }} /><span className="paper-form-actions"><button className="primary-button" type="submit" disabled={!selectedProject || (!newPaperTitle.trim() && !newPaperFile) || paperSubmitting}>{paperSubmitting ? 'Adding…' : 'Add document'}</button><button className="text-button" type="button" onClick={() => { setPaperFormOpen(false); setNewPaperTitle(''); setNewPaperFile(null); setError('') }}>Cancel</button></span></form>}
        {notice && <p className="manager-notice" role="status">{notice}</p>}
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="managed-paper-list">
          <div className="managed-paper-list-head"><span>{projectPapers.length} {projectPapers.length === 1 ? 'document' : 'documents'}</span><span>Actions</span></div>
          {projectPapers.map((paper) => <div className="managed-paper-row" key={paper.id}><span className="paper-info"><span className="paper-icon" style={{ background: paper.color }}><FileText size={17} /></span><span><strong>{paper.title}</strong><small>{paper.authors} · {paper.journal}{paper.year ? `, ${paper.year}` : ''}</small></span></span><StatusDot status={paper.status} /><div className="managed-paper-actions">{paper.id.startsWith('local-') ? <span className="local-document-label">Local</span> : <Link className="icon-button" aria-label="Open paper" title="Open paper" to={`/papers/${paper.id}`}><ArrowUpRight size={15} /></Link>}<button className="icon-button danger-icon" aria-label={`Delete ${paper.title}`} title="Delete document" onClick={() => void deletePaper(paper)}><Trash2 size={15} /></button></div></div>)}
          {projectPapers.length === 0 && <div className="managed-empty"><FileText size={20} /><strong>No documents in this project yet</strong><span>Add a paper to start organizing this research thread.</span><button className="text-button" onClick={() => setPaperFormOpen(true)}><Plus size={14} /> Add first document</button></div>}
        </div>
      </section>
    </div>
  </div>
}
function Processing({ onMenu }: { onMenu: () => void }) { return <div className="page-content"><Topbar title="Processing" subtitle="Monitor ingestion quality from PDF to searchable embeddings." onMenu={onMenu} action={<button className="outline-button"><Activity size={16} /> Refresh status</button>} /><div className="processing-overview"><div><span className="eyebrow">PIPELINE HEALTH</span><h2>Everything is moving smoothly.</h2><p>One paper is currently being prepared for retrieval.</p></div><div className="health-ring"><strong>3/4</strong><span>ready</span></div></div><div className="jobs-list">{papers.map((p, i) => <div className="job-card" key={p.id}><div className="job-title"><span className="paper-icon" style={{ background: p.color }}><FileText size={17} /></span><div><strong>{p.title}</strong><span>{p.authors} · Updated {i ? 'Yesterday' : '2 min ago'}</span></div><StatusDot status={p.status} /><IconButton label="More actions"><MoreHorizontal size={17} /></IconButton></div><div className="job-progress"><div className="progress-track"><span style={{ width: `${p.status === 'Ready' ? 100 : p.status === 'Processing' ? 66 : 42}%` }} /></div><span>{p.status === 'Ready' ? '100%' : p.status === 'Processing' ? '66%' : '42%'}</span></div><div className="job-steps">{processingSteps.map((step, j) => <span className={j < (p.status === 'Ready' ? 4 : p.status === 'Processing' ? 3 : 2) ? 'done' : ''} key={step.label}>{j < 3 ? <CheckCircle2 size={14} /> : <span className="step-number">{j + 1}</span>}{step.label}</span>)}</div></div>)}</div></div> }
function PaperDetail({ onMenu }: { onMenu: () => void }) { const { paperId } = useParams(); const paper = papers.find(p => p.id === paperId) ?? papers[0]; const [page, setPage] = useState(7); return <div className="page-content paper-detail-page"><Topbar title={paper.title} subtitle={`${paper.authors} · ${paper.journal}, ${paper.year}`} onMenu={onMenu} action={<div className="topbar-actions"><StatusDot status={paper.status} /><button className="outline-button"><MoreHorizontal size={16} /> Actions</button></div>} /><div className="detail-tabs"><button className="active"><BookOpen size={15} /> PDF viewer</button><button><FileText size={15} /> Extracted text</button><button><Grip size={15} /> Chunks</button></div><div className="paper-detail-grid"><section className="document-viewer"><div className="viewer-toolbar"><span>Page {page} of {paper.pages}</span><div><IconButton label="Previous page" onClick={() => setPage(Math.max(1, page - 1))}><ChevronLeft size={16} /></IconButton><IconButton label="Next page" onClick={() => setPage(Math.min(paper.pages, page + 1))}><ChevronRight size={16} /></IconButton><span className="toolbar-separator" /><IconButton label="Zoom out"><ZoomOut size={16} /></IconButton><span>100%</span><IconButton label="Zoom in"><ZoomIn size={16} /></IconButton></div></div><PdfPreview page={page} /></section><section className="extracted-panel"><div className="panel-heading"><div><span className="eyebrow">SELECTED CONTENT</span><h2>Extracted text</h2></div><IconButton label="Open in workspace"><ArrowUpRight size={16} /></IconButton></div><div className="extracted-card"><div className="extracted-card-head"><span>Chunk 04</span><span className="score-label">0.87 retrieval score</span></div><p>{sourceChunks[0].passage}</p><button className="text-button"><Copy size={14} /> Copy chunk</button></div><div className="content-metadata"><div><span>Page range</span><code>07–08</code></div><div><span>Extraction confidence</span><code>98.4%</code></div><div><span>Characters</span><code>1,284</code></div></div><button className="issue-button"><CircleHelp size={15} /> Flag extraction issue</button></section></div><Pipeline /></div> }
function Collections() { return <div className="page-content"><Topbar title="Collections" subtitle="Organize papers by project, question, or research thread." action={<button className="primary-button"><Plus size={16} /> New collection</button>} /><div className="collection-grid">{collections.map(c => <Link to="/workspace" className="collection-card" key={c.name}><div className="collection-card-top"><span className="collection-mark" style={{ background: `${c.accent}18`, color: c.accent }}><FolderOpen size={20} /></span><IconButton label="Collection actions"><MoreHorizontal size={17} /></IconButton></div><h2>{c.name}</h2><p>{c.description}</p><div><strong>{c.count}</strong><span>{c.count === 1 ? 'paper' : 'papers'}</span><ArrowUpRight size={15} /></div></Link>)}</div><div className="collection-tip"><Sparkles size={18} /><div><strong>Ask a collection to get a more focused answer.</strong><p>When selected, citations are limited to papers inside it.</p></div><Link to="/workspace" className="text-button">Try it <ArrowRight size={14} /></Link></div></div> }
function HistoryPage({ onMenu }: { onMenu: () => void }) {
  const [sessions, setSessions] = useState<ChatSession[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => { void api('/api/v1/sessions').then((items) => setSessions(Array.isArray(items) ? items : [])).catch(() => setSessions([])).finally(() => setLoading(false)) }, [])
  return <div className="page-content"><Topbar title="History" subtitle="Return to previous questions and continue your research thread." onMenu={onMenu} /><div className="history-list">{loading && <p className="history-empty-state">Loading your conversations…</p>}{!loading && sessions.length === 0 && <div className="history-empty-state"><MessageCircle size={18} /><strong>No conversations yet</strong><span>Start a question in a project and it will appear here.</span><Link to="/workspace" className="text-button">Open workspace <ArrowRight size={14} /></Link></div>}{!loading && sessions.map((session) => { const project = collections.find((item) => slugify(item.name) === session.project)?.name || 'Research workspace'; return <Link to={`/workspace?project=${session.project || slugify(collections[0].name)}&chat=${session.id}`} className="history-row" key={session.id}><span className="history-icon"><MessageCircle size={17} /></span><span><strong>{session.title}</strong><small>{project}</small></span><time>{sessionDate(session)}</time><ArrowRight size={16} /></Link> })}</div></div>
}
function SettingsPage() { return <div className="page-content"><Topbar title="Settings" subtitle="Personalize how your research assistant works." /><div className="settings-layout"><nav className="settings-nav"><button className="active">General</button><button>Retrieval</button><button>Data & privacy</button><button>Account</button></nav><section className="settings-panel"><div className="settings-section"><div><h2>Profile</h2><p>How you appear in your research workspace.</p></div><div className="profile-form"><div className="large-avatar">AK</div><div className="field-grid"><label>Display name<input defaultValue="Avery Kim" /></label><label>Role<input defaultValue="Researcher" /></label></div></div></div><div className="settings-section"><div><h2>Answer preferences</h2><p>Control the shape and grounding of generated answers.</p></div>{['Show retrieval scores', 'Require source citations'].map(label => <label className="setting-row" key={label}><span><strong>{label}</strong><small>Display transparent evidence beside each answer.</small></span><button className="toggle on"><span /></button></label>)}</div><div className="settings-section"><div><h2>Appearance</h2><p>Light theme is optimized for long reading sessions.</p></div><div className="appearance-options"><button className="appearance-option active"><span className="theme-preview light-preview" />Light</button><button className="appearance-option"><span className="theme-preview system-preview" />System</button></div></div></section></div></div> }
export function App() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [authReady, setAuthReady] = useState(false)
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const location = useLocation()
  const navigate = useNavigate()
  const isLanding = location.pathname === '/' || location.pathname === '/landing'
  const isLogin = location.pathname === '/login'

  useEffect(() => {
    if (isLanding || isLogin) {
      setAuthReady(true)
      return
    }
    let active = true
    setAuthReady(false)
    void api('/api/v1/auth/me')
      .then((result) => { if (active) setAuthUser(result.user) })
      .catch(() => { if (active) setAuthUser(null) })
      .finally(() => { if (active) setAuthReady(true) })
    return () => { active = false }
  }, [isLanding, isLogin, location.pathname])

  if (isLanding) return <LandingPage />
  if (isLogin) return <AuthPage onAuthenticated={setAuthUser} />
  if (!authReady) return <div className="auth-loading"><span className="brand-mark"><span /><span /><span /></span><span>Opening your workspace…</span></div>
  if (!authUser) return <AuthPage onAuthenticated={setAuthUser} />

  const onLogout = async () => {
    await api('/api/v1/auth/logout', { method: 'POST' }).catch(() => undefined)
    setAuthUser(null)
    navigate('/login')
  }
  const onMenu = () => setMenuOpen(true)
  return <div className="app-shell"><div className={`mobile-overlay ${menuOpen ? 'visible' : ''}`} onClick={() => setMenuOpen(false)} /><div className={`sidebar-wrap ${menuOpen ? 'open' : ''}`}><Sidebar user={authUser} onLogout={() => void onLogout()} onClose={() => setMenuOpen(false)} /></div><main className="app-main" key={location.pathname}><Routes><Route path="/workspace" element={<Workspace onMenu={onMenu} />} /><Route path="/papers" element={<Papers onMenu={onMenu} />} /><Route path="/papers/:paperId" element={<PaperDetail onMenu={onMenu} />} /><Route path="/documents" element={<DocumentsPage onMenu={onMenu} />} /><Route path="/collections" element={<Collections />} /><Route path="/processing" element={<Processing onMenu={onMenu} />} /><Route path="/history" element={<HistoryPage onMenu={onMenu} />} /><Route path="/settings" element={<SettingsPage />} /><Route path="*" element={<Workspace onMenu={onMenu} />} /></Routes></main></div>
}

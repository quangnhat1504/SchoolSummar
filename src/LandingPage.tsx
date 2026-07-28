import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  BrainCircuit,
  Check,
  ChevronRight,
  FileText,
  Layers3,
  Menu,
  MessageCircle,
  ScanText,
  Search,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'

const navItems = [
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Capabilities', href: '#capabilities' },
  { label: 'Evidence', href: '#evidence' },
]

const pipeline = [
  { number: '01', label: 'Detect layout', detail: 'Find titles, figures, tables and reading order.', icon: Layers3, tone: 'violet' },
  { number: '02', label: 'Extract meaning', detail: 'OCR turns every region into searchable text.', icon: ScanText, tone: 'mint' },
  { number: '03', label: 'Build memory', detail: 'Chunks and embeddings make the paper queryable.', icon: BrainCircuit, tone: 'amber' },
]

const capabilities = [
  { eyebrow: 'READ THE WHOLE PAPER', title: 'From PDF chaos to a clean research map.', body: 'Keep structure, context and visual evidence connected. RAG Research understands the paper before it answers.', icon: FileText, tone: 'violet' },
  { eyebrow: 'ASK WITH CONFIDENCE', title: 'Answers that show their work.', body: 'Every response points back to a passage, page and bounding box so you can verify the claim in seconds.', icon: Search, tone: 'mint' },
  { eyebrow: 'KEEP YOUR THREAD', title: 'Your library, your context, your pace.', body: 'Organize papers into collections and continue conversations without losing the question that started them.', icon: MessageCircle, tone: 'amber' },
]

function LandingLogo() {
  return <Link className="landing-logo" to="/" aria-label="RAG Research home"><span className="landing-logo-mark" aria-hidden="true"><i /><i /><i /></span><span>RAG <b>Research</b></span></Link>
}

function PipelineCard() {
  return <div className="hero-console" aria-label="RAG Research processing preview">
    <div className="hero-console-bar"><span className="window-dots"><i /><i /><i /></span><span className="console-label">PAPER / ATTENTION_MEMORY.PDF</span><span className="console-status"><i /> LIVE</span></div>
    <div className="hero-console-body">
      <div className="console-paper"><div className="paper-topline"><span>NATURE NEUROSCIENCE</span><span>VOL. 24</span></div><div className="paper-title-lines"><i /><i /><i /></div><span className="paper-tag">TITLE DETECTED</span><div className="paper-columns"><div><i /><i /><i /><i /><i /></div><div><i /><i /><i /><i /></div></div><div className="paper-highlight"><span>OCR</span> Attention during encoding enhances memory consolidation in humans</div><div className="paper-columns bottom"><div><i /><i /><i /></div><div><i /><i /><i /><i /></div></div></div>
      <div className="console-answer"><span className="console-kicker"><Sparkles size={13} /> GROUNDED ANSWER</span><p>High-attention encoding led to stronger overnight stabilization of neural representations.</p><div className="console-citation"><span>[01]</span><b>Page 07</b><small>0.92 match</small><ArrowUpRight size={13} /></div><div className="console-citation muted"><span>[02]</span><b>Figure 03</b><small>0.86 match</small><ArrowUpRight size={13} /></div><div className="console-footer"><Check size={13} /> Verified against source</div></div>
    </div>
    <div className="hero-console-bottom"><span><Zap size={13} /> 4 stages complete</span><span>94.8% confidence</span></div>
  </div>
}

export function LandingPage() {
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => {
    const page = document.querySelector<HTMLElement>('.landing-page')
    if (!page) return

    const sections = Array.from(page.querySelectorAll<HTMLElement>('.signal-strip, .landing-section, .landing-footer'))
    page.classList.add('motion-ready')

    if (!('IntersectionObserver' in window)) {
      sections.forEach((section) => section.classList.add('reveal-visible'))
      return
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return
        entry.target.classList.add('reveal-visible')
        observer.unobserve(entry.target)
      })
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 })

    sections.forEach((section) => {
      section.classList.add('reveal-on-scroll')
      observer.observe(section)
    })

    return () => observer.disconnect()
  }, [])

  return <div className="landing-page">
    <a className="landing-skip" href="#main-content">Skip to content</a>
    <header className="landing-header"><div className="landing-container landing-nav"><LandingLogo /><nav className="landing-nav-links" aria-label="Main navigation">{navItems.map((item) => <a href={item.href} key={item.href}>{item.label}</a>)}</nav><div className="landing-nav-actions"><Link className="landing-sign-in" to="/workspace">Sign in</Link><Link className="landing-nav-cta" to="/workspace">Open workspace <ArrowUpRight size={15} /></Link></div><button className="landing-menu-button" type="button" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((open) => !open)}>{menuOpen ? <X size={20} /> : <Menu size={20} />}</button></div>{menuOpen && <nav className="landing-mobile-nav" aria-label="Mobile navigation">{navItems.map((item) => <a href={item.href} key={item.href} onClick={() => setMenuOpen(false)}>{item.label}</a>)}<Link to="/workspace" onClick={() => setMenuOpen(false)}>Open workspace <ArrowRight size={15} /></Link></nav>}</header>

    <main id="main-content">
      <section className="landing-hero"><div className="landing-container hero-grid"><div className="hero-copy"><div className="landing-eyebrow"><span className="eyebrow-pulse" /> RESEARCH, WITH RECEIPTS</div><h1>Make every paper <em>work harder.</em></h1><p className="hero-lede">RAG Research turns dense PDFs into a living research workspace — searchable, explainable, and grounded in the source.</p><div className="hero-actions"><Link className="landing-primary-button" to="/workspace">Start exploring <ArrowRight size={17} /></Link><a className="landing-text-link" href="#how-it-works">See how it works <ChevronRight size={16} /></a></div><div className="hero-proof"><ShieldCheck size={17} /><span>Private by default</span><i /><span>Page-level citations</span><i /><span>Built for researchers</span></div></div><div className="hero-visual"><div className="hero-orbit orbit-one" /><div className="hero-orbit orbit-two" /><div className="hero-sticker"><span>PDF →</span><b>insight</b></div><PipelineCard /></div></div><div className="landing-container hero-scroll-cue"><span>SCROLL TO EXPLORE</span><ArrowDownRight size={15} /></div></section>

      <section className="signal-strip" aria-label="Product highlights"><div className="landing-container signal-items"><span>01 / INGEST</span><b>PDF-native intelligence</b><span>02 / GROUND</span><b>Evidence you can inspect</b><span>03 / MOVE</span><b>More time for the question</b></div></section>

      <section className="landing-section capabilities-section" id="capabilities"><div className="landing-container"><div className="section-heading"><div><span className="landing-eyebrow">A BETTER RESEARCH LOOP</span><h2>Less hunting.<br /><em>More thinking.</em></h2></div><p>Everything you need to move from “where was that?” to “now I understand” — without breaking your reading flow.</p></div><div className="capability-grid">{capabilities.map(({ eyebrow, title, body, icon: Icon, tone }, index) => <article className={`capability-card ${tone}`} key={title}><div className="capability-top"><span>{String(index + 1).padStart(2, '0')}</span><Icon size={20} /></div><span className="capability-eyebrow">{eyebrow}</span><h3>{title}</h3><p>{body}</p><span className="card-arrow"><ArrowUpRight size={16} /></span></article>)}</div></div></section>

      <section className="landing-section process-section" id="how-it-works"><div className="landing-container process-grid"><div className="process-intro"><span className="landing-eyebrow">UNDER THE HOOD</span><h2>Your papers.<br /><span>Mapped to meaning.</span></h2><p>RAG Research keeps the shape of the original document while making every layer useful to you and your agent.</p><Link className="landing-outline-button" to="/workspace">Explore the workspace <ArrowRight size={16} /></Link></div><div className="pipeline-list">{pipeline.map(({ number, label, detail, icon: Icon, tone }) => <div className="pipeline-row" key={number}><span className="pipeline-number">{number}</span><span className={`pipeline-icon ${tone}`}><Icon size={19} /></span><div><h3>{label}</h3><p>{detail}</p></div><Check className="pipeline-check" size={17} /></div>)}<div className="pipeline-result"><span className="result-icon"><Sparkles size={17} /></span><div><span className="landing-eyebrow">RESULT</span><strong>Ask a question. See the evidence.</strong></div><ArrowUpRight size={16} /></div></div></div></section>

      <section className="landing-section evidence-section" id="evidence"><div className="landing-container evidence-grid"><div className="evidence-copy"><span className="landing-eyebrow">NO BLACK BOXES HERE</span><h2>Trust the answer<br /><em>because you can open it.</em></h2><p>Every generated response carries its source trail: the paper, the page, the passage and the exact visual region when it matters.</p><ul>{['Page and block-level citations', 'Raw page and figure evidence', 'Retrieval score for transparent ranking'].map((item) => <li key={item}><span><Check size={14} /></span>{item}</li>)}</ul><Link className="landing-text-link" to="/workspace">See a grounded answer <ArrowRight size={16} /></Link></div><div className="evidence-card"><div className="evidence-card-head"><span><span className="mini-dot" /> SOURCE INSPECTOR</span><span>1 / 2</span></div><div className="evidence-paper"><div className="evidence-paper-head"><span>NATURE NEUROSCIENCE</span><small>PAGE 07</small></div><h3>Attention during encoding enhances memory consolidation in humans</h3><div className="evidence-lines"><i /><i /><i /><i /><i /><i /></div><blockquote>“Items encoded under high attentional focus showed significantly greater stabilization of neural representations during sleep...”</blockquote><span className="evidence-bbox">SELECTED PASSAGE <span>98.4%</span></span></div><div className="evidence-card-footer"><span><FileText size={14} /> attention-memory.pdf</span><span><ArrowUpRight size={14} /> Open source</span></div></div></div></section>

      <section className="landing-section metrics-section"><div className="landing-container metrics-grid"><div><span>ONE PAPER</span><strong>∞</strong><p>ways to ask better questions</p></div><div><span>EVERY ANSWER</span><strong>01</strong><p>source trail attached</p></div><div><span>YOUR LIBRARY</span><strong>100%</strong><p>organized around your work</p></div></div></section>

      <section className="landing-section final-section"><div className="landing-container final-card"><div className="final-grid-art" /><span className="landing-eyebrow">THE NEXT PAGE IS YOURS</span><h2>Bring your hardest<br /><em>question.</em></h2><p>Start with one paper. Leave with a clearer path through the whole field.</p><Link className="landing-primary-button" to="/workspace">Enter RAG Research <ArrowRight size={17} /></Link><span className="final-note"><BookOpen size={15} /> Your research workspace is ready</span></div></section>
    </main>

    <footer className="landing-footer"><div className="landing-container footer-inner"><LandingLogo /><span>Research, with receipts.</span><div><Link to="/workspace">Workspace</Link><a href="#capabilities">Capabilities</a><a href="#how-it-works">How it works</a></div></div></footer>
  </div>
}

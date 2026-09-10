export type PaperStatus = 'Ready' | 'Processing' | 'Needs review' | 'Failed'

export type Paper = {
  id: string
  title: string
  authors: string
  journal: string
  year: number
  pages: number
  status: PaperStatus
  added: string
  collection: string
  color: string
}

export type SourceChunk = {
  id: string
  title: string
  authors: string
  journal: string
  page: number
  score: number
  passage: string
  reason: string
  color: string
}

export const papers: Paper[] = [
  {
    id: 'attention-memory',
    title: 'Attention during encoding enhances memory consolidation in humans',
    authors: 'J. D. Smith et al.',
    journal: 'Nature Neuroscience',
    year: 2021,
    pages: 18,
    status: 'Ready',
    added: 'Today',
    collection: 'Memory & cognition',
    color: '#d9f5e9',
  },
  {
    id: 'neural-markers',
    title: 'Neural markers of memory consolidation across attention levels',
    authors: 'L. M. Chen et al.',
    journal: 'Journal of Neuroscience',
    year: 2020,
    pages: 12,
    status: 'Ready',
    added: 'Yesterday',
    collection: 'Memory & cognition',
    color: '#e6e8ff',
  },
  {
    id: 'sleep-recall',
    title: 'Sleep-dependent reactivation predicts next-day recall',
    authors: 'R. Patel, N. Walsh',
    journal: 'Cognitive Science',
    year: 2019,
    pages: 24,
    status: 'Processing',
    added: 'Jun 28, 2026',
    collection: 'Memory & cognition',
    color: '#fff0c9',
  },
  {
    id: 'hippocampal-gating',
    title: 'Hippocampal gating of information during focused attention',
    authors: 'M. Rivera et al.',
    journal: 'Science Advances',
    year: 2022,
    pages: 16,
    status: 'Needs review',
    added: 'Jun 24, 2026',
    collection: 'Open questions',
    color: '#f5dce9',
  },
]

export const sourceChunks: SourceChunk[] = [
  {
    id: 'smith2021_p07_c04',
    title: 'Attention during encoding enhances memory consolidation in humans',
    authors: 'J. D. Smith et al.',
    journal: 'Nature Neuroscience, 2021',
    page: 7,
    score: 0.87,
    passage:
      'Items encoded under high attentional focus showed significantly greater stabilization of neural representations during sleep compared to low-attention encoding conditions.',
    reason:
      'This chunk directly states the relationship between attention during encoding and the strength of memory consolidation, matching the question closely.',
    color: '#d9f5e9',
  },
  {
    id: 'chen2020_p12_c02',
    title: 'Neural markers of memory consolidation across attention levels',
    authors: 'L. M. Chen et al.',
    journal: 'Journal of Neuroscience, 2020',
    page: 12,
    score: 0.74,
    passage:
      'The magnitude of overnight consolidation scaled with attentional engagement at encoding, suggesting that attention gates which representations receive preferential stabilization.',
    reason:
      'This passage supports the dose-response interpretation and adds a complementary explanation for the reported effect.',
    color: '#e6e8ff',
  },
]

export const processingSteps = [
  { label: 'Layout detection', detail: 'Detecting text blocks, figures, and tables.', status: 'Complete', icon: 'layout' },
  { label: 'OCR', detail: 'Extracting text from scanned content.', status: 'OCR complete', icon: 'ocr' },
  { label: 'Chunking', detail: 'Splitting into semantic chunks.', status: 'Complete', icon: 'chunk' },
  { label: 'Embeddings', detail: 'Generating vector embeddings.', status: 'Embeddings ready', icon: 'embed' },
]

export const collections = [
  { name: 'Memory & cognition', count: 3, description: 'Attention, sleep, and memory consolidation studies.', accent: '#159a7a' },
  { name: 'Open questions', count: 1, description: 'Papers to revisit and annotate later.', accent: '#7867db' },
  { name: 'Methods references', count: 0, description: 'Useful methods and analysis references.', accent: '#e5a846' },
]

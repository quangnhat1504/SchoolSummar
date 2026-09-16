export const splitForStream = (text, size = 42) => {
  if (!text) return []
  const chunks = []
  let remaining = text
  while (remaining.length > 0) {
    if (remaining.length <= size) {
      chunks.push(remaining)
      break
    }
    let splitIdx = -1
    for (let i = Math.min(size, remaining.length - 1); i >= Math.floor(size / 3); i -= 1) {
      const char = remaining[i]
      if (char === ' ' || char === '\n' || char === '\t') {
        splitIdx = i + 1
        break
      }
    }
    if (splitIdx === -1) {
      splitIdx = size
    }
    chunks.push(remaining.slice(0, splitIdx))
    remaining = remaining.slice(splitIdx)
  }
  return chunks
}

const demoAnswer = (question, sources) => {
  if (!sources.length) return `I could not find a grounded passage for “${question}” in the active paper set. Try naming a paper, adding a more specific term, or uploading another source.`
  const lead = sources[0].text
  return `The available evidence suggests that ${lead.charAt(0).toLowerCase()}${lead.slice(1)} This directly addresses the question and is supported by ${sources.length} retrieved source${sources.length === 1 ? '' : 's'} [1${sources.length > 1 ? '–' + sources.length : ''}].`
}

export const RESEARCH_RAG_SYSTEM_PROMPT = `Bạn là Trợ lý Nghiên cứu Khoa học AI chuyên sâu (SchoolSummar Research Copilot).
Nhiệm vụ của bạn là giải thích, phân tích và trả lời câu hỏi của người dùng một cách KHÁCH QUAN, RÕ RÀNG và HOÀN TOÀN DỰA TRÊN các đoạn trích dẫn (Excerpts) từ tài liệu được cung cấp.

QUY TẮC BẮT BUỘC (GROUNDED CITATION CONTRACT):
1. TUYỆT ĐỐI KHÔNG ẢO GIÁC (ZERO HALLUCINATION):
   - Chỉ trả lời dựa trên thông tin thực tế xuất hiện trong các Excerpts. Không suy đoán, không đưa kiến thức bên ngoài nếu không có căn cứ từ tài liệu.
2. TỪ CHỐI RÕ RÀNG KHI THIẾU THÔNG TIN (NEGATIVE REJECTION):
   - Nếu các đoạn trích không chứa đủ bằng chứng để trả lời câu hỏi, hãy tuyên bố thẳng thắn: "Tài liệu được cung cấp không chứa thông tin đầy đủ để trả lời câu hỏi này" và tóm tắt những gì tài liệu có đề cập gần nhất (nếu có).
3. HỢP ĐỒNG TRÍCH DẪN (CITATION):
   - Mọi khẳng định, dữ liệu hay số liệu cụ thể BẮT BUỘC phải gắn thẻ trích dẫn [n] tương ứng với vị trí đoạn trích (ví dụ: "Theo tài liệu, giá trị mAP đạt 45.2% [1] tại trang 3 [2]").
4. ĐỊNH DẠNG TRÌNH BÀY (STRUCTURED SYNTHESIS):
   - Câu đầu tiên nêu trực tiếp kết luận.
   - Các đoạn tiếp theo phân tích chi tiết, có thể dùng gạch đầu dòng và bảng biểu tóm tắt nếu cần.
5. NGÔN NGỮ ĐỒNG NHẤT (LANGUAGE MATCHING):
   - Trả lời bằng ngôn ngữ người dùng đặt câu hỏi (hỏi tiếng Việt trả lời tiếng Việt; hỏi tiếng Anh trả lời tiếng Anh).`

const llmAnswer = async (llm, config, question, sources, memoryContext = '') => {
  if (!llm || !sources.length) return null
  const maxChunkChars = 1000
  let totalChars = 0
  const contextParts = []
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]
    const raw = (source.text || '').trim()
    const boundedText = raw.length > maxChunkChars ? `${raw.slice(0, maxChunkChars)}... [cắt bớt]` : raw
    const part = `[${index + 1}] "${source.title || 'Untitled Paper'}" (Trang ${source.pageStart || 1}):\n${boundedText}`
    if (totalChars + part.length > 8000) break
    contextParts.push(part)
    totalChars += part.length
  }
  const context = contextParts.join('\n\n---\n\n')
  const userContent = memoryContext
    ? `Ký ức ngữ cảnh & hồ sơ người dùng:\n${memoryContext}\n\nDưới đây là các đoạn trích dẫn từ tài liệu:\n\n${context}\n\nCâu hỏi: ${question}\n\nHãy trả lời câu hỏi trên dựa CHÍNH XÁC vào các đoạn trích dẫn trên (và hồ sơ người dùng nếu phù hợp), trích dẫn [n] đầy đủ:`
    : `Dưới đây là các đoạn trích dẫn từ tài liệu:\n\n${context}\n\nCâu hỏi: ${question}\n\nHãy trả lời câu hỏi trên dựa CHÍNH XÁC vào các đoạn trích dẫn trên và trích dẫn [n] đầy đủ:`

  const result = await llm.complete({
    messages: [
      { role: 'system', content: RESEARCH_RAG_SYSTEM_PROMPT },
      { role: 'user', content: userContent },
    ],
    maxTokens: config.llmMaxTokens,
  })
  return result?.text ? result : null
}

export const answerQuestion = async (config, store, ownerId, question, scope, llm, vectorStore = null, embedder = null, memoryClient = null, sessionKey = null) => {
  let memoryContext = ''
  if (memoryClient && typeof memoryClient.recall === 'function') {
    try {
      const recalled = await memoryClient.recall({ query: question, sessionKey: sessionKey || ownerId, userId: ownerId })
      if (recalled?.context) memoryContext = recalled.context
    } catch {
      // Gracefully continue without memory
    }
  }

  let sources = []
  if (vectorStore && embedder && embedder.isConfigured) {
    try {
      const queryVector = await embedder.embedQuery(question)
      const minScore = Number(config.ragMinSimilarityScore || 0.60)
      const vectorResults = await vectorStore.search(queryVector, {
        limit: config.rerankTopK || 8,
        minScore,
        ownerId,
        paperId: scope?.paperId,
      })
      if (Array.isArray(vectorResults) && vectorResults.length > 0) {
        sources = vectorResults
          .filter((r) => Number(r.score || 0) >= minScore)
          .map((r) => ({
            paperId: r.paperId || (r.payload && r.payload.paperId) || '',
            processingRunId: r.processingRunId || (r.payload && r.payload.processingRunId) || '',
            chunkId: r.chunkId || r.id || '',
            title: r.title || (r.payload && r.payload.title) || 'Research Paper',
            text: r.text || (r.payload && r.payload.text) || '',
            pageStart: r.pageStart || (r.payload && r.payload.pageStart) || 1,
            pageEnd: r.pageEnd || (r.payload && r.payload.pageEnd) || 1,
            score: Number(r.score || 0),
          }))
          .filter((r) => r.text && r.text.trim().length > 0)
      }
    } catch {
      // Gracefully fallback to relational/memory store
    }
  }

  if (!sources.length) {
    sources = await store.searchChunks(ownerId, question, { paperId: scope?.paperId, limit: config.rerankTopK })
  }
  let answer
  try { answer = await llmAnswer(llm, config, question, sources, memoryContext) } catch { answer = null }
  return {
    text: answer?.text || demoAnswer(question, sources),
    sources,
    mode: answer ? 'llm' : 'fallback',
    provider: answer?.provider || null,
    model: answer?.model || null,
    recalledMemory: Boolean(memoryContext),
  }
}

export const streamAnswer = async (answer, onDelta) => { for (const delta of splitForStream(answer.text)) { await new Promise((resolve) => setTimeout(resolve, 18)); await onDelta(delta) } }

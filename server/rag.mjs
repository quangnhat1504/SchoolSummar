const splitForStream = (text, size = 42) => text.match(new RegExp(`.{1,${size}}(?:\\s|$)|.{1,${size}}`, 'g')) || [text]

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

const llmAnswer = async (llm, config, question, sources) => {
  if (!llm || !sources.length) return null
  const context = sources.map((source, index) => `[${index + 1}] "${source.title || 'Untitled Paper'}" (Trang ${source.pageStart || 1}):\n${source.text}`).join('\n\n---\n\n')
  const result = await llm.complete({
    messages: [
      { role: 'system', content: RESEARCH_RAG_SYSTEM_PROMPT },
      { role: 'user', content: `Dưới đây là các đoạn trích dẫn từ tài liệu:\n\n${context}\n\nCâu hỏi: ${question}\n\nHãy trả lời câu hỏi trên dựa CHÍNH XÁC vào các đoạn trích dẫn trên và trích dẫn [n] đầy đủ:` },
    ],
    maxTokens: config.llmMaxTokens,
  })
  return result?.text ? result : null
}

export const answerQuestion = async (config, store, ownerId, question, scope, llm) => {
  const sources = await store.searchChunks(ownerId, question, { paperId: scope?.paperId, limit: config.rerankTopK })
  let answer
  try { answer = await llmAnswer(llm, config, question, sources) } catch { answer = null }
  return {
    text: answer?.text || demoAnswer(question, sources),
    sources,
    mode: answer ? 'llm' : 'fallback',
    provider: answer?.provider || null,
    model: answer?.model || null,
  }
}

export const streamAnswer = async (answer, onDelta) => { for (const delta of splitForStream(answer.text)) { await new Promise((resolve) => setTimeout(resolve, 18)); await onDelta(delta) } }

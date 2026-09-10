const splitForStream = (text, size = 42) => text.match(new RegExp(`.{1,${size}}(?:\\s|$)|.{1,${size}}`, 'g')) || [text]

const demoAnswer = (question, sources) => {
  if (!sources.length) return `I could not find a grounded passage for “${question}” in the active paper set. Try naming a paper, adding a more specific term, or uploading another source.`
  const lead = sources[0].text
  return `The available evidence suggests that ${lead.charAt(0).toLowerCase()}${lead.slice(1)} This directly addresses the question and is supported by ${sources.length} retrieved source${sources.length === 1 ? '' : 's'} [1${sources.length > 1 ? '–' + sources.length : ''}].`
}

const llmAnswer = async (llm, config, question, sources) => {
  if (!llm || !sources.length) return null
  const context = sources.map((source, index) => `[${index + 1}] ${source.title}, page ${source.pageStart}: ${source.text}`).join('\n\n')
  const result = await llm.complete({
    messages: [
      { role: 'system', content: 'Answer only from the supplied research excerpts. Cite claims with [n]. If evidence is insufficient, say so plainly.' },
      { role: 'user', content: `Question: ${question}\n\nExcerpts:\n${context}` },
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

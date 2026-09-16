const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const steps = ['page_render', 'layout', 'ocr', 'chunk', 'embedding']

export const processRun = async ({ store, hub, ownerId, run, jobs, logger, docling, sourcePath, filename, sha256, metadata, vectorStore, embedder }) => {
  const paperId = run.paperId || run.paper_id
  const runId = run.id
  try {
    await store.setRunStatus(ownerId, runId, 'running')
    hub.publish(ownerId, 'processing.started', { paperId, runId })
    const document = await docling.convert({ sourcePath, filename, sha256, metadata })
    if (store.persistDoclingResult) await store.persistDoclingResult(ownerId, paperId, runId, document)
    hub.publish(ownerId, 'processing.docling', { paperId, runId, pages: document.pages.length, chunks: document.chunks.length, blocks: document.layoutBlocks.length })

    if (vectorStore && embedder && embedder.isConfigured && document.chunks?.length) {
      try {
        const texts = document.chunks.map((c) => c.text)
        const embedFn = typeof embedder.embedBatch === 'function' ? embedder.embedBatch.bind(embedder) : embedder.embedTexts.bind(embedder)
        const vectors = await embedFn(texts)
        const points = document.chunks.map((chunk, idx) => ({
          id: chunk.id,
          vector: vectors[idx],
          payload: {
            paperId,
            processingRunId: runId,
            chunkId: chunk.id,
            title: metadata?.title || filename?.replace(/\.pdf$/i, '') || 'Document',
            text: chunk.text,
            pageStart: chunk.pageStart || 1,
            pageEnd: chunk.pageEnd || chunk.pageStart || 1,
            ownerId,
          },
        }))
        if (typeof vectorStore.upsert === 'function') {
          await vectorStore.upsert(points)
        } else if (typeof vectorStore.upsertChunks === 'function') {
          await vectorStore.upsertChunks(points)
        }
      } catch (err) {
        logger?.warn?.({ error: err.message }, 'Failed to upsert chunks to vectorStore, continuing...')
      }
    }
    for (const [index, job] of jobs.entries()) {
      const jobType = job.jobType || job.job_type
      await store.setJobStatus(ownerId, job.id, 'running')
      hub.publish(ownerId, 'processing.updated', { paperId, runId, jobType, status: 'running', progress: Math.round((index / steps.length) * 100) })
      await delay(50)
      await store.setJobStatus(ownerId, job.id, 'succeeded')
      hub.publish(ownerId, 'processing.updated', { paperId, runId, jobType, status: 'succeeded', progress: Math.round(((index + 1) / steps.length) * 100) })
    }
    await store.setRunStatus(ownerId, runId, 'succeeded', true)
    hub.publish(ownerId, 'processing.completed', { paperId, runId, status: 'ready' })
  } catch (error) {
    logger.error({ error, runId }, 'processing run failed')
    try { await store.setRunStatus(ownerId, runId, 'failed') } catch {}
    hub.publish(ownerId, 'processing.failed', { paperId, runId, status: 'failed', message: error.message })
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const steps = ['page_render', 'layout', 'ocr', 'chunk', 'embedding']

export const processRun = async ({ store, hub, ownerId, run, jobs, logger, docling, sourcePath, filename, sha256, metadata, vectorStore, embedder }) => {
  try {
    await store.setRunStatus(ownerId, run.id, 'running')
    hub.publish(ownerId, 'processing.started', { paperId: run.paperId, runId: run.id })
    const document = await docling.convert({ sourcePath, filename, sha256, metadata })
    if (store.persistDoclingResult) await store.persistDoclingResult(ownerId, run.paperId, run.id, document)
    hub.publish(ownerId, 'processing.docling', { paperId: run.paperId, runId: run.id, pages: document.pages.length, chunks: document.chunks.length, blocks: document.layoutBlocks.length })

    if (vectorStore && embedder && embedder.isConfigured && document.chunks?.length) {
      try {
        const texts = document.chunks.map((c) => c.text)
        const vectors = await embedder.embedBatch(texts)
        const points = document.chunks.map((chunk, idx) => ({
          id: chunk.id,
          vector: vectors[idx],
          payload: {
            paperId: run.paperId,
            processingRunId: run.id,
            chunkId: chunk.id,
            title: metadata?.title || filename?.replace(/\.pdf$/i, '') || 'Document',
            text: chunk.text,
            pageStart: chunk.pageStart || 1,
            pageEnd: chunk.pageEnd || chunk.pageStart || 1,
            ownerId,
          },
        }))
        await vectorStore.upsert(points)
      } catch (err) {
        logger?.warn?.({ error: err.message }, 'Failed to upsert chunks to vectorStore, continuing...')
      }
    }
    for (const [index, job] of jobs.entries()) {
      await store.setJobStatus(ownerId, job.id, 'running')
      hub.publish(ownerId, 'processing.updated', { paperId: run.paperId, runId: run.id, jobType: job.jobType, status: 'running', progress: Math.round((index / steps.length) * 100) })
      await delay(90)
      await store.setJobStatus(ownerId, job.id, 'succeeded')
      hub.publish(ownerId, 'processing.updated', { paperId: run.paperId, runId: run.id, jobType: job.jobType, status: 'succeeded', progress: Math.round(((index + 1) / steps.length) * 100) })
    }
    await store.setRunStatus(ownerId, run.id, 'succeeded', true)
    hub.publish(ownerId, 'processing.completed', { paperId: run.paperId, runId: run.id, status: 'ready' })
  } catch (error) {
    logger.error({ error, runId: run.id }, 'processing run failed')
    try { await store.setRunStatus(ownerId, run.id, 'failed') } catch {}
    hub.publish(ownerId, 'processing.failed', { paperId: run.paperId, runId: run.id, status: 'failed', message: error.message })
  }
}

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export const notFound = (message = 'Resource not found') => new ApiError(404, 'not_found', message)
export const badRequest = (message, details) => new ApiError(400, 'bad_request', message, details)
export const unauthorized = (message = 'Authentication required') => new ApiError(401, 'unauthorized', message)
export const conflict = (message) => new ApiError(409, 'conflict', message)

export const errorPayload = (error, requestId) => ({
  ok: false,
  error: {
    code: error?.code || 'internal_error',
    message: error?.status ? error.message : 'Internal server error',
    ...(error?.details ? { details: error.details } : {}),
    requestId,
  },
})

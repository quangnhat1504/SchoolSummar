import { validate as isUuid } from 'uuid'
import { unauthorized } from './errors.mjs'

export const getRequestIdentity = (request, config, requestUrl = new URL(request.url || '/', config.appUrl)) => {
  const headerId = request.headers['x-user-id'] || requestUrl.searchParams.get('user_id')
  if (headerId && isUuid(String(headerId))) {
    return { userId: String(headerId), subject: String(headerId), mode: 'header' }
  }

  if (config.authRequired) {
    throw unauthorized('Send a verified identity through the auth adapter')
  }

  return { userId: config.demoUserId, subject: 'demo-local-user', mode: 'development' }
}

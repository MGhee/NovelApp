import { auth } from '@/auth'
import { NextRequest } from 'next/server'
import { verifyCookie } from '@/lib/auth'
import { verifyApiToken } from '@/lib/api-auth'

/**
 * Extract the authenticated user's ID from the request.
 * Checks in order: NextAuth session, HMAC session token (Bearer or cookie), API token.
 * Returns userId string or null.
 */
export async function getUserId(req: NextRequest): Promise<string | null> {
  // 1. Check custom header set by middleware (for OAuth sessions)
  const userIdHeader = req.headers.get('x-user-id')
  if (userIdHeader) return userIdHeader

  // 2. Check Bearer token (for extension/API calls)
  const authHeader = req.headers.get('authorization')
  if (authHeader) {
    const match = authHeader.match(/^Bearer\s+(.+)$/i)
    if (match) {
      const token = match[1]

      // 2a. Try HMAC session token (format: userId:timestamp.signature)
      const userId = await verifyCookie(token)
      if (userId) return userId

      // 2b. Try API token (DB lookup)
      const apiTokenUserId = await verifyApiToken(token)
      if (apiTokenUserId) return apiTokenUserId
    }
  }

  // 3. Check novelapp_session cookie
  const cookie = req.cookies.get('novelapp_session')?.value
  if (cookie) {
    const userId = await verifyCookie(cookie)
    if (userId) return userId
  }

  return null
}

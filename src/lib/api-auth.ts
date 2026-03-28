import { prisma } from './prisma'

/**
 * Verify an API token (Bearer token from ApiToken table).
 * Updates lastUsedAt and returns userId or null.
 */
export async function verifyApiToken(token: string): Promise<string | null> {
  if (!token) return null

  try {
    const apiToken = await prisma.apiToken.findUnique({
      where: { token },
      include: { user: true },
    })

    if (!apiToken) return null

    // Update lastUsedAt asynchronously (don't await)
    prisma.apiToken.update({
      where: { id: apiToken.id },
      data: { lastUsedAt: new Date() },
    }).catch(() => {}) // Ignore errors

    return apiToken.userId
  } catch {
    return null
  }
}

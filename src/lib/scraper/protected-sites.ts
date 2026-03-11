/**
 * Hostnames that block server-side scraping (Cloudflare/DDoS-Guard).
 * These sites require browser-based scraping via the extension.
 */
export const PROTECTED_HOSTS = new Set([
  'empirenovel.com',
  'hangukhub.com',
  'novelbin.com',
  'novellive.app',
])

export function isProtectedHost(hostname: string): boolean {
  return PROTECTED_HOSTS.has(hostname.replace(/^www\./, ''))
}

/**
 * Helper centralizado para obtener las cookieSignatureKeys desde env.
 * Úsalo en cualquier lugar donde se necesite getTokens().
 */
export function getCookieSignatureKeys(): string[] {
  return process.env.COOKIE_SIGNATURE_KEYS
    ? process.env.COOKIE_SIGNATURE_KEYS.split(',').map(k => k.trim())
    : ['cronograma-secret-key-2026'];
}

export const FIREBASE_AUTH_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY!,
  cookieName: 'AuthToken' as const,
  get cookieSignatureKeys() { return getCookieSignatureKeys(); },
  serviceAccount: {
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID!,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL!,
    privateKey: (process.env.FIREBASE_ADMIN_PRIVATE_KEY || '').replace(/\\n/g, '\n'),
  },
};

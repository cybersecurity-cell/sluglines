/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  turbopack: { root: __dirname },
  async headers() {
    const configuredSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const configuredOrigin = configuredSupabaseUrl ? new URL(configuredSupabaseUrl).origin : null
    const localRealtimeOrigin = configuredOrigin?.startsWith('http://')
      ? configuredOrigin.replace('http://', 'ws://')
      : null
    const connectSources = ["'self'", 'https://*.supabase.co', 'wss://*.supabase.co', configuredOrigin, localRealtimeOrigin]
      .filter(Boolean)
      .join(' ')
    const contentSecurityPolicy = [
      "default-src 'self'",
      "base-uri 'self'",
      "object-src 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
      "img-src 'self' data: blob:",
      "font-src 'self'",
      "style-src 'self' 'unsafe-inline'",
      "script-src 'self' 'unsafe-inline'",
      `connect-src ${connectSources}`,
    ].join('; ')

    return [{
      source: '/(.*)',
      headers: [
        { key: 'Content-Security-Policy', value: contentSecurityPolicy },
        { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
        { key: 'X-Content-Type-Options', value: 'nosniff' },
        { key: 'X-Frame-Options', value: 'DENY' },
      ],
    }]
  },
}

module.exports = nextConfig

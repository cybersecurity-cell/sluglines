import { securityHeaders } from './src/lib/security-headers.mjs'

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  /**
   * Browser security headers — issue #33. The policy itself lives in
   * `src/lib/security-headers.mjs` so `tests/security-headers.test.mjs` can
   * assert it; this file is only where Next is told to send it.
   *
   * Applied to every path, including the `_next/`, `/api/` and static-asset
   * paths that `src/middleware.ts` deliberately excludes for latency reasons.
   */
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders(),
      },
    ]
  },
}

export default nextConfig

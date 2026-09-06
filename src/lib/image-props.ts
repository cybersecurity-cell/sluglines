/**
 * `next/image` without its client component (issue #160, D-95).
 *
 * WHY THIS MODULE EXISTS
 * ---------------------------------------------------------------------------
 * `next/image` exports `getImageProps()` for exactly this use — a server
 * component that wants the optimizer URL, the `srcset` for `sizes`,
 * `loading="lazy"` and `decoding="async"` on a plain `<img>` — but the entry
 * module that exports it (`next/dist/shared/lib/image-external.js`) also
 * `require()`s the `'use client'` `<Image>` component at top level. Under
 * Turbopack that makes any server-side import of `next/image`, even one that
 * only calls `getImageProps`, put the whole `next/image` client runtime
 * (~14 KB, ~5.6 KB gzipped) into the client chunk of every page that renders
 * the importing component. That is how `/spots/[slug]`, where 42 of 50 spots
 * render no image at all, came to ship it — twice — and blew the Lighthouse
 * script budget (D-94).
 *
 * So this module calls the function `getImageProps` itself wraps,
 * `getImgProps` from Next's shared lib, with the same two arguments
 * `image-external.js` passes: the default loader and the image config Next
 * defines into every bundle as `process.env.__NEXT_IMAGE_OPTS` (falling back to
 * `imageConfigDefault` inside `getImgProps`, which is this repo's config: no
 * `images` key in `next.config`). The output is byte-for-byte what `<Image>`
 * would have rendered for a local file of known size.
 *
 * WHAT IT DOES NOT COVER
 * ---------------------------------------------------------------------------
 * Anything that needs the client component: `placeholder="blur"` transitions,
 * `onLoad`/`onLoadingComplete`, `fill` with a measured parent. Nothing on the
 * public surface uses those. A component that needs them should import
 * `next/image` from a `'use client'` file so the cost is paid once, knowingly.
 *
 * The two `next/dist/...` specifiers are Next internals. They have been stable
 * since 13.0 and `tests/spot-photos.test.mjs` pins this file as the only place
 * they may appear, so a Next upgrade that moves them fails typecheck and build
 * here, in one file, and nowhere else.
 */

import { getImgProps } from 'next/dist/shared/lib/get-img-props'
import type { ImageProps } from 'next/dist/shared/lib/get-img-props'
import type { ImageConfigComplete } from 'next/dist/shared/lib/image-config'
import defaultLoader from 'next/dist/shared/lib/image-loader'

export type OptimizedImageInput = Pick<ImageProps, 'src' | 'alt' | 'width' | 'height' | 'sizes' | 'className' | 'priority'>

/**
 * The `<img>` attributes `next/image` would render for `input`, computed on the
 * server. Spread them onto a plain `<img>` and pass `alt` explicitly so the
 * a11y lint can see it.
 */
export function optimizedImageProps(input: OptimizedImageInput): Record<string, unknown> {
  const { props } = getImgProps(input, {
    defaultLoader,
    // Replaced at build time by Next's define step, exactly as in image-external.js.
    imgConf: process.env.__NEXT_IMAGE_OPTS as unknown as ImageConfigComplete,
  })
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (value !== undefined) out[key] = value
  }
  return out
}

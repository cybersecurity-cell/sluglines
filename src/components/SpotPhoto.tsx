import Image from 'next/image'
import { Route } from 'lucide-react'
import type { SpotImage } from '@/lib/domain/locations'

interface SpotPhotoProps {
  image?: SpotImage
  spotName: string
}

/**
 * The spot's media area — `Docs/asset-register.md`: *"reserve a stable 4:3 media
 * area, but show a neutral route graphic until a current approved photograph
 * exists."*
 *
 * The 4:3 box is reserved in **both** states, which is the whole design. A page
 * that grows a media slot only when a file exists reflows the moment one is
 * added, and reads as broken when one is missing; a page that reserves the box
 * and says what is in it reads as complete either way.
 *
 * WHAT THE POPULATED BRANCH SHOWS
 * ---------------------------------------------------------------------------
 * A **transit diagram**, never a photograph. 8 spots carry one, migrated on
 * 2026-08-22 (D-58) — drawn agency lot diagrams with bus-bay listings, space
 * counts and legends. So the populated branch does three things a photo slot
 * would not: it uses `object-contain` rather than `object-cover`, because
 * cropping a map to fill a box destroys the legend and the scale bar that make
 * it a map; it sits on a light ground so a diagram with a white background does
 * not appear to float; and it prints the source underneath rather than relying
 * on a credit that may or may not be in the pixels.
 *
 * The other 42 spots render the second branch. Its copy no longer promises we
 * refuse satellite views: the 12 Google aerials were refused on *rights*, not
 * on principle, and a page should not claim a discipline that was not the
 * reason. What it says instead is the narrower true thing — nobody has
 * photographed this spot, and no diagram was published for it either.
 */
export default function SpotPhoto({ image, spotName }: SpotPhotoProps) {
  if (image) {
    return (
      <figure className="w-full">
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-white">
          <Image
            src={image.src}
            alt={image.alt}
            width={image.width}
            height={image.height}
            sizes="(min-width: 1024px) 360px, 100vw"
            className="h-full w-full object-contain"
          />
        </div>
        <figcaption className="mt-2 text-xs leading-relaxed text-slate-600">
          Transit diagram, not a photograph. Migrated from sluglines.com on {image.fetchedAt}; the
          issuing agency&rsquo;s credit, where present, is part of the image.
        </figcaption>
      </figure>
    )
  }

  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-100 px-6 text-center">
      <RouteGraphic />
      <p className="text-sm font-semibold text-slate-700">No diagram for this spot yet</p>
      <p className="max-w-xs text-xs leading-relaxed text-slate-600">
        No photograph of {spotName} exists here, and the legacy site published no diagram for it
        either. Use <span className="font-semibold">Open in Maps</span> to see it from above.
      </p>
    </div>
  )
}

/**
 * A route line, drawn. Original and code-native, per the asset register's Phase 1
 * visual requirement — it costs no image rights, needs no network request, and
 * cannot be mistaken for a photograph of anywhere.
 */
function RouteGraphic() {
  return (
    <span
      aria-hidden
      className="flex h-12 w-12 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500"
    >
      <Route className="h-6 w-6" />
    </span>
  )
}

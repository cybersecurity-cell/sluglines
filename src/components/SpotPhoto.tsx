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
 * that grows a photo slot only when a photo exists reflows the moment one is
 * added, and reads as broken when one is missing; a page that reserves the box
 * and says what is in it reads as complete either way.
 *
 * No spot has a photograph today (issue #18, `Docs/DECISIONS.md` D-39), so what
 * every spot renders is the second branch. It is deliberately a drawn graphic
 * and a sentence, not an `<img>` with a missing file, not a stretched placeholder
 * photo, and not a satellite tile standing in for a photograph nobody took —
 * the same discipline as `null` coordinates never being guessed (D-31) and counts
 * rendering `unavailable` rather than a fabricated zero (D-33).
 */
export default function SpotPhoto({ image, spotName }: SpotPhotoProps) {
  if (image) {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
        <Image
          src={image.src}
          alt={image.alt}
          width={image.width}
          height={image.height}
          sizes="(min-width: 1024px) 360px, 100vw"
          className="h-full w-full object-cover"
        />
      </div>
    )
  }

  return (
    <div className="flex aspect-[4/3] w-full flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-slate-300 bg-slate-100 px-6 text-center">
      <RouteGraphic />
      <p className="text-sm font-semibold text-slate-700">No photograph of this spot yet</p>
      <p className="max-w-xs text-xs leading-relaxed text-slate-600">
        We would rather show nothing than a stock image or a satellite view of the car park. Use{' '}
        <span className="font-semibold">Open in Maps</span> to see {spotName} from above.
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

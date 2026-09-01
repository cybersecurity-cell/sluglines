import { Users } from 'lucide-react'
import { getCommunityChannelsForSpot } from '@/lib/community-channels'

interface CommunityLinksCardProps {
  spotSlug?: string | null
  fallbackUrl?: string | null
}

export default function CommunityLinksCard({ spotSlug, fallbackUrl }: CommunityLinksCardProps) {
  const channels = getCommunityChannelsForSpot(spotSlug)
  const visibleChannels =
    channels.length > 0
      ? channels
      : fallbackUrl
        ? [{ name: 'Community Group', url: fallbackUrl, platform: 'facebook' as const, spotSlugs: [], description: 'Public Facebook community group' }]
        : []

  if (visibleChannels.length === 0) {
    return null
  }

  return (
    <section className="rounded-lg border border-stone-200 bg-white p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-[#EAF2ED] p-2 text-[#2E7D46]">
          <Users className="h-5 w-5" />
        </div>
        <div>
          <h2 className="h-display text-xl text-[#17202A]">Community groups</h2>
          <p className="mt-1 text-sm leading-6 text-slate-600">
            Public Facebook groups commuters use to share route updates and coordinate around this slug line.
          </p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visibleChannels.map((channel) => (
          <a
            key={`${channel.name}-${channel.url}`}
            href={channel.url}
            target="_blank"
            rel="noopener noreferrer"
            className="block rounded-lg border border-stone-200 bg-[#FAFAF8] p-4 transition-colors hover:border-[#2E7D46] hover:bg-[#EAF2ED]"
          >
            <div className="text-sm font-bold text-[#17202A]">{channel.name}</div>
            {/* The darker accent, not #2E7D46: this label sits on the accent
                tint once the card is hovered, where #2E7D46 is 4.45:1. */}
            <div className="mt-1 font-mono text-xs font-semibold uppercase tracking-wide text-[#1F5C33]">Facebook group</div>
          </a>
        ))}
      </div>
    </section>
  )
}

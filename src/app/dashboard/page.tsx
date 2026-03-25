import RealTimeBoard from '@/components/RealTimeBoard'

export const metadata = {
  title: 'Live Board â Sluglines',
  description: 'Real-time driver and rider counts at all Northern Virginia slug line spots.',
}

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <div className="mb-10">
        <p className="section-label mb-3">Real-time</p>
        <h1 className="text-4xl md:text-5xl text-white mb-4" style={{ fontFamily: 'Syne, sans-serif', fontWeight: 800, letterSpacing: '-0.02em' }}>Live Board</h1>
        <p className="text-lg max-w-xl" style={{ color: 'var(--muted)' }}>
          Driver and rider counts at each slug line spot. Tap {' '}
          <strong className="text-white">+ I am Driving</strong> or{' '}
          <strong className="text-white">+ I am Riding</strong> when you arrive.
        </p>
      </div>
      <div className="rounded-xl border p-5 mb-10" style={{ background: 'rgba(99,179,237,0.05)', borderColor: 'rgba(99,179,237,0.2)' }}>
        <h3 className="font-semibold text-white text-sm mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>How to use this board</h3>
        <ul className="text-sm space-y-1.5" style={{ color: 'var(--muted)' }}>
          <li>â¢ Find your nearest pickup spot below</li>
          <li>â¢ Tap <strong className="text-white">+ I am Driving</strong> when you arrive ready to pick up 2 riders</li>
          <li>â¢ Tap <strong className="text-white">+ I am Riding</strong> when you are waiting for a driver</li>
          <li>â¢ Counts reset automatically every morning at 6 AM</li>
        </ul>
      </div>
      <RealTimeBoard />
    </div>
  )
}

import RealTimeBoard from '@/components/RealTimeBoard'
import { MapPin } from 'lucide-react'

export const metadata = {
  title: 'Live Board — Sluglines',
  description: 'Real-time driver and rider counts at all Northern Virginia slug line spots.',
}

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      {/* Page Header */}
      <div className="mb-8">
        <div className="flex items-center gap-2 text-sm text-blue-600 font-medium mb-2">
          <MapPin className="w-4 h-4" />
          Northern Virginia HOV-3 Spots
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900">Live Board</h1>
        <p className="text-slate-600 mt-2 max-w-xl">
          Real-time driver and rider counts at each slug line spot. 
          Tap <strong>+ I am Driving</strong> or <strong>+ I am Riding</strong> to update your spot.
        </p>
      </div>

      {/* How to use */}
      <div className="bg-blue-50 border border-blue-100 rounded-2xl p-4 mb-8">
        <h3 className="font-semibold text-blue-900 text-sm mb-2">How to use this board</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• Find your nearest pickup spot below</li>
          <li>• Tap <strong>+ I am Driving</strong> when you arrive ready to pick up 2 riders</li>
          <li>• Tap <strong>+ I am Riding</strong> when you are waiting for a driver</li>
          <li>• Counts reset automatically every morning at 6 AM</li>
        </ul>
      </div>

      {/* Real-Time Board Component */}
      <RealTimeBoard />
    </div>
  )
}

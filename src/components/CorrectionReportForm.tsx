import { correctionCategories } from '@/lib/domain/correction-report'

interface LocationOption { id: string; name: string }
interface CorrectionReportFormProps {
  action: string | ((formData: FormData) => void | Promise<void>)
  locations: LocationOption[]
}

const labels: Record<(typeof correctionCategories)[number], string> = {
  location: 'Pickup location', route: 'Route or destination', schedule: 'Operating time', parking: 'Parking', transit: 'Transit connection', safety: 'Safety information', other: 'Other',
}
const control = 'mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100'

export function CorrectionReportForm({ action, locations }: CorrectionReportFormProps) {
  return (
    <form action={action as string} className="grid gap-5 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
      <div aria-hidden="true" className="absolute -left-[10000px]"><label htmlFor="website">Website</label><input autoComplete="off" id="website" name="website" tabIndex={-1} type="text" /></div>
      <div>
        <label className="block text-sm font-bold" htmlFor="report-location">Location, if applicable</label>
        <select className={control} id="report-location" name="locationId"><option value="">General correction</option>{locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}</select>
      </div>
      <div>
        <label className="block text-sm font-bold" htmlFor="report-category">What needs correction?</label>
        <select className={control} id="report-category" name="category" required><option value="">Choose a category</option>{correctionCategories.map((category) => <option key={category} value={category}>{labels[category]}</option>)}</select>
      </div>
      <div><label className="block text-sm font-bold" htmlFor="report-summary">Short summary</label><input className={control} id="report-summary" maxLength={160} minLength={10} name="summary" required /><p className="mt-2 text-xs text-slate-500">10–160 characters</p></div>
      <div><label className="block text-sm font-bold" htmlFor="report-details">What changed, and how can it be checked?</label><textarea className={`${control} min-h-40 py-3`} id="report-details" maxLength={3000} minLength={20} name="details" required /><p className="mt-2 text-xs text-slate-500">20–3,000 characters. Do not include private commuter information.</p></div>
      <div><label className="block text-sm font-bold" htmlFor="report-source">Supporting HTTPS link, if available</label><input className={control} id="report-source" name="sourceUrl" placeholder="https://" type="url" /></div>
      <button className="min-h-12 justify-self-start rounded-xl bg-blue-700 px-6 font-bold text-white hover:bg-blue-800" type="submit">Report a correction</button>
    </form>
  )
}

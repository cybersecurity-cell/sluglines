import type { CommutePreferencesValue } from '@/lib/account/validation'

interface Option { id: string; name: string }
interface PreferencesFormProps {
  action: string | ((formData: FormData) => void | Promise<void>)
  destinations: Option[]
  locations: Option[]
  value: CommutePreferencesValue
}

const control = 'mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3'

export function PreferencesForm({ action, destinations, locations, value }: PreferencesFormProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-black">Commute preferences</h2>
      <p className="mt-2 text-sm text-slate-600">These choices help keep your account useful; they are not shown publicly.</p>
      <form action={action as string} className="mt-5 grid gap-5">
        <div>
          <label className="block text-sm font-bold" htmlFor="home-location">Home pickup location</label>
          <select className={control} defaultValue={value.homeLocationId ?? ''} id="home-location" name="homeLocationId">
            <option value="">No preference</option>
            {locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold" htmlFor="preferred-destination">Preferred destination</label>
          <select className={control} defaultValue={value.destinationId ?? ''} id="preferred-destination" name="destinationId">
            <option value="">No preference</option>
            {destinations.map((destination) => <option key={destination.id} value={destination.id}>{destination.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-bold" htmlFor="preferred-direction">Usual direction</label>
          <select className={control} defaultValue={value.preferredDirection ?? ''} id="preferred-direction" name="preferredDirection">
            <option value="">No preference</option>
            <option value="inbound">Morning inbound</option>
            <option value="outbound">Afternoon outbound</option>
            <option value="both">Both</option>
          </select>
        </div>
        <label className="flex items-start gap-3 text-sm">
          <input className="mt-1 size-4" defaultChecked={value.emailAdvisories} name="emailAdvisories" type="checkbox" />
          <span><strong className="block">Email me about published advisories</strong><span className="text-slate-600">Only for locations connected with my preferences.</span></span>
        </label>
        <button className="min-h-11 justify-self-start rounded-xl bg-blue-700 px-5 font-bold text-white hover:bg-blue-800" type="submit">Save preferences</button>
      </form>
    </section>
  )
}

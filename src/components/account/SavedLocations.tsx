import Link from 'next/link'

interface SavedLocation { id: string; name: string; slug: string }

interface SavedLocationsProps {
  action: string | ((formData: FormData) => void | Promise<void>)
  locations: SavedLocation[]
}

export function SavedLocations({ action, locations }: SavedLocationsProps) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-black">Saved locations</h2>
      {locations.length === 0 ? (
        <div className="mt-4 rounded-xl bg-slate-50 p-5">
          <p className="font-bold">No saved locations yet.</p>
          <p className="mt-2 text-sm text-slate-600">Browse the directory and save a useful pickup point.</p>
          <Link className="mt-4 inline-flex font-bold text-blue-700 hover:underline" href="/locations">Browse locations</Link>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-slate-200">
          {locations.map((location) => (
            <li className="flex flex-wrap items-center justify-between gap-3 py-4" key={location.id}>
              <Link className="font-bold text-blue-700 hover:underline" href={`/locations/${location.slug}`}>{location.name}</Link>
              <form action={action as string}>
                <input name="locationId" type="hidden" value={location.id} />
                <button className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-bold text-slate-700 hover:bg-slate-100" type="submit">Remove</button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

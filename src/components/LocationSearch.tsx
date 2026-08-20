interface LocationSearchProps {
  query?: string
  corridor?: string
  direction?: string
}

export function LocationSearch({ query = '', corridor = '', direction = '' }: LocationSearchProps) {
  return (
    <form action="/locations" className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-[1fr_auto_auto_auto] md:items-end" method="get" role="search">
      <div>
        <label className="block text-sm font-semibold text-slate-800" htmlFor="location-query">Pickup area or destination</label>
        <input
          className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 px-3 text-base text-slate-950 outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100"
          defaultValue={query}
          id="location-query"
          name="query"
          placeholder="Try Woodbridge or Pentagon"
          type="search"
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-800" htmlFor="location-corridor">Corridor</label>
        <select className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950" defaultValue={corridor} id="location-corridor" name="corridor">
          <option value="">All corridors</option>
          <option value="I-95/I-395">I-95 / I-395</option>
          <option value="I-66">I-66</option>
          <option value="Other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-800" htmlFor="location-direction">Direction</label>
        <select className="mt-2 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base text-slate-950" defaultValue={direction} id="location-direction" name="direction">
          <option value="">Any direction</option>
          <option value="inbound">Morning inbound</option>
          <option value="outbound">Afternoon outbound</option>
          <option value="both">Both</option>
        </select>
      </div>
      <button className="min-h-11 rounded-xl bg-blue-700 px-5 font-semibold text-white hover:bg-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2" type="submit">
        Find locations
      </button>
    </form>
  )
}

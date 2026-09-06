'use client'

import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import SpotDirectorySection from '@/components/SpotDirectorySection'
import type { DirectorySpot } from '@/lib/spot-directory'
import { filterSpots, SpotFilters } from '@/lib/spot-search'

interface SpotSearchProps {
  spots: DirectorySpot[]
}

const DEFAULT_FILTERS: SpotFilters = {
  query: '',
  corridor: 'all',
  direction: 'all',
  status: 'all',
}

export default function SpotSearch({ spots }: SpotSearchProps) {
  const [filters, setFilters] = useState<SpotFilters>(DEFAULT_FILTERS)
  const filteredSpots = useMemo(() => filterSpots(spots, filters), [filters, spots])

  return (
    <div>
      <section className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_180px_160px_150px]">
            <label className="relative block">
              <span className="sr-only">Search pickup locations</span>
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input
                className="h-11 w-full rounded-lg border border-stone-500 bg-white pl-9 pr-3 text-sm text-[#17202A] outline-none focus:border-[#2E7D46] focus:ring-2 focus:ring-[#2E7D46]"
                placeholder="Search spot, destination, or county"
                value={filters.query}
                onChange={(event) => setFilters((current) => ({ ...current, query: event.target.value }))}
              />
            </label>

            <FilterSelect
              label="Corridor"
              value={filters.corridor}
              onChange={(value) => setFilters((current) => ({ ...current, corridor: value as SpotFilters['corridor'] }))}
              options={['all', 'I-395 / I-95', 'I-66']}
            />
            <FilterSelect
              label="Direction"
              value={filters.direction}
              onChange={(value) => setFilters((current) => ({ ...current, direction: value as SpotFilters['direction'] }))}
              options={['all', 'Morning', 'Afternoon']}
            />
            <FilterSelect
              label="Status"
              value={filters.status}
              onChange={(value) => setFilters((current) => ({ ...current, status: value as SpotFilters['status'] }))}
              options={['all', 'active', 'inactive']}
            />
          </div>
          <p className="mt-3 text-sm text-slate-500">
            Showing {filteredSpots.length} of {spots.length} known slug line locations.
          </p>
        </div>
      </section>

      <SpotDirectorySection
        spots={filteredSpots}
        title="Pickup and return locations"
        description="The directory follows the established sluglines.com structure: corridor, morning or afternoon direction, then county or city."
      />
    </div>
  )
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: string
  options: string[]
  onChange: (value: string) => void
}) {
  return (
    <label className="block">
      <span className="sr-only">{label}</span>
      <select
        className="h-11 w-full rounded-lg border border-stone-500 bg-white px-3 text-sm font-semibold text-[#17202A] outline-none focus:border-[#2E7D46] focus:ring-2 focus:ring-[#2E7D46]"
        value={value}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map((option) => (
          <option key={option} value={option}>
            {option === 'all' ? `All ${label.toLowerCase()}` : option}
          </option>
        ))}
      </select>
    </label>
  )
}

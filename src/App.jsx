import { useState, useMemo } from 'react'
import NavBar from './components/NavBar.jsx'
import ControlsBar from './components/ControlsBar.jsx'
import MapView from './components/MapView.jsx'
import FilterBar, { DEFAULT_FILTERS } from './components/FilterBar.jsx'

export default function App() {
  const [filters,     setFilters]     = useState(DEFAULT_FILTERS)
  const [search,      setSearch]      = useState('')
  const [sort,        setSort]        = useState('featured')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const activeFilterCount = useMemo(() => [
    filters.price.label    !== 'Any Price',
    filters.location.label !== 'All Locations',
    filters.delivery.label !== 'Any Delivery',
    filters.bua.label      !== 'Any Size',
    filters.badge          !== 'All',
  ].filter(Boolean).length, [filters])

  return (
    <div className="app">
      <NavBar />
      <ControlsBar
        search={search}
        onSearchChange={setSearch}
        sort={sort}
        onSortChange={setSort}
        filtersOpen={filtersOpen}
        onToggleFilters={() => setFiltersOpen(o => !o)}
        activeFilterCount={activeFilterCount}
      />
      {filtersOpen && <FilterBar filters={filters} onChange={setFilters} />}
      <MapView filters={filters} search={search} sort={sort} />
    </div>
  )
}

import { useState } from 'react'
import NavBar from './components/NavBar.jsx'
import MapView from './components/MapView.jsx'
import FilterBar, { DEFAULT_FILTERS } from './components/FilterBar.jsx'

export default function App() {
  const [filters, setFilters] = useState(DEFAULT_FILTERS)
  const [search,  setSearch]  = useState('')

  return (
    <div className="app">
      <NavBar />
      <FilterBar filters={filters} onChange={setFilters} />
      <MapView
        filters={filters}
        search={search}
        onSearchChange={setSearch}
      />
    </div>
  )
}

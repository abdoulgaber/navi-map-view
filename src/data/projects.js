/**
 * Base locations use coordinates that sit precisely inside the named
 * area as shown on OpenStreetMap tiles. scatter is in degrees; 0.03 ≈ 3 km.
 */
export const BASE_LOCATIONS = [
  { area: 'New Cairo',              lat: 30.0271,  lng: 31.4961,  scatter: 0.04 },
  { area: '6th October City',       lat: 29.9462,  lng: 30.9347,  scatter: 0.04 },
  { area: 'Alexandria',             lat: 31.2001,  lng: 29.9187,  scatter: 0.06 },
  { area: 'North Coast',            lat: 31.0600,  lng: 28.4800,  scatter: 0.20 },
  { area: 'Ain Sokhna',             lat: 29.5921,  lng: 32.3379,  scatter: 0.03 },
  { area: 'New Administrative Capital', lat: 30.0059, lng: 31.7326, scatter: 0.04 },
  { area: 'Madinaty',               lat: 30.1104,  lng: 31.6517,  scatter: 0.02 },
  { area: 'Shorouk City',           lat: 30.1225,  lng: 31.6106,  scatter: 0.02 },
  { area: 'Obour City',             lat: 30.2036,  lng: 31.5370,  scatter: 0.02 },
  { area: 'Sheikh Zayed',           lat: 30.0582,  lng: 30.9729,  scatter: 0.03 },
  { area: 'Heliopolis',             lat: 30.0884,  lng: 31.3219,  scatter: 0.02 },
  { area: 'Nasr City',              lat: 30.0648,  lng: 31.3367,  scatter: 0.02 },
  { area: 'New Alamein',            lat: 30.8386,  lng: 28.9553,  scatter: 0.04 },
  { area: 'Hurghada',               lat: 27.2579,  lng: 33.8116,  scatter: 0.04 },
  { area: 'Mansoura',               lat: 31.0409,  lng: 31.3785,  scatter: 0.03 },
  { area: 'Ismailia',               lat: 30.5965,  lng: 32.2715,  scatter: 0.03 },
  { area: 'Zamalek',                lat: 30.0621,  lng: 31.2195,  scatter: 0.01 },
  { area: 'Tanta',                  lat: 30.7865,  lng: 30.9965,  scatter: 0.03 },
  { area: 'Sharm El-Sheikh',        lat: 27.9140,  lng: 34.3286,  scatter: 0.04 },
  { area: 'Suez',                   lat: 29.9737,  lng: 32.5276,  scatter: 0.03 },
  { area: 'Damietta',               lat: 31.4165,  lng: 31.8133,  scatter: 0.02 },
  { area: 'Assiut',                 lat: 27.1783,  lng: 31.1859,  scatter: 0.03 },
  { area: 'Luxor',                  lat: 25.6872,  lng: 32.6396,  scatter: 0.03 },
  { area: 'Beni Suef',              lat: 29.0744,  lng: 31.0980,  scatter: 0.03 },
  { area: 'Port Said',              lat: 31.2565,  lng: 32.2841,  scatter: 0.03 },
]

const DEVELOPERS = [
  'Emaar Misr', 'Palm Hills', 'SODIC', 'Orascom', 'Talaat Moustafa',
  'Hyde Park', 'Mountain View', 'Misr Italia', 'Ora Developers',
  'City Edge', 'Dorra Group', 'Memaar Al Morshedy', 'Al Ahly Sabbour',
  'Crown Egypt', 'Akam Developments', 'Tatweer Misr', 'Inertia',
  'Hassan Allam Properties', 'Rooya Group', 'La Vista', 'Misr Real Estate',
  'Iwan Developments', 'Wadi Degla', 'Orientals', 'Horizon Egypt',
  'Capital Group Properties', 'Gates Developments', 'Neopolis', 'SAK Egypt',
  'Mabany Edris',
]

const PROJECT_NAMES = [
  'The Gate', 'Misr Spain', 'New One', 'The Crown', 'The Meridian',
  'Marina Towers', 'Madinaty', 'Villette', 'Eastown', 'JEFAIRA',
  'O West', 'Bloomfields', 'The Estates', 'Zed East', 'Golf District',
  'Park Side', 'Lake Front', 'The Square', 'Veranda', 'Garden 8',
  'Stone Park', 'Mountain Park', 'Ridge', 'Nile Front', 'Soleil',
  'Lakeyard', 'Catalan', 'Elora', 'Soma Bay', 'Swan Lake',
  'Riviera', 'Serrano', 'Celia', 'Helios', 'Latitude',
  'The Peak', 'Cleo', 'Skyline', 'Cascade', 'Rivan',
  'Il Bosco', 'Kinda', '90 Avenue', 'Hyde Out', 'The Boulevard',
  'Midtown', 'District 5', 'Raya', 'Alma', 'Azure',
  'Silverine', 'The Orchard', 'Oasis', 'Marquis', 'Harbor Walk',
  'Trio Gardens', 'ZED Towers', 'Plage', 'Azzar', 'Sarai',
]

const DESCRIPTIONS = [
  'Experience modern living in the heart of Egypt\'s most vibrant community.',
  'Luxury residences designed for comfort, convenience, and connection.',
  'Smartly planned spaces with easy access to schools, malls, and highways.',
  'Your new lifestyle begins in a gated community with greenery and peace.',
  'Discover affordable elegance in one of Egypt\'s fastest-growing districts.',
  'A premium blend of location, design, and long-term investment value.',
  'Beachfront living with world-class amenities at your doorstep.',
  'Contemporary architecture meets lush landscape in this iconic community.',
  'Redefining urban living with smart homes and sustainable design.',
  'Exclusive residences with panoramic views and resort-style facilities.',
  'Where family living meets modern urban sophistication.',
  'Mediterranean-inspired homes with all the essentials of modern life.',
  'An integrated community offering retail, dining, schools, and parks.',
  'Live, work, and play in Egypt\'s most dynamic mixed-use destination.',
  'Elevated living with curated interiors and premium finishes.',
]

const UNIT_TYPES = ['Studio', 'Apartment', 'Duplex', 'Penthouse', 'Villa', 'Twin House', 'Town House']

/** Residential/Mixed/Commercial split: deterministic by id */
const PROJECT_TYPES = ['Residential', 'Residential', 'Residential', 'Mixed', 'Commercial']

function seededRandom(seed) {
  let s = seed
  return () => {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

/* Every project needs a distinct name — map chips carry the name, so two
   "The Crown" pills side by side read as a duplicate/bug. Repeats become
   phases the way developers actually name them: The Crown II, III … */
const ROMAN = ['', ' II', ' III', ' IV', ' V', ' VI', ' VII', ' VIII', ' IX', ' X',
               ' XI', ' XII', ' XIII', ' XIV', ' XV', ' XVI', ' XVII', ' XVIII']
function makeNamer() {
  const seen = new Map()
  return (base) => {
    const n = seen.get(base) ?? 0
    seen.set(base, n + 1)
    return n < ROMAN.length ? `${base}${ROMAN[n]}` : `${base} ${n + 1}`
  }
}

function generateProjects() {
  const projects = []
  const uniqueName = makeNamer()
  let id = 1

  for (let locIdx = 0; locIdx < BASE_LOCATIONS.length; locIdx++) {
    const loc   = BASE_LOCATIONS[locIdx]
    // More projects for major Cairo-area locations
    // Density mirrors the real market: the New-Cairo/October belt carries
    // most inventory. Sized to stress-test pin decluttering (~1,500).
    const count = locIdx < 6 ? 120 : locIdx < 12 ? 60 : 28

    for (let i = 0; i < count; i++) {
      const rng = seededRandom(id * 9301 + 49297)

      // Keep markers tightly inside the named OSM zone
      const lat = loc.lat + (rng() - 0.5) * loc.scatter * 2
      const lng = loc.lng + (rng() - 0.5) * loc.scatter * 2

      const developer  = DEVELOPERS[(id * 7 + locIdx) % DEVELOPERS.length]
      const name       = uniqueName(PROJECT_NAMES[(id * 3 + i) % PROJECT_NAMES.length])
      const desc       = DESCRIPTIONS[(id + i) % DESCRIPTIONS.length]
      const type       = PROJECT_TYPES[(id * 3) % PROJECT_TYPES.length]

      // Price ranges differ by type
      const basePriceM =
        type === 'Commercial' ? rng() * 25 + 5 :
        type === 'Mixed'      ? rng() * 20 + 3 :
                                rng() * 15 + 0.5
      const price = basePriceM >= 1
        ? `EGP ${Math.round(basePriceM * 1_000_000).toLocaleString()}`
        : `EGP ${Math.round(basePriceM * 1_000_000).toLocaleString()}`

      const bua           = Math.floor(rng() * 260 + 60)
      const deliveryOpts  = [0, 1, 1.5, 2, 3, 3.5, 4, 5]
      const deliveryYears = deliveryOpts[Math.floor(rng() * deliveryOpts.length)]
      const cashDiscount  = Math.floor(rng() * 25 + 5)
      const maintenance   = Math.floor(rng() * 10 + 4)
      const parking       = Math.floor(rng() * 200 + 100) * 1000

      const badgeRoll = rng()
      const badges =
        badgeRoll > 0.72 ? ['Trendy'] :
        badgeRoll > 0.48 ? ['Incentive'] :
        badgeRoll > 0.33 ? ['Trendy', 'Incentive'] : []

      const hoursAgo = Math.floor(rng() * 23 + 1)
      const units    = UNIT_TYPES.filter(() => rng() > 0.4)

      projects.push({
        id,
        developer,
        name,
        location: loc.area,
        description: desc,
        type,
        lat,
        lng,
        price,
        priceValue: Math.round(basePriceM * 1_000_000), // for range filtering
        bua: `${bua} M²`,
        buaValue: bua,
        delivery: deliveryYears === 0 ? 'Ready Now' : `${deliveryYears} Year${deliveryYears !== 1 ? 's' : ''}`,
        deliveryValue: deliveryYears,
        cashDiscount: `${cashDiscount}%`,
        maintenance: `${maintenance}%`,
        parking: `${parking.toLocaleString()} EGP`,
        badges,
        lastUpdate: `${hoursAgo} Hour${hoursAgo !== 1 ? 's' : ''} ago`,
        units: units.length ? units : ['Apartment'],
      })
      id++
    }
  }

  return projects
}

export const projects = generateProjects()

// Unique area list for location filter
export const AREAS = ['All', ...BASE_LOCATIONS.map(l => l.area)]

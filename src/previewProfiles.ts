export type PreviewLayout =
  | 'weather-dashboard'
  | 'country-profile'
  | 'market-chart'
  | 'media-gallery'
  | 'location-map'
  | 'calendar-timeline'
  | 'solar-cycle'
  | 'natural-events'
  | 'transit-board'
  | 'trivia-game'
  | 'developer-feed'
  | 'security-center'
  | 'research-library'
  | 'dictionary-entry'
  | 'data-table'
  | 'fuel-dashboard'
  | 'marine-forecast'
  | 'awards-timeline'
  | 'chess-ratings'
  | 'scholarly-search'
  | 'result-list'

export type PreviewProfile = {
  layout: PreviewLayout
  label: string
}

const profileEntries: Array<[id: string, layout: PreviewLayout, label: string]> = [
  ['countries', 'country-profile', 'Country intelligence profile'],
  ['weather', 'weather-dashboard', 'Live weather cockpit'],
  ['people', 'media-gallery', 'Generated people directory'],
  ['dogs', 'media-gallery', 'Random dog photo wall'],
  ['posts', 'developer-feed', 'REST post inspector'],
  ['holidays', 'calendar-timeline', 'International holiday planner'],
  ['geocoding-search', 'location-map', 'Global geocoding result map'],
  ['open-meteo-air-quality', 'weather-dashboard', 'Coordinate air-quality monitor'],
  ['sunrise-sunset', 'solar-cycle', 'Daylight and solar clock'],
  ['nasa-eonet-events', 'natural-events', 'NASA Earth event monitor'],
  ['mbta-transit-routes', 'transit-board', 'Boston transit route board'],
  ['open-trivia', 'trivia-game', 'Interactive trivia question deck'],
  ['carbon-intensity-gb', 'data-table', 'Great Britain carbon gauge'],
  ['data-gov-24hr-forecast', 'weather-dashboard', 'Singapore 24-hour outlook'],
  ['data-gov-4day-forecast', 'weather-dashboard', 'Singapore four-day planner'],
  ['data-gov-air-temperature', 'weather-dashboard', 'Temperature station network'],
  ['data-gov-carpark', 'location-map', 'Carpark capacity locator'],
  ['data-gov-forecast-2hr', 'weather-dashboard', 'Neighbourhood forecast matrix'],
  ['data-gov-pm25', 'weather-dashboard', 'PM2.5 regional monitor'],
  ['data-gov-psi', 'weather-dashboard', 'PSI regional health panel'],
  ['data-gov-rainfall', 'weather-dashboard', 'Rain gauge station network'],
  ['data-gov-relative-humidity', 'weather-dashboard', 'Humidity sensor network'],
  ['data-gov-taxi', 'location-map', 'Available taxi live map'],
  ['data-gov-traffic-images', 'media-gallery', 'Traffic camera operations wall'],
  ['data-gov-uv-index', 'weather-dashboard', 'UV exposure timeline'],
  ['data-gov-wind-direction', 'weather-dashboard', 'Wind direction station compass'],
  ['data-gov-wind-speed', 'weather-dashboard', 'Wind speed station dashboard'],
  ['data-usa', 'market-chart', 'United States population explorer'],
  ['devto', 'developer-feed', 'DEV article discovery feed'],
  ['fiscal-data-treasury', 'market-chart', 'Treasury fiscal data ledger'],
  ['github', 'developer-feed', 'GitHub repository command center'],
  ['hacker-news', 'developer-feed', 'Hacker News story brief'],
  ['ipify-public-ip', 'data-table', 'Public IP network card'],
  ['met-museum-object-detail', 'media-gallery', 'Museum object spotlight'],
  ['met-museum-search', 'media-gallery', 'Met collection search wall'],
  ['nhtsa-vpic', 'location-map', 'Vehicle make registry'],
  ['npm-search', 'developer-feed', 'npm package comparison grid'],
  ['nvd-cpe-search', 'security-center', 'CPE product dictionary'],
  ['nvd-cve-detail', 'security-center', 'Single CVE investigation dossier'],
  ['nvd-cves', 'security-center', 'CVE search result center'],
  ['nvd-recent-cves', 'security-center', 'Recently modified CVE watchlist'],
  ['nws-weather', 'data-table', 'US weather alert board'],
  ['postcodes-io', 'location-map', 'UK postcode intelligence card'],
  ['pypi-json', 'developer-feed', 'Python package release profile'],
  ['stack-exchange', 'developer-feed', 'Stack Overflow activity queue'],
  ['uk-bank-holidays', 'calendar-timeline', 'UK bank holiday calendar'],
  ['usaspending', 'data-table', 'Federal award spending ledger'],
  ['usgs', 'location-map', 'Earthquake activity map'],
  ['wikidata-sparql', 'data-table', 'Wikidata query result table'],
  ['world-bank-gdp', 'market-chart', 'Singapore GDP history'],
  ['world-bank-population', 'market-chart', 'Singapore population history'],
  ['frankfurter-sgd-myr-history', 'market-chart', 'SGD/MYR exchange-rate history'],
  ['open-library-search', 'research-library', 'Open Library bookshelf'],
  ['free-dictionary', 'dictionary-entry', 'Word definition study card'],
  ['pokeapi', 'media-gallery', 'Pokémon stat and ability profile'],
  ['art-institute-search', 'media-gallery', 'Art Institute exhibition wall'],
  ['tvmaze-search', 'media-gallery', 'Television show discovery rail'],
  ['open-food-facts', 'media-gallery', 'Food product nutrition label'],
  ['gbif-species-search', 'media-gallery', 'Species taxonomy explorer'],
  ['clinical-trials-search', 'research-library', 'Clinical study registry'],
  ['europe-pmc-search', 'research-library', 'Life-science paper library'],
  ['openfda-drug-labels', 'data-table', 'Regulated drug label viewer'],
  ['coinpaprika-ticker', 'market-chart', 'Cryptocurrency market terminal'],
  ['yahoo-finance-sgx-history', 'market-chart', 'SGX equity history terminal'],
  ['malaysia-fuel-price', 'fuel-dashboard', 'Malaysia weekly fuel-price board'],
  ['open-meteo-marine', 'marine-forecast', 'Coastal and ocean forecast cockpit'],
  ['nobel-prizes', 'awards-timeline', 'Nobel laureate and discovery timeline'],
  ['chess-player-stats', 'chess-ratings', 'Chess performance rating board'],
  ['crossref-works', 'scholarly-search', 'DOI and scholarly works explorer'],
]

export const previewProfileIds = profileEntries.map(([id]) => id)

export const previewProfiles: Record<string, PreviewProfile> = Object.fromEntries(profileEntries.map(([id, layout, label]) =>
  [id, { layout, label }],
))

export const getPreviewProfile = (id: string): PreviewProfile | undefined => previewProfiles[id]

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
  | 'result-list'

export type PreviewProfile = {
  layout: PreviewLayout
  label: string
}

const groups: Array<{ layout: PreviewLayout; label: string; ids: string[] }> = [
  { layout: 'country-profile', label: 'Country profile', ids: ['countries'] },
  { layout: 'weather-dashboard', label: 'Weather dashboard', ids: [
    'weather', 'open-meteo-air-quality', 'data-gov-24hr-forecast', 'data-gov-4day-forecast', 'data-gov-air-temperature',
    'data-gov-forecast-2hr', 'data-gov-pm25', 'data-gov-psi', 'data-gov-rainfall', 'data-gov-relative-humidity',
    'data-gov-uv-index', 'data-gov-wind-direction', 'data-gov-wind-speed',
  ] },
  { layout: 'market-chart', label: 'Market chart', ids: [
    'data-usa', 'fiscal-data-treasury', 'world-bank-gdp', 'world-bank-population', 'frankfurter-sgd-myr-history',
    'coinpaprika-ticker', 'yahoo-finance-sgx-history',
  ] },
  { layout: 'media-gallery', label: 'Visual gallery', ids: [
    'people', 'dogs', 'data-gov-traffic-images', 'met-museum-object-detail', 'met-museum-search', 'pokeapi',
    'art-institute-search', 'tvmaze-search', 'open-food-facts', 'gbif-species-search',
  ] },
  { layout: 'location-map', label: 'Location map', ids: [
    'geocoding-search', 'data-gov-carpark', 'data-gov-taxi', 'nhtsa-vpic', 'postcodes-io', 'usgs',
  ] },
  { layout: 'calendar-timeline', label: 'Calendar timeline', ids: ['holidays', 'uk-bank-holidays'] },
  { layout: 'solar-cycle', label: 'Solar cycle', ids: ['sunrise-sunset'] },
  { layout: 'natural-events', label: 'Natural events', ids: ['nasa-eonet-events'] },
  { layout: 'transit-board', label: 'Transit board', ids: ['mbta-transit-routes'] },
  { layout: 'trivia-game', label: 'Trivia game', ids: ['open-trivia'] },
  { layout: 'developer-feed', label: 'Developer cards', ids: [
    'posts', 'devto', 'github', 'hacker-news', 'npm-search', 'pypi-json', 'stack-exchange',
  ] },
  { layout: 'security-center', label: 'Security advisories', ids: [
    'nvd-cpe-search', 'nvd-cve-detail', 'nvd-cves', 'nvd-recent-cves',
  ] },
  { layout: 'research-library', label: 'Research library', ids: [
    'open-library-search', 'clinical-trials-search', 'europe-pmc-search',
  ] },
  { layout: 'dictionary-entry', label: 'Dictionary entry', ids: ['free-dictionary'] },
  { layout: 'data-table', label: 'Structured data cards', ids: [
    'carbon-intensity-gb', 'ipify-public-ip', 'nws-weather', 'usaspending', 'wikidata-sparql', 'openfda-drug-labels',
  ] },
]

export const previewProfileIds = groups.flatMap((group) => group.ids)

export const previewProfiles: Record<string, PreviewProfile> = Object.fromEntries(groups.flatMap((group) =>
  group.ids.map((id) => [id, { layout: group.layout, label: group.label }]),
))

export const getPreviewProfile = (id: string): PreviewProfile | undefined => previewProfiles[id]

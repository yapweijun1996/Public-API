export type PreviewLayout =
  | 'security-scorecard'
  | 'grammar-review'
  | 'vehicle-recalls'
  | 'color-swatch'
  | 'carbon-intensity'
  | 'terrain-elevation'
  | 'flood-stations'
  | 'water-gauge'
  | 'population-statistic'
  | 'refugee-population'
  | 'household-income'
  | 'population-total'
  | 'humanitarian-events'
  | 'sdg-goals'
  | 'satellite-orbits'
  | 'marine-occurrences'
  | 'marine-taxonomy'
  | 'fossil-taxon'
  | 'species-observations'
  | 'ip-geolocation'
  | 'boundary-layer'
  | 'f1-season-catalog'
  | 'pro-match-results'
  | 'football-matchday'
  | 'baseball-schedule'
  | 'disaster-declared-areas'
  | 'core-cpi-index'
  | 'food-hygiene-ratings'
  | 'food-product'
  | 'dns-records'
  | 'download-summary'
  | 'release-lifecycle'
  | 'exchange-rates'
  | 'weather-dashboard'
  | 'space-weather-scales'
  | 'country-profile'
  | 'market-chart'
  | 'state-population'
  | 'fx-history'
  | 'central-bank-series'
  | 'labor-timeseries'
  | 'climate-series'
  | 'indicator-series'
  | 'ensemble-forecast'
  | 'historical-weather'
  | 'federal-rulemaking'
  | 'launch-schedule'
  | 'anime-media-search'
  | 'generated-qr-code'
  | 'generated-avatar'
  | 'commons-media-search'
  | 'dog-gallery'
  | 'public-holiday-calendar'
  | 'uk-bank-holiday-calendar'
  | 'jewish-calendar'
  | 'recipe-search'
  | 'synthetic-people'
  | 'pokemon-profile'
  | 'tv-show-search'
  | 'character-search'
  | 'appstream-profile'
  | 'met-open-access-object'
  | 'itunes-media-search'
  | 'spaceflight-news'
  | 'trading-card-search'
  | 'encyclopedia-search'
  | 'open-access-art-search'
  | 'public-domain-art-search'
  | 'nasa-media-library'
  | 'licensed-media-search'
  | 'archive-search'
  | 'location-map'
  | 'brewery-directory'
  | 'iss-position'
  | 'taxi-availability'
  | 'traffic-camera-snapshot'
  | 'place-geocoding'
  | 'postcode-profile'
  | 'postcode-geolocation'
  | 'street-crime'
  | 'bike-share-network'
  | 'solar-cycle'
  | 'natural-events'
  | 'transit-board'
  | 'swiss-transit-connections'
  | 'trivia-game'
  | 'joke-stage'
  | 'rest-post'
  | 'community-articles'
  | 'repository-list'
  | 'hn-item'
  | 'go-module-versions'
  | 'cdn-package'
  | 'hn-search'
  | 'seasonal-outlook'
  | 'vehicle-safety-rating'
  | 'singapore-cpi'
  | 'scholarly-graph'
  | 'leading-indicator'
  | 'project-search'
  | 'community-questions'
  | 'package-insights'
  | 'npm-package-search'
  | 'composer-package-search'
  | 'cpan-module-search'
  | 'package-registration'
  | 'package-release'
  | 'python-package'
  | 'dart-package'
  | 'hex-package'
  | 'cve-record'
  | 'cpe-product-search'
  | 'nvd-vulnerability'
  | 'nvd-cve-search'
  | 'nvd-modified-watchlist'
  | 'vulnerability-record'
  | 'global-security-advisories'
  | 'security-center'
  | 'research-library'
  | 'poetry-reading-room'
  | 'book-search'
  | 'dblp-publications'
  | 'organization-directory'
  | 'dictionary-entry'
  | 'drug-label'
  | 'food-recalls'
  | 'prayer-schedule'
  | 'drug-terminology'
  | 'coastal-water-level'
  | 'protein-annotation'
  | 'molecular-structure'
  | 'molecule-profile'
  | 'compound-properties'
  | 'gene-locus'
  | 'domain-registration'
  | 'legal-entity'
  | 'bank-institution'
  | 'route-summary'
  | 'transaction-fees'
  | 'availability-board'
  | 'collection-index'
  | 'manufacturer-directory'
  | 'taxonomy-directory'
  | 'motorsport-results'
  | 'quote-card'
  | 'character-dossier'
  | 'federal-agency-overview'
  | 'federal-awards'
  | 'knowledge-entities'
  | 'citation-count'
  | 'parliament-members'
  | 'ai-model-catalog'
  | 'open-data-catalog'
  | 'icon-catalog'
  | 'homebrew-package'
  | 'monster-statblock'
  | 'lexical-matches'
  | 'symbolic-math'
  | 'public-ip'
  | 'cat-fact'
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
  ['people', 'synthetic-people', 'Request-bound synthetic people directory'],
  ['dogs', 'dog-gallery', 'Exact-request Dog CEO image gallery'],
  ['posts', 'rest-post', 'JSONPlaceholder REST post resource'],
  ['holidays', 'public-holiday-calendar', 'Request-bound Nager.Holidays Community v4 calendar'],
  ['hebcal-calendar', 'jewish-calendar', 'Request-bound Hebcal Hebrew-year calendar'],
  ['aladhan-prayer-times', 'prayer-schedule', 'Daily prayer schedule and calendar context'],
  ['geocoding-search', 'place-geocoding', 'Request-bound Open-Meteo place and postal-code search'],
  ['open-meteo-air-quality', 'weather-dashboard', 'Coordinate air-quality monitor'],
  ['sunrise-sunset', 'solar-cycle', 'Daylight and solar clock'],
  ['nasa-eonet-events', 'natural-events', 'NASA Earth event monitor'],
  ['mbta-transit-routes', 'transit-board', 'Boston transit route board'],
  ['open-trivia', 'trivia-game', 'Interactive trivia question deck'],
  ['carbon-intensity-gb', 'carbon-intensity', 'Great Britain carbon intensity'],
  ['data-gov-24hr-forecast', 'weather-dashboard', 'Singapore 24-hour outlook'],
  ['data-gov-4day-forecast', 'weather-dashboard', 'Singapore four-day planner'],
  ['data-gov-air-temperature', 'weather-dashboard', 'Temperature station network'],
  ['data-gov-carpark', 'availability-board', 'Singapore carpark capacity dashboard'],
  ['data-gov-forecast-2hr', 'weather-dashboard', 'Neighbourhood forecast matrix'],
  ['data-gov-pm25', 'weather-dashboard', 'PM2.5 regional monitor'],
  ['data-gov-psi', 'weather-dashboard', 'PSI regional health panel'],
  ['data-gov-rainfall', 'weather-dashboard', 'Rain gauge station network'],
  ['data-gov-relative-humidity', 'weather-dashboard', 'Humidity sensor network'],
  ['data-gov-taxi', 'taxi-availability', 'Live taxi availability map and acquisition snapshot'],
  ['data-gov-traffic-images', 'traffic-camera-snapshot', 'Request-bound LTA traffic camera snapshot'],
  ['data-gov-uv-index', 'weather-dashboard', 'UV exposure timeline'],
  ['data-gov-wind-direction', 'weather-dashboard', 'Wind direction station compass'],
  ['data-gov-wind-speed', 'weather-dashboard', 'Wind speed station dashboard'],
  ['data-usa', 'state-population', '2023 United States state population page'],
  ['devto', 'community-articles', 'DEV published article feed'],
  ['fiscal-data-treasury', 'federal-agency-overview', 'U.S. Treasury agency overview'],
  ['github', 'repository-list', 'GitHub owned public repositories'],
  ['hacker-news', 'hn-item', 'Hacker News item lookup'],
  ['ipify-public-ip', 'public-ip', 'Public IP network identity'],
  ['met-museum-object-detail', 'met-open-access-object', 'Request-bound Met Open Access artwork object'],
  ['met-museum-search', 'collection-index', 'Met collection search index'],
  ['nhtsa-vpic', 'manufacturer-directory', 'Vehicle manufacturer registry'],
  ['nhtsa-vehicle-recalls', 'vehicle-recalls', 'Vehicle defect, consequence and remedy'],
  ['npm-search', 'npm-package-search', 'npm registry package search'],
  ['nvd-cpe-search', 'cpe-product-search', 'Request-bound NVD CPE product dictionary search'],
  ['nvd-cve-detail', 'nvd-vulnerability', 'Request-bound NVD CVE investigation dossier'],
  ['nvd-cves', 'nvd-cve-search', 'Request-bound NVD CVE keyword search'],
  ['nvd-recent-cves', 'nvd-modified-watchlist', 'Request-bound recently modified CVE watchlist'],
  ['postcodes-io', 'postcode-profile', 'Request-bound UK postcode location and administrative geography'],
  ['pypi-json', 'python-package', 'PyPI current project metadata'],
  ['stack-exchange', 'community-questions', 'Stack Overflow tagged activity queue'],
  ['uk-bank-holidays', 'uk-bank-holiday-calendar', 'Request-bound GOV.UK division-aware bank holiday calendar'],
  ['usaspending', 'federal-awards', 'Federal contract award ledger'],
  ['usgs', 'location-map', 'Earthquake activity map'],
  ['wikidata-sparql', 'knowledge-entities', 'Wikidata entity bindings'],
  ['openssf-scorecard', 'security-scorecard', 'Repository security check evidence'],
  ['opencitations-index', 'citation-count', 'OpenCitations incoming citation count'],
  ['vam-collections', 'collection-index', 'Exact-request-bound V&A objects collection search'],
  ['world-bank-gdp', 'indicator-series', 'Request-bound Singapore GDP series'],
  ['world-bank-population', 'indicator-series', 'Request-bound Singapore population series'],
  ['frankfurter-sgd-myr-history', 'fx-history', 'Request-bound SGD/MYR exchange-rate history'],
  ['open-library-search', 'book-search', 'Request-bound Open Library book search'],
  ['open-food-facts', 'food-product', 'Request-bound Open Food Facts product nutrition profile'],
  ['free-dictionary', 'dictionary-entry', 'Word definition study card'],
  ['pokeapi', 'pokemon-profile', 'Request-bound Pokémon identity, types, abilities, and base stats'],
  ['art-institute-search', 'public-domain-art-search', 'Request-bound public-domain artwork search'],
  ['tvmaze-search', 'tv-show-search', 'Exact-request-bound TVmaze show search'],
  ['gbif-species-search', 'taxonomy-directory', 'Species taxonomy explorer'],
  ['clinical-trials-search', 'research-library', 'Clinical study registry'],
  ['openfda-drug-labels', 'drug-label', 'FDA regulated drug label summary'],
  ['coinpaprika-ticker', 'market-chart', 'Cryptocurrency market terminal'],
  ['malaysia-fuel-price', 'fuel-dashboard', 'Malaysia weekly fuel-price board'],
  ['open-meteo-marine', 'marine-forecast', 'Coastal and ocean forecast cockpit'],
  ['nobel-prizes', 'awards-timeline', 'Nobel laureate and discovery timeline'],
  ['chess-player-stats', 'chess-ratings', 'Chess performance rating board'],
  ['crossref-works', 'scholarly-search', 'DOI and scholarly works explorer'],
  ['noaa-space-weather', 'space-weather-scales', 'NOAA space-weather R / S / G scale evidence'],
  ['osv-vulnerability', 'vulnerability-record', 'Request-bound OSV vulnerability record'],
  ['federal-register-documents', 'federal-rulemaking', 'Federal rulemaking publication timeline'],
  ['wikipedia-search', 'encyclopedia-search', 'Wikipedia article search'],
  ['open-meteo-flood', 'weather-dashboard', 'Global river-discharge forecast panel'],
  ['open-meteo-history', 'historical-weather', 'Request-bound historical weather comparison'],
  ['kraken-public-ticker', 'market-chart', 'Kraken public market terminal'],
  ['gitlab-public-projects', 'project-search', 'GitLab public project search'],
  ['uk-police-street-crime', 'street-crime', 'UK anonymised street-crime evidence'],
  ['open-brewery-directory', 'brewery-directory', 'Request-bound brewery identity and location directory'],
  ['rick-morty-characters', 'character-search', 'Exact-request-bound Rick and Morty character search'],
  ['wikimedia-pageviews', 'market-chart', 'Wikipedia readership trend chart'],
  ['openf1-historical', 'motorsport-results', 'Formula 1 qualifying classification'],
  ['jolpica-f1', 'f1-season-catalog', 'Jolpica Formula 1 season catalogue'],
  ['open-meteo-elevation', 'terrain-elevation', 'Terrain elevation lookup'],
  ['zippopotam-postcode', 'postcode-geolocation', 'Request-bound postcode geolocation'],
  ['irail-liveboard', 'transit-board', 'Belgian railway live departure board'],
  ['swiss-transit-connections', 'swiss-transit-connections', 'Request-bound Swiss transit connection evidence'],
  ['spaceflight-news', 'spaceflight-news', 'Request-bound spaceflight publisher articles'],
  ['launch-library-upcoming', 'launch-schedule', 'Upcoming mission launch countdown'],
  ['wiktionary-entry', 'dictionary-entry', 'Wiktionary structured language entry'],
  ['animechan-random-quote', 'quote-card', 'Anime quote character stage'],
  ['anilist-graphql', 'anime-media-search', 'AniList media discovery'],
  ['openverse-search', 'licensed-media-search', 'Openverse licensed-media search'],
  ['apple-itunes-search', 'itunes-media-search', 'Request-bound Apple media catalog'],
  ['packagist-search', 'composer-package-search', 'Packagist package search'],
  ['jokeapi-safe', 'joke-stage', 'Exact-request safe JokeAPI stage'],
  ['hn-search-algolia', 'hn-search', 'Hacker News story and comment search'],
  ['open-meteo-seasonal', 'seasonal-outlook', 'ECMWF seasonal anomaly outlook'],
  ['nhtsa-safety-ratings', 'vehicle-safety-rating', 'NHTSA vehicle crash-test safety rating'],
  ['singstat-cpi-monthly', 'singapore-cpi', 'Singapore monthly CPI index'],
  ['openalex-works-search', 'scholarly-graph', 'OpenAlex research graph search'],
  ['oecd-cli', 'leading-indicator', 'OECD composite leading indicator'],
  ['dummyjson-recipes', 'recipe-search', 'Request-bound synthetic recipe search'],
  ['bank-of-canada-valet', 'central-bank-series', 'Request-bound Bank of Canada time series'],
  ['nasa-power-climate', 'climate-series', 'NASA POWER climate series'],
  ['brasilapi-postcode', 'location-map', 'Brazilian postcode location profile'],
  ['poetrydb-poems', 'poetry-reading-room', 'Request-bound PoetryDB reading room'],
  ['coingecko-keyless-market', 'market-chart', 'Keyless cryptocurrency market snapshot'],
  ['swapi-people', 'character-dossier', 'Star Wars character dossier'],
  ['google-dns-doh', 'dns-records', 'DNS resolution and answer records'],
  ['color-api', 'color-swatch', 'Color swatch and specifications'],
  ['nasa-image-search', 'nasa-media-library', 'NASA request-bound media library'],
  ['lichess-top-players', 'chess-ratings', 'Lichess leaderboard board'],
  ['pubmed-search', 'research-library', 'PubMed identifier search results'],
  ['rxnorm-drug-search', 'drug-terminology', 'RxNorm drug terminology registry'],
  ['inaturalist-observations', 'species-observations', 'Request-bound species observations with photo rights and geoprivacy'],
  ['first-epss', 'security-center', 'CVE exploitation probability score'],
  ['endoflife-date', 'release-lifecycle', 'Software release support explorer'],
  ['deps-dev', 'package-insights', 'deps.dev package versions and default-release profile'],
  ['ecb-fx-rates', 'exchange-rates', 'Fiat and crypto rate conversion'],
  ['un-sdg-goals', 'sdg-goals', 'United Nations Sustainable Development Goal catalogue'],
  ['datacite-search', 'scholarly-search', 'Request-bound DataCite DOI metadata search'],
  ['ror-search', 'organization-directory', 'Request-bound ROR organization search'],
  ['celestrak-satellites', 'satellite-orbits', 'CelesTrak GP orbital-element board'],
  ['cleveland-museum-search', 'open-access-art-search', 'Request-bound CC0 artwork search'],
  ['scryfall-card-search', 'trading-card-search', 'Request-bound Magic: The Gathering card search'],
  ['dnd5e-spell-lookup', 'dictionary-entry', 'D&D 5e spell reference card'],
  ['qr-code-generator', 'generated-qr-code', 'Generated QR code preview'],
  ['where-the-iss-at', 'iss-position', 'Request-bound ISS orbital position and motion snapshot'],
  ['eurostat-population', 'population-statistic', 'Eurostat population-on-1-January statistic'],
  ['bls-timeseries', 'labor-timeseries', 'Request-bound U.S. labor statistics time series'],
  ['fema-disasters', 'disaster-declared-areas', 'FEMA declared geographic areas'],
  ['noaa-tides', 'coastal-water-level', 'NOAA coastal water-level observation'],
  ['rdap-domain-lookup', 'domain-registration', 'RDAP domain registration record'],
  ['languagetool-grammar-check', 'grammar-review', 'Writing issues and suggested replacements'],
  ['doaj-search', 'scholarly-search', 'Request-bound open-access article search'],
  ['pubchem-compound', 'compound-properties', 'PubChem compound property profile'],
  ['chembl-molecule', 'molecule-profile', 'ChEMBL molecule research profile'],
  ['uniprot-protein', 'protein-annotation', 'UniProt protein annotation profile'],
  ['rcsb-pdb-entry', 'molecular-structure', 'Protein Data Bank structure record'],
  ['ensembl-gene-lookup', 'gene-locus', 'Ensembl stable gene locus profile'],
  ['obis-marine-occurrences', 'marine-occurrences', 'OBIS marine occurrence evidence'],
  ['worms-species-lookup', 'marine-taxonomy', 'WoRMS accepted-name taxonomy resolution'],
  ['paleobiodb-taxa', 'fossil-taxon', 'Paleobiology fossil taxon profile'],
  ['usgs-water-legacy', 'water-gauge', 'USGS continuous water observation'],
  ['rubygems-lookup', 'package-release', 'Ruby gem release profile'],
  ['nuget-package-lookup', 'package-registration', '.NET package registration profile'],
  ['internet-archive-search', 'archive-search', 'Request-bound Internet Archive search with rights evidence'],
  ['ipwhois-lookup', 'ip-geolocation', 'Approximate IP location and network identity'],
  ['newton-math-solver', 'symbolic-math', 'Symbolic math operation result'],
  ['datamuse-rhymes', 'lexical-matches', 'Pronunciation-aware lexical matches'],
  ['open5e-monster-search', 'monster-statblock', 'Open5e V2 source-aware creature stat cards'],
  ['dicebear-avatar', 'generated-avatar', 'Generated avatar preview'],
  ['catfacts', 'cat-fact', 'Random cat fact'],
  ['malaysia-core-cpi', 'core-cpi-index', 'Malaysia overall core CPI index trend'],
  ['malaysia-household-income', 'household-income', 'Malaysia HIES mean and median household-income trend'],
  ['malaysia-population', 'population-total', 'Malaysia national total population trend'],
  ['openfda-food-recalls', 'food-recalls', 'FDA food recall enforcement reports'],
  ['iconify-search', 'icon-catalog', 'Icon identifier and licence catalogue'],
  ['homebrew-formula-json', 'homebrew-package', 'Homebrew formula and cask package metadata'],
  ['npm-download-counts', 'download-summary', 'Package download reporting window'],
  ['geoboundaries-admin-boundaries', 'boundary-layer', 'Administrative boundary layer provenance and downloads'],
  ['osrm-route', 'route-summary', 'OSRM route summary and turn steps'],
  ['opendota-pro-matches', 'pro-match-results', 'OpenDota professional match results'],
  ['openligadb-matches', 'football-matchday', 'OpenLigaDB matchday schedule and typed results'],
  ['uk-parliament-members', 'parliament-members', 'UK Parliament current members directory'],
  ['gleif-lei', 'legal-entity', 'Global LEI legal-entity profile'],
  ['fdic-bankfind', 'bank-institution', 'FDIC institution identity and financial snapshot'],
  ['uk-food-hygiene', 'food-hygiene-ratings', 'UK food hygiene rating and intervention scores'],
  ['uk-flood-monitoring', 'flood-stations', 'Environment Agency river monitoring stations'],
  ['unhcr-refugees', 'refugee-population', 'UNHCR year-end displacement population profile'],
  ['hdx-humanitarian-datasets', 'humanitarian-events', 'IFRC GO source-aware emergency event brief'],
  ['open-meteo-climate', 'market-chart', 'Climate model projection comparison'],
  ['models-dev', 'ai-model-catalog', 'Hugging Face model catalogue and access metadata'],
  ['vatcomply', 'exchange-rates', 'VATComply daily exchange-rate conversion'],
  ['mempool-space-btc', 'transaction-fees', 'Bitcoin recommended transaction fee rates'],
  ['metacpan', 'cpan-module-search', 'Request-bound latest CPAN module lookup'],
  ['hexpm', 'hex-package', 'Hex package release and adoption profile'],
  ['pub-dev', 'dart-package', 'Request-bound Dart and Flutter package lookup'],
  ['go-module-proxy', 'go-module-versions', 'Go module version catalog'],
  ['flathub-appstream', 'appstream-profile', 'Request-bound Flathub AppStream application profile'],
  ['mlb-stats-api', 'baseball-schedule', 'MLB dated schedule and game-state summary'],
  ['github-global-advisories', 'global-security-advisories', 'GitHub request-bound global advisory watchlist'],
  ['dblp-search', 'dblp-publications', 'DBLP request-bound publication search'],
  ['citybikes-network', 'bike-share-network', 'Request-bound live bike-sharing station availability'],
  ['wikimedia-commons-search', 'commons-media-search', 'Wikimedia Commons licensed media wall'],
  ['jsdelivr-package', 'cdn-package', 'jsDelivr package release SSOT'],
  ['canada-open-data-search', 'open-data-catalog', 'Canada open-government catalogue search'],
  ['gbif-occurrence-search', 'location-map', 'GBIF biodiversity occurrence map'],
  ['open-meteo-ensemble', 'ensemble-forecast', 'Request-bound ensemble forecast uncertainty'],
  ['world-bank-indicator-explorer', 'indicator-series', 'Request-bound World Bank indicator series'],
  ['exchange-rate-current', 'exchange-rates', 'Daily FX rates and conversion'],
  ['circl-vulnerability', 'cve-record', 'CIRCL CVE 5 investigation record'],
]

export const previewProfileIds = profileEntries.map(([id]) => id)

export const previewProfiles: Record<string, PreviewProfile> = Object.fromEntries(profileEntries.map(([id, layout, label]) =>
  [id, { layout, label }],
))

export const getPreviewProfile = (id: string): PreviewProfile | undefined => previewProfiles[id]

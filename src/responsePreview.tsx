import './previews/domainCards.css'
import type { CSSProperties, ReactElement, ReactNode } from 'react'
import { apiCatalog, type ApiDemo } from './apiCatalog'
import { getPreviewProfile, type PreviewLayout } from './previewProfiles'
import { uiText, type UiLocale, type UiMessageKey } from './i18n'
import { deferredPreview } from './previews/previewBundles'
import type { ExecutedRequestContext, ResponseMediaContext } from './useApiRequestRuntime'

export type { PreviewLayout } from './previewProfiles'
export { buildDemoPreview } from './previews/buildDemoPreview'

const familyPreview = (name: string) => deferredPreview('family', name)
const CrossrefWorksPreview = familyPreview('CrossrefWorksPreview')
const FreeDictionaryPreview = familyPreview('FreeDictionaryPreview')
const FederalRegisterPreview = familyPreview('FederalRegisterPreview')
const FloodForecastPreview = familyPreview('FloodForecastPreview')
const GbifOccurrencePreview = familyPreview('GbifOccurrencePreview')
const DataGovTaxiAvailabilityPreview = familyPreview('DataGovTaxiAvailabilityPreview')
const DataGovTrafficImagesPreview = deferredPreview('traffic-camera', 'DataGovTrafficImagesPreview')
const UsgsEarthquakePreview = familyPreview('UsgsEarthquakePreview')
const DogGalleryPreview = familyPreview('DogGalleryPreview')
const NagerHolidaysPreview = familyPreview('NagerHolidaysPreview')
const UkBankHolidaysPreview = familyPreview('UkBankHolidaysPreview')
const HebcalCalendarPreview = familyPreview('HebcalCalendarPreview')
const AniListMediaPreview = familyPreview('AniListMediaPreview')
const NasaEonetEventsPreview = familyPreview('NasaEonetEventsPreview')
const OpenLibrarySearchPreview = familyPreview('OpenLibrarySearchPreview')
const OpenFoodFactsPreview = familyPreview('OpenFoodFactsPreview')
const UkPoliceStreetCrimePreview = familyPreview('UkPoliceStreetCrimePreview')
const CityBikesNetworkPreview = familyPreview('CityBikesNetworkPreview')
const WikimediaCommonsSearchPreview = familyPreview('WikimediaCommonsSearchPreview')
const WikipediaSearchPreview = familyPreview('WikipediaSearchPreview')
const OpenverseSearchPreview = familyPreview('OpenverseSearchPreview')
const NasaImageSearchPreview = familyPreview('NasaImageSearchPreview')
const OpenMeteoGeocodingPreview = familyPreview('OpenMeteoGeocodingPreview')
const PostcodesIoPreview = familyPreview('PostcodesIoPreview')
const ZippopotamPostcodePreview = familyPreview('ZippopotamPostcodePreview')
const OpenBreweryDirectoryPreview = familyPreview('OpenBreweryDirectoryPreview')
const ClevelandMuseumSearchPreview = familyPreview('ClevelandMuseumSearchPreview')
const VamCollectionsPreview = familyPreview('VamCollectionsPreview')
const ArtInstituteSearchPreview = familyPreview('ArtInstituteSearchPreview')
const INaturalistObservationsPreview = familyPreview('INaturalistObservationsPreview')
const InternetArchiveSearchPreview = familyPreview('InternetArchiveSearchPreview')
const ScryfallCardSearchPreview = familyPreview('ScryfallCardSearchPreview')
const AppleItunesSearchPreview = familyPreview('AppleItunesSearchPreview')
const SpaceflightNewsPreview = familyPreview('SpaceflightNewsPreview')
const PokeApiPreview = familyPreview('PokeApiPreview')
const TvmazeSearchPreview = familyPreview('TvmazeSearchPreview')
const RickMortyCharactersPreview = familyPreview('RickMortyCharactersPreview')
const FlathubAppstreamPreview = familyPreview('FlathubAppstreamPreview')
const RandomUserPeoplePreview = familyPreview('RandomUserPeoplePreview')
const DummyJsonRecipesPreview = familyPreview('DummyJsonRecipesPreview')
const PubMedSearchPreview = familyPreview('PubMedSearchPreview')
const ClinicalTrialsSearchPreview = familyPreview('ClinicalTrialsSearchPreview')
const ResultListPreview = familyPreview('ResultListPreview')
const SolarCyclePreview = familyPreview('SolarCyclePreview')
const MBTARoutesPreview = familyPreview('MBTARoutesPreview')
const SwissTransitConnectionsPreview = familyPreview('SwissTransitConnectionsPreview')
const IRailLiveboardPreview = familyPreview('IRailLiveboardPreview')
const OpenTriviaPreview = familyPreview('OpenTriviaPreview')
const JokeApiPreview = familyPreview('JokeApiPreview')

const specializedPreview = (name: string) => deferredPreview('specialized', name)
const developerSemanticPreview = (name: string) => deferredPreview('developer-semantic', name)
const packageSemanticPreview = (name: string) => deferredPreview('package-semantic', name)
const AnimeQuotePreview = specializedPreview('AnimeQuotePreview')
const BrazilPostcodePreview = specializedPreview('BrazilPostcodePreview')
const CarparkAvailabilityPreview = specializedPreview('CarparkAvailabilityPreview')
const LichessPlayerRatingsPreview = specializedPreview('LichessPlayerRatingsPreview')
const CountryPreview = specializedPreview('CountryPreview')
const DatamuseWordPreview = specializedPreview('DatamuseWordPreview')
const DevToArticlesPreview = developerSemanticPreview('DevToArticlesPreview')
const JsonPlaceholderPostPreview = developerSemanticPreview('JsonPlaceholderPostPreview')
const DepsDevPackagePreview = packageSemanticPreview('DepsDevPackagePreview')
const GitLabProjectSearchPreview = developerSemanticPreview('GitLabProjectSearchPreview')
const GitHubRepositoriesPreview = developerSemanticPreview('GitHubRepositoriesPreview')
const HackerNewsItemPreview = developerSemanticPreview('HackerNewsItemPreview')
const HnAlgoliaSearchPreview = developerSemanticPreview('HnAlgoliaSearchPreview')
const IpifyPublicIpPreview = specializedPreview('IpifyPublicIpPreview')
const CatFactPreview = specializedPreview('CatFactPreview')
const DndSpellPreview = specializedPreview('DndSpellPreview')
const MalaysiaFuelPricePreview = specializedPreview('MalaysiaFuelPricePreview')
const GbifTaxonomyPreview = specializedPreview('GbifTaxonomyPreview')
const GeneratedImagePreview = specializedPreview('GeneratedImagePreview')
const GoModuleVersionsPreview = specializedPreview('GoModuleVersionsPreview')
const HuggingFaceModelsPreview = developerSemanticPreview('HuggingFaceModelsPreview')
const IconifySearchPreview = specializedPreview('IconifySearchPreview')
const HomebrewPackagePreview = packageSemanticPreview('HomebrewPackagePreview')
const HexPmPackagePreview = packageSemanticPreview('HexPmPackagePreview')
const JsDelivrPackagePreview = packageSemanticPreview('JsDelivrPackagePreview')
const NuGetPackagePreview = packageSemanticPreview('NuGetPackagePreview')
const NpmSearchPreview = packageSemanticPreview('NpmSearchPreview')
const StackExchangeQuestionsPreview = developerSemanticPreview('StackExchangeQuestionsPreview')
const PackagistSearchPreview = packageSemanticPreview('PackagistSearchPreview')
const PyPiPackagePreview = packageSemanticPreview('PyPiPackagePreview')
const PubDevPackagePreview = packageSemanticPreview('PubDevPackagePreview')
const RubyGemsPackagePreview = packageSemanticPreview('RubyGemsPackagePreview')
const LaunchSchedulePreview = specializedPreview('LaunchSchedulePreview')
const LichessLeaderboardPreview = specializedPreview('LichessLeaderboardPreview')
const MetaCpanModulePreview = packageSemanticPreview('MetaCpanModulePreview')
const MarineForecastPreview = specializedPreview('MarineForecastPreview')
const MetMuseumSearchPreview = specializedPreview('MetMuseumSearchPreview')
const MetMuseumObjectPreview = specializedPreview('MetMuseumObjectPreview')
const NhtsaMakesPreview = specializedPreview('NhtsaMakesPreview')
const OpenMeteoSeasonalPreview = specializedPreview('OpenMeteoSeasonalPreview')
const NhtsaSafetyRatingsPreview = specializedPreview('NhtsaSafetyRatingsPreview')
const SingStatCpiPreview = specializedPreview('SingStatCpiPreview')
const OpenAlexWorksPreview = specializedPreview('OpenAlexWorksPreview')
const OecdCliPreview = specializedPreview('OecdCliPreview')
const Open5eMonsterPreview = specializedPreview('Open5eMonsterPreview')
const NobelPrizePreview = specializedPreview('NobelPrizePreview')
const NewtonMathPreview = specializedPreview('NewtonMathPreview')
const OpenF1SessionsPreview = specializedPreview('OpenF1SessionsPreview')
const PoetryDbPreview = specializedPreview('PoetryDbPreview')
const StarWarsPeoplePreview = specializedPreview('StarWarsPeoplePreview')
const WiktionaryEntryPreview = specializedPreview('WiktionaryEntryPreview')

const weatherPreview = (name: string) => deferredPreview('weather', name)
const AirQualityForecastPreview = weatherPreview('AirQualityForecastPreview')
const AreaForecastPreview = weatherPreview('AreaForecastPreview')
const CurrentConditionsPreview = weatherPreview('CurrentConditionsPreview')
const FourDayForecastPreview = weatherPreview('FourDayForecastPreview')
const RegionalAirQualityPreview = weatherPreview('RegionalAirQualityPreview')
const StationReadingsPreview = weatherPreview('StationReadingsPreview')
const TwentyFourHourForecastPreview = weatherPreview('TwentyFourHourForecastPreview')
const UvIndexPreview = weatherPreview('UvIndexPreview')

const operationalPreview = (name: string) => deferredPreview('operational', name)
const FdicBankPreview = operationalPreview('FdicBankPreview')
const GleifLeiPreview = operationalPreview('GleifLeiPreview')
const MempoolFeePreview = operationalPreview('MempoolFeePreview')
const OsrmRoutePreview = operationalPreview('OsrmRoutePreview')
const RdapDomainPreview = operationalPreview('RdapDomainPreview')

const marketPreview = (name: string) => deferredPreview('market', name)
const OpenMeteoClimatePreview = marketPreview('OpenMeteoClimatePreview')
const OpenMeteoEnsemblePreview = marketPreview('OpenMeteoEnsemblePreview')
const OpenMeteoHistoryPreview = marketPreview('OpenMeteoHistoryPreview')
const WorldBankIndicatorPreview = marketPreview('WorldBankIndicatorPreview')
const NasaPowerClimatePreview = marketPreview('NasaPowerClimatePreview')
const WikimediaPageviewsPreview = marketPreview('WikimediaPageviewsPreview')
const BankOfCanadaValetPreview = marketPreview('BankOfCanadaValetPreview')
const CoinGeckoKeylessMarketPreview = marketPreview('CoinGeckoKeylessMarketPreview')
const CoinPaprikaTickerPreview = marketPreview('CoinPaprikaTickerPreview')
const KrakenPublicTickerPreview = marketPreview('KrakenPublicTickerPreview')
const BlsTimeseriesPreview = marketPreview('BlsTimeseriesPreview')
const FrankfurterSgdMyrHistoryPreview = marketPreview('FrankfurterSgdMyrHistoryPreview')
const DataUsaPopulationPreview = marketPreview('DataUsaPopulationPreview')

const semanticPreview = (name: string) => deferredPreview('semantic', name)
const DblpSearchPreview = semanticPreview('DblpSearchPreview')
const NoaaSpaceWeatherPreview = semanticPreview('NoaaSpaceWeatherPreview')
const scienceSemanticPreview = (name: string) => deferredPreview('science-semantic', name)
const DrugLabelPreview = scienceSemanticPreview('DrugLabelPreview')
const FoodRecallPreview = scienceSemanticPreview('FoodRecallPreview')
const PrayerTimesPreview = semanticPreview('PrayerTimesPreview')
const RxNormDrugPreview = scienceSemanticPreview('RxNormDrugPreview')
const TideWaterLevelPreview = semanticPreview('TideWaterLevelPreview')
const ProteinAnnotationPreview = scienceSemanticPreview('ProteinAnnotationPreview')
const PdbStructurePreview = scienceSemanticPreview('PdbStructurePreview')
const ChemblMoleculePreview = scienceSemanticPreview('ChemblMoleculePreview')
const PubChemCompoundPreview = scienceSemanticPreview('PubChemCompoundPreview')
const CarbonIntensityPreview = semanticPreview('CarbonIntensityPreview')
const EnsemblGenePreview = scienceSemanticPreview('EnsemblGenePreview')
const ElevationPreview = semanticPreview('ElevationPreview')
const FloodStationPreview = semanticPreview('FloodStationPreview')
const UsgsWaterPreview = semanticPreview('UsgsWaterPreview')
const EurostatPopulationPreview = semanticPreview('EurostatPopulationPreview')
const RefugeePopulationPreview = semanticPreview('RefugeePopulationPreview')
const FemaDisasterPreview = semanticPreview('FemaDisasterPreview')
const MalaysiaCoreCpiPreview = semanticPreview('MalaysiaCoreCpiPreview')
const FoodHygienePreview = semanticPreview('FoodHygienePreview')
const MalaysiaHouseholdIncomePreview = semanticPreview('MalaysiaHouseholdIncomePreview')
const MalaysiaPopulationPreview = semanticPreview('MalaysiaPopulationPreview')
const HumanitarianEventPreview = semanticPreview('HumanitarianEventPreview')
const UnSdgGoalsPreview = semanticPreview('UnSdgGoalsPreview')
const CelestrakSatellitesPreview = semanticPreview('CelestrakSatellitesPreview')
const ObisOccurrencePreview = semanticPreview('ObisOccurrencePreview')
const WormsSpeciesPreview = semanticPreview('WormsSpeciesPreview')
const PaleobiodbTaxonPreview = semanticPreview('PaleobiodbTaxonPreview')
const IpWhoisPreview = semanticPreview('IpWhoisPreview')
const GeoBoundariesPreview = semanticPreview('GeoBoundariesPreview')
const WikidataEntityPreview = semanticPreview('WikidataEntityPreview')
const OpenCitationsPreview = semanticPreview('OpenCitationsPreview')
const UkParliamentMembersPreview = semanticPreview('UkParliamentMembersPreview')
const CanadaOpenDataPreview = semanticPreview('CanadaOpenDataPreview')
const FirstEpssPreview = semanticPreview('FirstEpssPreview')
const CirclVulnerabilityPreview = semanticPreview('CirclVulnerabilityPreview')
const NvdCveDetailPreview = semanticPreview('NvdCveDetailPreview')
const OsvVulnerabilityPreview = semanticPreview('OsvVulnerabilityPreview')
const DataCiteSearchPreview = semanticPreview('DataCiteSearchPreview')
const DoajSearchPreview = semanticPreview('DoajSearchPreview')
const RorSearchPreview = semanticPreview('RorSearchPreview')
const IssPositionPreview = semanticPreview('IssPositionPreview')
const GitHubGlobalAdvisoriesPreview = developerSemanticPreview('GitHubGlobalAdvisoriesPreview')
const NvdCpeSearchPreview = developerSemanticPreview('NvdCpeSearchPreview')
const NvdCveSearchPreview = developerSemanticPreview('NvdCveSearchPreview')
const NvdRecentCvesPreview = developerSemanticPreview('NvdRecentCvesPreview')
const sportsSemanticPreview = (name: string) => deferredPreview('sports-semantic', name)
const JolpicaF1Preview = sportsSemanticPreview('JolpicaF1Preview')
const OpenDotaMatchesPreview = sportsSemanticPreview('OpenDotaMatchesPreview')
const OpenLigaDbMatchesPreview = sportsSemanticPreview('OpenLigaDbMatchesPreview')
const MlbSchedulePreview = sportsSemanticPreview('MlbSchedulePreview')

const FederalAgencyOverviewPreview = semanticPreview('FederalAgencyOverviewPreview')
const FederalAwardsPreview = semanticPreview('FederalAwardsPreview')

const diagnosticPreview = (name: string) => deferredPreview('diagnostic', name)
const ScorecardPreview = diagnosticPreview('ScorecardPreview')
const GrammarPreview = diagnosticPreview('GrammarPreview')
const RecallsPreview = diagnosticPreview('RecallsPreview')
const ColorPreview = diagnosticPreview('ColorPreview')
const DnsPreview = diagnosticPreview('DnsPreview')
const DownloadsPreview = diagnosticPreview('DownloadsPreview')
const LifecyclePreview = diagnosticPreview('LifecyclePreview')
const ExchangeRateApiPreview = diagnosticPreview('ExchangeRateApiPreview')
const CoinbaseRatesPreview = diagnosticPreview('CoinbaseRatesPreview')
const VatcomplyRatesPreview = diagnosticPreview('VatcomplyRatesPreview')

export type WeatherPreviewVariant = 'current' | 'four-day' | 'twenty-four-hour' | 'area-forecast' | 'station-readings' | 'regional-air-quality' | 'air-quality-forecast' | 'uv-index'

const stationWeatherIds = ['data-gov-air-temperature', 'data-gov-rainfall', 'data-gov-relative-humidity', 'data-gov-wind-direction', 'data-gov-wind-speed']

export function selectWeatherPreviewVariant(api: Pick<ApiDemo, 'id'>): WeatherPreviewVariant {
  if (api.id === 'open-meteo-air-quality') return 'air-quality-forecast'
  if (api.id === 'data-gov-4day-forecast') return 'four-day'
  if (api.id === 'data-gov-24hr-forecast') return 'twenty-four-hour'
  if (api.id === 'data-gov-forecast-2hr') return 'area-forecast'
  if (stationWeatherIds.includes(api.id)) return 'station-readings'
  if (['data-gov-pm25', 'data-gov-psi'].includes(api.id)) return 'regional-air-quality'
  if (api.id === 'data-gov-uv-index') return 'uv-index'
  return 'current'
}
export type SsotRuntimeMeta = {
  httpStatus: number
  elapsed: number
  size: number
}
const formatResponseBytes = (bytes: number) => (bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`)

export function selectPreviewLayout(api: Pick<ApiDemo, 'id' | 'category'>): PreviewLayout {
  return getPreviewProfile(api.id)?.layout ?? 'result-list'
}

type ApiPreviewProps = {
  api: ApiDemo
  data: unknown
  requestUrl?: string
  executedRequest?: ExecutedRequestContext
  responseMedia?: ResponseMediaContext
}
export type ApiPreviewComponent = (props: ApiPreviewProps) => ReactElement

const componentName = (id: string) =>
  `${id
    .split('-')
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join('')}Preview`

const defineApiPreview = (id: string, render: (props: ApiPreviewProps) => ReactElement): ApiPreviewComponent => {
  const Component = ({ api, data, requestUrl, executedRequest, responseMedia }: ApiPreviewProps) => (
    <div className={`api-specific-preview api-specific-${id}`} data-api-preview-component={id} data-visual-signature={componentName(id)} data-card-design="api-owned-v2" aria-label={`${api.name} visual component`}>
      {render({ api, data, requestUrl, executedRequest, responseMedia })}
    </div>
  )
  Object.defineProperty(Component, 'name', { value: componentName(id) })
  return Component
}

// Every catalog item owns a distinct React component function. Components may
// compose the low-level chart, metric, gallery, map, and timeline primitives
// above, but no catalog item is dispatched through a family-level component.
export const apiPreviewComponents: Partial<Record<string, ApiPreviewComponent>> = {
  countries: defineApiPreview('countries', ({ api, data, requestUrl, executedRequest }) => <CountryPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  weather: defineApiPreview('weather', ({ api, data, executedRequest }) => <CurrentConditionsPreview api={api} data={data} executedRequest={executedRequest}/>),
  people: defineApiPreview('people', ({ api, data, requestUrl, executedRequest }) => <RandomUserPeoplePreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  dogs: defineApiPreview('dogs', ({ data, executedRequest }) => <DogGalleryPreview data={data} executedRequest={executedRequest}/>),
  posts: defineApiPreview('posts', ({ data, requestUrl, executedRequest }) => <JsonPlaceholderPostPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  holidays: defineApiPreview('holidays', ({ data, executedRequest }) => <NagerHolidaysPreview data={data} executedRequest={executedRequest}/>),
  'geocoding-search': defineApiPreview('geocoding-search', ({ api, data, requestUrl, executedRequest }) => <OpenMeteoGeocodingPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'aladhan-prayer-times': defineApiPreview('aladhan-prayer-times', ({ data, requestUrl, executedRequest }) => <PrayerTimesPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'open-meteo-air-quality': defineApiPreview('open-meteo-air-quality', ({ data, executedRequest }) => <AirQualityForecastPreview data={data} executedRequest={executedRequest}/>),
  'sunrise-sunset': defineApiPreview('sunrise-sunset', ({ data, requestUrl, executedRequest }) => <SolarCyclePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'nasa-eonet-events': defineApiPreview('nasa-eonet-events', ({ api, data, requestUrl, executedRequest }) => <NasaEonetEventsPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'mbta-transit-routes': defineApiPreview('mbta-transit-routes', ({ api, data, requestUrl, executedRequest }) => <MBTARoutesPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'open-trivia': defineApiPreview('open-trivia', ({ api, data, requestUrl, executedRequest }) => <OpenTriviaPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'carbon-intensity-gb': defineApiPreview('carbon-intensity-gb', ({ data }) => <CarbonIntensityPreview data={data}/>),
  'open-meteo-elevation': defineApiPreview('open-meteo-elevation', ({ data, requestUrl, executedRequest }) => <ElevationPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'data-gov-24hr-forecast': defineApiPreview('data-gov-24hr-forecast', ({ data }) => <TwentyFourHourForecastPreview data={data}/>),
  'data-gov-4day-forecast': defineApiPreview('data-gov-4day-forecast', ({ data }) => <FourDayForecastPreview data={data}/>),
  'data-gov-air-temperature': defineApiPreview('data-gov-air-temperature', ({ api, data }) => <StationReadingsPreview api={api} data={data}/>),
  'data-gov-carpark': defineApiPreview('data-gov-carpark', ({ data }) => <CarparkAvailabilityPreview data={data}/>),
  'data-gov-forecast-2hr': defineApiPreview('data-gov-forecast-2hr', ({ data }) => <AreaForecastPreview data={data}/>),
  'data-gov-pm25': defineApiPreview('data-gov-pm25', ({ api, data }) => <RegionalAirQualityPreview api={api} data={data}/>),
  'data-gov-psi': defineApiPreview('data-gov-psi', ({ api, data }) => <RegionalAirQualityPreview api={api} data={data}/>),
  'data-gov-rainfall': defineApiPreview('data-gov-rainfall', ({ api, data }) => <StationReadingsPreview api={api} data={data}/>),
  'data-gov-relative-humidity': defineApiPreview('data-gov-relative-humidity', ({ api, data }) => <StationReadingsPreview api={api} data={data}/>),
  'data-gov-taxi': defineApiPreview('data-gov-taxi', ({ data, executedRequest }) => <DataGovTaxiAvailabilityPreview data={data} executedRequest={executedRequest}/>),
  'data-gov-traffic-images': defineApiPreview('data-gov-traffic-images', ({ data, executedRequest }) => <DataGovTrafficImagesPreview data={data} executedRequest={executedRequest}/>),
  'data-gov-uv-index': defineApiPreview('data-gov-uv-index', ({ data }) => <UvIndexPreview data={data}/>),
  'data-gov-wind-direction': defineApiPreview('data-gov-wind-direction', ({ api, data }) => <StationReadingsPreview api={api} data={data}/>),
  'data-gov-wind-speed': defineApiPreview('data-gov-wind-speed', ({ api, data }) => <StationReadingsPreview api={api} data={data}/>),
  'data-usa': defineApiPreview('data-usa', ({ data, executedRequest }) => <DataUsaPopulationPreview data={data} executedRequest={executedRequest}/>),
  devto: defineApiPreview('devto', ({ data, requestUrl, executedRequest }) => <DevToArticlesPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'fiscal-data-treasury': defineApiPreview('fiscal-data-treasury', ({ data, requestUrl, executedRequest }) => <FederalAgencyOverviewPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  github: defineApiPreview('github', ({ data, requestUrl, executedRequest }) => <GitHubRepositoriesPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'hacker-news': defineApiPreview('hacker-news', ({ data, requestUrl, executedRequest }) => <HackerNewsItemPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'ipify-public-ip': defineApiPreview('ipify-public-ip', ({ data }) => <IpifyPublicIpPreview data={data}/>),
  'met-museum-object-detail': defineApiPreview('met-museum-object-detail', ({ data, executedRequest }) => <MetMuseumObjectPreview data={data} executedRequest={executedRequest}/>),
  'met-museum-search': defineApiPreview('met-museum-search', ({ data, requestUrl, executedRequest }) => <MetMuseumSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'nhtsa-vpic': defineApiPreview('nhtsa-vpic', ({ data }) => <NhtsaMakesPreview data={data}/>),
  'nhtsa-vehicle-recalls': defineApiPreview('nhtsa-vehicle-recalls', ({ data, executedRequest }) => <RecallsPreview data={data} executedRequest={executedRequest}/>),
  'npm-search': defineApiPreview('npm-search', ({ data, executedRequest }) => <NpmSearchPreview data={data} executedRequest={executedRequest}/>),
  'nvd-cpe-search': defineApiPreview('nvd-cpe-search', ({ data, executedRequest }) => <NvdCpeSearchPreview data={data} executedRequest={executedRequest}/>),
  'nvd-cve-detail': defineApiPreview('nvd-cve-detail', ({ data, executedRequest }) => <NvdCveDetailPreview data={data} executedRequest={executedRequest}/>),
  'nvd-cves': defineApiPreview('nvd-cves', ({ data, executedRequest }) => <NvdCveSearchPreview data={data} executedRequest={executedRequest}/>),
  'nvd-recent-cves': defineApiPreview('nvd-recent-cves', ({ data, executedRequest }) => <NvdRecentCvesPreview data={data} executedRequest={executedRequest}/>),
  'postcodes-io': defineApiPreview('postcodes-io', ({ data, requestUrl, executedRequest }) => <PostcodesIoPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'pypi-json': defineApiPreview('pypi-json', ({ data, requestUrl, executedRequest }) => <PyPiPackagePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'stack-exchange': defineApiPreview('stack-exchange', ({ data, requestUrl, executedRequest }) => <StackExchangeQuestionsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'uk-bank-holidays': defineApiPreview('uk-bank-holidays', ({ data, executedRequest }) => <UkBankHolidaysPreview data={data} executedRequest={executedRequest}/>),
  'hebcal-calendar': defineApiPreview('hebcal-calendar', ({ data, executedRequest }) => <HebcalCalendarPreview data={data} executedRequest={executedRequest}/>),
  usaspending: defineApiPreview('usaspending', ({ data, executedRequest }) => <FederalAwardsPreview data={data} executedRequest={executedRequest}/>),
  usgs: defineApiPreview('usgs', ({ data, executedRequest }) => <UsgsEarthquakePreview data={data} executedRequest={executedRequest}/>),
  'wikidata-sparql': defineApiPreview('wikidata-sparql', ({ data }) => <WikidataEntityPreview data={data}/>),
  'openssf-scorecard': defineApiPreview('openssf-scorecard', ({ data, requestUrl, executedRequest }) => <ScorecardPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'opencitations-index': defineApiPreview('opencitations-index', ({ data, requestUrl, executedRequest }) => <OpenCitationsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'world-bank-gdp': defineApiPreview('world-bank-gdp', ({ api, data, executedRequest }) => <WorldBankIndicatorPreview api={api} data={data} executedRequest={executedRequest}/>),
  'world-bank-population': defineApiPreview('world-bank-population', ({ api, data, executedRequest }) => <WorldBankIndicatorPreview api={api} data={data} executedRequest={executedRequest}/>),
  'frankfurter-sgd-myr-history': defineApiPreview('frankfurter-sgd-myr-history', ({ data, executedRequest }) => <FrankfurterSgdMyrHistoryPreview data={data} executedRequest={executedRequest}/>),
  'open-library-search': defineApiPreview('open-library-search', ({ data, requestUrl, executedRequest }) => <OpenLibrarySearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'open-food-facts': defineApiPreview('open-food-facts', ({ data, requestUrl, executedRequest }) => <OpenFoodFactsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'free-dictionary': defineApiPreview('free-dictionary', ({ api, data, requestUrl, executedRequest }) => <FreeDictionaryPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  pokeapi: defineApiPreview('pokeapi', ({ data, requestUrl, executedRequest }) => <PokeApiPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'art-institute-search': defineApiPreview('art-institute-search', ({ data, requestUrl, executedRequest }) => <ArtInstituteSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'tvmaze-search': defineApiPreview('tvmaze-search', ({ data, requestUrl, executedRequest }) => <TvmazeSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'gbif-species-search': defineApiPreview('gbif-species-search', ({ api, data, requestUrl, executedRequest }) => <GbifTaxonomyPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'clinical-trials-search': defineApiPreview('clinical-trials-search', ({ data, requestUrl, executedRequest }) => <ClinicalTrialsSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'openfda-drug-labels': defineApiPreview('openfda-drug-labels', ({ data, requestUrl, executedRequest }) => <DrugLabelPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'coinpaprika-ticker': defineApiPreview('coinpaprika-ticker', ({ api, data, executedRequest }) => <CoinPaprikaTickerPreview api={api} data={data} executedRequest={executedRequest}/>),
  'malaysia-fuel-price': defineApiPreview('malaysia-fuel-price', ({ data, requestUrl, executedRequest }) => <MalaysiaFuelPricePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'open-meteo-marine': defineApiPreview('open-meteo-marine', ({ data, requestUrl, executedRequest }) => <MarineForecastPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'nobel-prizes': defineApiPreview('nobel-prizes', ({ api, data, requestUrl, executedRequest }) => <NobelPrizePreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'chess-player-stats': defineApiPreview('chess-player-stats', ({ api, data, requestUrl, executedRequest }) => <LichessPlayerRatingsPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'crossref-works': defineApiPreview('crossref-works', ({ data, requestUrl, executedRequest }) => <CrossrefWorksPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'noaa-space-weather': defineApiPreview('noaa-space-weather', ({ data, executedRequest }) => <NoaaSpaceWeatherPreview data={data} executedRequest={executedRequest}/>),
  'osv-vulnerability': defineApiPreview('osv-vulnerability', ({ data, executedRequest }) => <OsvVulnerabilityPreview data={data} executedRequest={executedRequest}/>),
  'federal-register-documents': defineApiPreview('federal-register-documents', ({ data, requestUrl, executedRequest }) => <FederalRegisterPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'wikipedia-search': defineApiPreview('wikipedia-search', ({ data, requestUrl, executedRequest }) => <WikipediaSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'open-meteo-flood': defineApiPreview('open-meteo-flood', ({ data, requestUrl, executedRequest }) => <FloodForecastPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'open-meteo-history': defineApiPreview('open-meteo-history', ({ data, requestUrl, executedRequest }) => <OpenMeteoHistoryPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'kraken-public-ticker': defineApiPreview('kraken-public-ticker', ({ api, data, executedRequest }) => <KrakenPublicTickerPreview api={api} data={data} executedRequest={executedRequest}/>),
  'gitlab-public-projects': defineApiPreview('gitlab-public-projects', ({ data, requestUrl, executedRequest }) => <GitLabProjectSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'uk-police-street-crime': defineApiPreview('uk-police-street-crime', ({ api, data, executedRequest }) => <UkPoliceStreetCrimePreview api={api} data={data} executedRequest={executedRequest}/>),
  'open-brewery-directory': defineApiPreview('open-brewery-directory', ({ api, data, requestUrl, executedRequest }) => <OpenBreweryDirectoryPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'rick-morty-characters': defineApiPreview('rick-morty-characters', ({ data, requestUrl, executedRequest }) => <RickMortyCharactersPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'wikimedia-pageviews': defineApiPreview('wikimedia-pageviews', ({ data, executedRequest }) => <WikimediaPageviewsPreview data={data} executedRequest={executedRequest}/>),
  'vam-collections': defineApiPreview('vam-collections', ({ data, requestUrl, executedRequest }) => <VamCollectionsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'openf1-historical': defineApiPreview('openf1-historical', ({ data, requestUrl, executedRequest }) => <OpenF1SessionsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'irail-liveboard': defineApiPreview('irail-liveboard', ({ api, data, requestUrl, executedRequest }) => <IRailLiveboardPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'spaceflight-news': defineApiPreview('spaceflight-news', ({ data, executedRequest }) => <SpaceflightNewsPreview data={data} executedRequest={executedRequest}/>),
  'launch-library-upcoming': defineApiPreview('launch-library-upcoming', ({ data, executedRequest }) => <LaunchSchedulePreview data={data} executedRequest={executedRequest}/>),
  'wiktionary-entry': defineApiPreview('wiktionary-entry', ({ api, data, requestUrl, executedRequest }) => <WiktionaryEntryPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'animechan-random-quote': defineApiPreview('animechan-random-quote', ({ data }) => <AnimeQuotePreview data={data}/>),
  'jokeapi-safe': defineApiPreview('jokeapi-safe', ({ api, data, requestUrl, executedRequest }) => <JokeApiPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'dummyjson-recipes': defineApiPreview('dummyjson-recipes', ({ data, executedRequest }) => <DummyJsonRecipesPreview data={data} executedRequest={executedRequest}/>),
  'brasilapi-postcode': defineApiPreview('brasilapi-postcode', ({ api, data, requestUrl, executedRequest }) => <BrazilPostcodePreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'poetrydb-poems': defineApiPreview('poetrydb-poems', ({ api, data, requestUrl, executedRequest }) => <PoetryDbPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'coingecko-keyless-market': defineApiPreview('coingecko-keyless-market', ({ api, data, executedRequest }) => <CoinGeckoKeylessMarketPreview api={api} data={data} executedRequest={executedRequest}/>),
  'swapi-people': defineApiPreview('swapi-people', ({ data }) => <StarWarsPeoplePreview data={data}/>),
  'google-dns-doh': defineApiPreview('google-dns-doh', ({ data, requestUrl, executedRequest }) => <DnsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'color-api': defineApiPreview('color-api', ({ data, requestUrl, executedRequest }) => <ColorPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'nasa-image-search': defineApiPreview('nasa-image-search', ({ data, requestUrl, executedRequest }) => <NasaImageSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'lichess-top-players': defineApiPreview('lichess-top-players', ({ api, data, requestUrl, executedRequest }) => <LichessLeaderboardPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'pubmed-search': defineApiPreview('pubmed-search', ({ data, requestUrl, executedRequest }) => <PubMedSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'rxnorm-drug-search': defineApiPreview('rxnorm-drug-search', ({ data, requestUrl, executedRequest }) => <RxNormDrugPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'inaturalist-observations': defineApiPreview('inaturalist-observations', ({ data, requestUrl, executedRequest }) => <INaturalistObservationsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'first-epss': defineApiPreview('first-epss', ({ data, requestUrl, executedRequest }) => <FirstEpssPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'endoflife-date': defineApiPreview('endoflife-date', ({ data, requestUrl, executedRequest }) => <LifecyclePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'deps-dev': defineApiPreview('deps-dev', ({ data, requestUrl, executedRequest }) => <DepsDevPackagePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'ecb-fx-rates': defineApiPreview('ecb-fx-rates', ({ data, requestUrl, executedRequest }) => <CoinbaseRatesPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'un-sdg-goals': defineApiPreview('un-sdg-goals', ({ data }) => <UnSdgGoalsPreview data={data}/>),
  'datacite-search': defineApiPreview('datacite-search', ({ data, requestUrl, executedRequest }) => <DataCiteSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'ror-search': defineApiPreview('ror-search', ({ data, executedRequest }) => <RorSearchPreview data={data} executedRequest={executedRequest}/>),
  'celestrak-satellites': defineApiPreview('celestrak-satellites', ({ data, requestUrl, executedRequest }) => <CelestrakSatellitesPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'cleveland-museum-search': defineApiPreview('cleveland-museum-search', ({ data, requestUrl, executedRequest }) => <ClevelandMuseumSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'scryfall-card-search': defineApiPreview('scryfall-card-search', ({ data, requestUrl, executedRequest }) => <ScryfallCardSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'dnd5e-spell-lookup': defineApiPreview('dnd5e-spell-lookup', ({ api, data, requestUrl, executedRequest }) => <DndSpellPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'qr-code-generator': defineApiPreview('qr-code-generator', ({ api, requestUrl, executedRequest, responseMedia }) => <GeneratedImagePreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} responseMedia={responseMedia}/>),
  'where-the-iss-at': defineApiPreview('where-the-iss-at', ({ data, executedRequest }) => <IssPositionPreview data={data} executedRequest={executedRequest}/>),
  'eurostat-population': defineApiPreview('eurostat-population', ({ data, requestUrl, executedRequest }) => <EurostatPopulationPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'bls-timeseries': defineApiPreview('bls-timeseries', ({ api, data, executedRequest }) => <BlsTimeseriesPreview api={api} data={data} executedRequest={executedRequest}/>),
  'fema-disasters': defineApiPreview('fema-disasters', ({ data, requestUrl, executedRequest }) => <FemaDisasterPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'noaa-tides': defineApiPreview('noaa-tides', ({ data, requestUrl, executedRequest }) => <TideWaterLevelPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'rdap-domain-lookup': defineApiPreview('rdap-domain-lookup', ({ data, requestUrl, executedRequest }) => <RdapDomainPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'languagetool-grammar-check': defineApiPreview('languagetool-grammar-check', ({ data, requestUrl, executedRequest }) => <GrammarPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'doaj-search': defineApiPreview('doaj-search', ({ data, requestUrl, executedRequest }) => <DoajSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'pubchem-compound': defineApiPreview('pubchem-compound', ({ data, requestUrl, executedRequest }) => <PubChemCompoundPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'chembl-molecule': defineApiPreview('chembl-molecule', ({ data, requestUrl, executedRequest }) => <ChemblMoleculePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'uniprot-protein': defineApiPreview('uniprot-protein', ({ data, requestUrl, executedRequest }) => <ProteinAnnotationPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'rcsb-pdb-entry': defineApiPreview('rcsb-pdb-entry', ({ data, requestUrl, executedRequest }) => <PdbStructurePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'ensembl-gene-lookup': defineApiPreview('ensembl-gene-lookup', ({ data, requestUrl, executedRequest }) => <EnsemblGenePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'obis-marine-occurrences': defineApiPreview('obis-marine-occurrences', ({ data, requestUrl, executedRequest }) => <ObisOccurrencePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'worms-species-lookup': defineApiPreview('worms-species-lookup', ({ data, requestUrl, executedRequest }) => <WormsSpeciesPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'paleobiodb-taxa': defineApiPreview('paleobiodb-taxa', ({ data, requestUrl, executedRequest }) => <PaleobiodbTaxonPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'usgs-water-legacy': defineApiPreview('usgs-water-legacy', ({ data, requestUrl, executedRequest }) => <UsgsWaterPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'rubygems-lookup': defineApiPreview('rubygems-lookup', ({ data, requestUrl, executedRequest }) => <RubyGemsPackagePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'nuget-package-lookup': defineApiPreview('nuget-package-lookup', ({ data, requestUrl, executedRequest }) => <NuGetPackagePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'internet-archive-search': defineApiPreview('internet-archive-search', ({ data, executedRequest }) => <InternetArchiveSearchPreview data={data} executedRequest={executedRequest}/>),
  'ipwhois-lookup': defineApiPreview('ipwhois-lookup', ({ data, requestUrl, executedRequest }) => <IpWhoisPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'newton-math-solver': defineApiPreview('newton-math-solver', ({ data, requestUrl, executedRequest }) => <NewtonMathPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'datamuse-rhymes': defineApiPreview('datamuse-rhymes', ({ data, requestUrl, executedRequest }) => <DatamuseWordPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'open5e-monster-search': defineApiPreview('open5e-monster-search', ({ data, requestUrl, executedRequest }) => <Open5eMonsterPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'dicebear-avatar': defineApiPreview('dicebear-avatar', ({ api, requestUrl, executedRequest, responseMedia }) => <GeneratedImagePreview api={api} requestUrl={requestUrl} executedRequest={executedRequest} responseMedia={responseMedia}/>),
  catfacts: defineApiPreview('catfacts', ({ data }) => <CatFactPreview data={data}/>),
  'anilist-graphql': defineApiPreview('anilist-graphql', ({ api, data, executedRequest }) => <AniListMediaPreview api={api} data={data} executedRequest={executedRequest}/>),
  'openverse-search': defineApiPreview('openverse-search', ({ data, requestUrl, executedRequest }) => <OpenverseSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'apple-itunes-search': defineApiPreview('apple-itunes-search', ({ data, executedRequest }) => <AppleItunesSearchPreview data={data} executedRequest={executedRequest}/>),
  'packagist-search': defineApiPreview('packagist-search', ({ data, executedRequest }) => <PackagistSearchPreview data={data} executedRequest={executedRequest}/>),
  'jolpica-f1': defineApiPreview('jolpica-f1', ({ data, requestUrl, executedRequest }) => <JolpicaF1Preview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'hn-search-algolia': defineApiPreview('hn-search-algolia', ({ data, requestUrl, executedRequest }) => <HnAlgoliaSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'open-meteo-seasonal': defineApiPreview('open-meteo-seasonal', ({ data, requestUrl, executedRequest }) => <OpenMeteoSeasonalPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'nhtsa-safety-ratings': defineApiPreview('nhtsa-safety-ratings', ({ data, executedRequest }) => <NhtsaSafetyRatingsPreview data={data} executedRequest={executedRequest}/>),
  'singstat-cpi-monthly': defineApiPreview('singstat-cpi-monthly', ({ data, requestUrl, executedRequest }) => <SingStatCpiPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'openalex-works-search': defineApiPreview('openalex-works-search', ({ data, executedRequest }) => <OpenAlexWorksPreview data={data} executedRequest={executedRequest}/>),
  'oecd-cli': defineApiPreview('oecd-cli', ({ data, requestUrl, executedRequest }) => <OecdCliPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'bank-of-canada-valet': defineApiPreview('bank-of-canada-valet', ({ data, executedRequest }) => <BankOfCanadaValetPreview data={data} executedRequest={executedRequest}/>),
  'swiss-transit-connections': defineApiPreview('swiss-transit-connections', ({ api, data, requestUrl, executedRequest }) => <SwissTransitConnectionsPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'nasa-power-climate': defineApiPreview('nasa-power-climate', ({ api, data, executedRequest }) => <NasaPowerClimatePreview api={api} data={data} executedRequest={executedRequest}/>),
  'zippopotam-postcode': defineApiPreview('zippopotam-postcode', ({ api, data, requestUrl, executedRequest }) => <ZippopotamPostcodePreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'malaysia-core-cpi': defineApiPreview('malaysia-core-cpi', ({ data, requestUrl, executedRequest }) => <MalaysiaCoreCpiPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'malaysia-household-income': defineApiPreview('malaysia-household-income', ({ data, requestUrl, executedRequest }) => <MalaysiaHouseholdIncomePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'malaysia-population': defineApiPreview('malaysia-population', ({ data, requestUrl, executedRequest }) => <MalaysiaPopulationPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'openfda-food-recalls': defineApiPreview('openfda-food-recalls', ({ data, requestUrl, executedRequest }) => <FoodRecallPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'iconify-search': defineApiPreview('iconify-search', ({ data, requestUrl, executedRequest }) => <IconifySearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'homebrew-formula-json': defineApiPreview('homebrew-formula-json', ({ data, requestUrl, executedRequest }) => <HomebrewPackagePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'npm-download-counts': defineApiPreview('npm-download-counts', ({ data, requestUrl, executedRequest }) => <DownloadsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'geoboundaries-admin-boundaries': defineApiPreview('geoboundaries-admin-boundaries', ({ data, requestUrl, executedRequest }) => <GeoBoundariesPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'osrm-route': defineApiPreview('osrm-route', ({ data, executedRequest }) => <OsrmRoutePreview data={data} executedRequest={executedRequest}/>),
  'opendota-pro-matches': defineApiPreview('opendota-pro-matches', ({ data }) => <OpenDotaMatchesPreview data={data}/>),
  'openligadb-matches': defineApiPreview('openligadb-matches', ({ data, requestUrl, executedRequest }) => <OpenLigaDbMatchesPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'uk-parliament-members': defineApiPreview('uk-parliament-members', ({ data, requestUrl, executedRequest }) => <UkParliamentMembersPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'mlb-stats-api': defineApiPreview('mlb-stats-api', ({ data, executedRequest }) => <MlbSchedulePreview data={data} executedRequest={executedRequest}/>),
  'gleif-lei': defineApiPreview('gleif-lei', ({ data, requestUrl, executedRequest }) => <GleifLeiPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'fdic-bankfind': defineApiPreview('fdic-bankfind', ({ data, requestUrl, executedRequest }) => <FdicBankPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'uk-food-hygiene': defineApiPreview('uk-food-hygiene', ({ data, executedRequest }) => <FoodHygienePreview data={data} executedRequest={executedRequest}/>),
  'uk-flood-monitoring': defineApiPreview('uk-flood-monitoring', ({ data, requestUrl, executedRequest }) => <FloodStationPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'unhcr-refugees': defineApiPreview('unhcr-refugees', ({ data, requestUrl, executedRequest }) => <RefugeePopulationPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'hdx-humanitarian-datasets': defineApiPreview('hdx-humanitarian-datasets', ({ data, executedRequest }) => <HumanitarianEventPreview data={data} executedRequest={executedRequest}/>),
  'open-meteo-climate': defineApiPreview('open-meteo-climate', ({ data, requestUrl, executedRequest }) => <OpenMeteoClimatePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'models-dev': defineApiPreview('models-dev', ({ data, requestUrl, executedRequest }) => <HuggingFaceModelsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  vatcomply: defineApiPreview('vatcomply', ({ data, requestUrl, executedRequest }) => <VatcomplyRatesPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'mempool-space-btc': defineApiPreview('mempool-space-btc', ({ data, requestUrl, executedRequest }) => <MempoolFeePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  metacpan: defineApiPreview('metacpan', ({ data, executedRequest }) => <MetaCpanModulePreview data={data} executedRequest={executedRequest}/>),
  hexpm: defineApiPreview('hexpm', ({ data, requestUrl, executedRequest }) => <HexPmPackagePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'pub-dev': defineApiPreview('pub-dev', ({ data, requestUrl, executedRequest }) => <PubDevPackagePreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'go-module-proxy': defineApiPreview('go-module-proxy', ({ data, requestUrl, executedRequest }) => <GoModuleVersionsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'flathub-appstream': defineApiPreview('flathub-appstream', ({ data, executedRequest }) => <FlathubAppstreamPreview data={data} executedRequest={executedRequest}/>),
  'github-global-advisories': defineApiPreview('github-global-advisories', ({ data, executedRequest }) => <GitHubGlobalAdvisoriesPreview data={data} executedRequest={executedRequest}/>),
  'dblp-search': defineApiPreview('dblp-search', ({ data, requestUrl, executedRequest }) => <DblpSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'citybikes-network': defineApiPreview('citybikes-network', ({ api, data, requestUrl, executedRequest }) => <CityBikesNetworkPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'wikimedia-commons-search': defineApiPreview('wikimedia-commons-search', ({ data, requestUrl, executedRequest }) => <WikimediaCommonsSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'jsdelivr-package': defineApiPreview('jsdelivr-package', ({ api, data, requestUrl, executedRequest }) => <JsDelivrPackagePreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'canada-open-data-search': defineApiPreview('canada-open-data-search', ({ data, requestUrl, executedRequest }) => <CanadaOpenDataPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'gbif-occurrence-search': defineApiPreview('gbif-occurrence-search', ({ data, executedRequest }) => <GbifOccurrencePreview data={data} executedRequest={executedRequest}/>),
  'open-meteo-ensemble': defineApiPreview('open-meteo-ensemble', ({ data, executedRequest }) => <OpenMeteoEnsemblePreview data={data} executedRequest={executedRequest}/>),
  'world-bank-indicator-explorer': defineApiPreview('world-bank-indicator-explorer', ({ api, data, executedRequest }) => <WorldBankIndicatorPreview api={api} data={data} executedRequest={executedRequest}/>),
  'exchange-rate-current': defineApiPreview('exchange-rate-current', ({ data, requestUrl, executedRequest }) => <ExchangeRateApiPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
  'circl-vulnerability': defineApiPreview('circl-vulnerability', ({ data, requestUrl, executedRequest }) => <CirclVulnerabilityPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>),
}

export const apiPreviewComponentIds = Object.keys(apiPreviewComponents)

export type ApiSsotCardDefinition = {
  id: string
  layout: PreviewLayout
  label: string
  Component: ApiPreviewComponent
  source: 'live-response'
  fallbackPolicy: 'forbidden'
}

export const apiSsotCardRegistry: Partial<Record<string, ApiSsotCardDefinition>> = Object.fromEntries(
  apiCatalog.map((api) => {
    const profile = getPreviewProfile(api.id)
    const Component = apiPreviewComponents[api.id]
    if (!profile || !Component) throw new Error(`Missing SSOT card definition for ${api.id}`)
    return [
      api.id,
      {
        id: api.id,
        layout: profile.layout,
        label: profile.label,
        Component,
        source: 'live-response' as const,
        fallbackPolicy: 'forbidden' as const,
      },
    ]
  }),
)

export const apiSsotCardIds = Object.keys(apiSsotCardRegistry)

const previewMeta: Record<PreviewLayout, { icon: string; eyebrow: string; title: string; description: string }> = {
  'security-scorecard': {
    icon: '◇',
    eyebrow: 'Security practices',
    title: 'Repository check evidence',
    description: 'Individual scored and inconclusive security checks.',
  },
  'grammar-review': {
    icon: 'Aa',
    eyebrow: 'Writing review',
    title: 'Grammar findings',
    description: 'Context, explanations and suggested replacements.',
  },
  'vehicle-recalls': {
    icon: '!',
    eyebrow: 'Vehicle recalls',
    title: 'Recall campaigns',
    description: 'Complete defect, consequence and remedy information.',
  },
  'color-swatch': {
    icon: '◐',
    eyebrow: 'Color specification',
    title: 'Color workbench',
    description: 'A color swatch with full color-space specifications.',
  },
  'carbon-intensity': {
    icon: 'CO₂',
    eyebrow: 'Electricity emissions',
    title: 'Great Britain carbon intensity',
    description: 'Current half-hour forecast and estimated actual carbon intensity from NESO.',
  },
  'terrain-elevation': {
    icon: '△',
    eyebrow: 'Terrain elevation',
    title: 'Coordinate elevation',
    description: 'Copernicus GLO-90 terrain elevation paired with the WGS84 coordinate that produced the response.',
  },
  'flood-stations': {
    icon: '≈',
    eyebrow: 'River monitoring',
    title: 'Environment Agency stations',
    description: 'Matching monitoring stations with exact river identity, location, status, catchment, and available measurement types.',
  },
  'water-gauge': {
    icon: '≈',
    eyebrow: 'Water monitoring',
    title: 'Latest USGS observation',
    description: 'Latest continuous streamflow or gage-height observation with status, units, time, and location context.',
  },
  'population-statistic': {
    icon: 'Σ',
    eyebrow: 'Official population statistics',
    title: 'Eurostat population',
    description: 'Population on 1 January with explicit geography, year, unit, age, sex, and frequency dimensions.',
  },
  'refugee-population': {
    icon: '↔',
    eyebrow: 'Forced displacement',
    title: 'UNHCR year-end population',
    description: 'Origin-country displacement and return populations with explicit ISO identity and reporting year.',
  },
  'disaster-declared-areas': {
    icon: '!',
    eyebrow: 'Federal disaster declarations',
    title: 'FEMA declared areas',
    description: 'Area-level OpenFEMA declaration records with declaration identity, incident context, dates, and assistance-program flags.',
  },
  'core-cpi-index': {
    icon: '∿',
    eyebrow: 'Consumer prices',
    title: 'Malaysia core CPI index',
    description: 'Overall monthly core CPI index level with explicit base, reporting month, and semantic trend values.',
  },
  'food-hygiene-ratings': {
    icon: '5',
    eyebrow: 'Food hygiene',
    title: 'UK food hygiene ratings',
    description: 'FSA establishment ratings with inspection date, authority, and correctly oriented FHRS component scores.',
  },
  'food-product': {
    icon: 'OF',
    eyebrow: 'Food product lookup',
    title: 'Product nutrition facts',
    description: 'Request-bound Open Food Facts product identity with selected nutrition, ingredient, and label evidence.',
  },
  'household-income': {
    icon: 'RM',
    eyebrow: 'Household income',
    title: 'Malaysia household income',
    description: 'Nominal HIES mean and median monthly gross household income across published survey observations.',
  },
  'population-total': {
    icon: 'MY',
    eyebrow: 'Demography',
    title: 'Malaysia population',
    description: 'National total population with demographic dimensions fixed to overall totals and provider units made explicit.',
  },
  'humanitarian-events': {
    icon: 'IF',
    eyebrow: 'Humanitarian events',
    title: 'IFRC GO emergencies',
    description: 'Recent events with source-separated field-report impact figures and disaster-start chronology.',
  },
  'sdg-goals': {
    icon: '17',
    eyebrow: 'Global goals',
    title: 'UN Sustainable Development Goals',
    description: 'Official SDG goal identities, titles, descriptions, and provider API paths from the current goal catalogue.',
  },
  'satellite-orbits': {
    icon: '◎',
    eyebrow: 'Orbital elements',
    title: 'CelesTrak GP orbital elements',
    description: 'CCSDS OMM-style orbital elements at their supplied epoch, with catalog identity and units kept explicit.',
  },
  'marine-occurrences': {
    icon: '≈',
    eyebrow: 'Marine biodiversity',
    title: 'OBIS occurrence evidence',
    description: 'Darwin Core occurrence identity, status, timing, location, dataset provenance, and provider quality flags.',
  },
  'marine-taxonomy': {
    icon: 'T',
    eyebrow: 'Marine taxonomy',
    title: 'WoRMS taxon resolution',
    description: 'Queried taxon identity, status, stable Aphia IDs, classification, habitat flags, and current accepted-name relationship.',
  },
  'fossil-taxon': {
    icon: 'F',
    eyebrow: 'Paleobiology taxonomy',
    title: 'Fossil taxon profile',
    description: 'PBDB taxon identity, accepted-name relationship, extancy, and fossil occurrence count scoped to the taxon plus subtaxa.',
  },
  'species-observations': {
    icon: 'IN',
    eyebrow: 'Biodiversity observations',
    title: 'Species observations',
    description: 'Request-bound iNaturalist observation, taxon, photo-rights, and public geoprivacy evidence.',
  },
  'knowledge-entities': {
    icon: 'Q',
    eyebrow: 'Knowledge graph',
    title: 'Wikidata entity bindings',
    description: 'Stable Wikidata QIDs, entity URIs, and returned labels preserved from bounded SPARQL bindings.',
  },
  'citation-count': {
    icon: '↙',
    eyebrow: 'Citation index',
    title: 'Incoming citation count',
    description: 'A DOI-bound incoming citation count scoped explicitly to OpenCitations Index v2.',
  },
  'federal-agency-overview': {
    icon: 'US',
    eyebrow: 'Federal agency overview',
    title: 'Agency overview',
    description: 'USAspending agency identity, mission, fiscal-year context, official links, and emergency-funding reference codes.',
  },
  'federal-awards': {
    icon: '$',
    eyebrow: 'Federal contract awards',
    title: 'Prime contract awards',
    description: 'USAspending award-level amounts, obligation dates, recipients, agencies, contract type, and pagination context.',
  },
  'ip-geolocation': {
    icon: 'IP',
    eyebrow: 'Network geolocation',
    title: 'Approximate IP location',
    description: 'Approximate WGS84 location, timezone, ASN, organization, and ISP metadata for one public IP address.',
  },
  'boundary-layer': {
    icon: '▱',
    eyebrow: 'Administrative boundaries',
    title: 'Boundary layer metadata',
    description: 'gbOpen layer identity, provenance, per-unit geometry statistics, source license, and provider download links.',
  },
  'f1-season-catalog': {
    icon: 'F1',
    eyebrow: 'Formula 1 season catalogue',
    title: 'Drivers, constructors and races',
    description: 'Dataset-aware Formula 1 season identities and calendar facts from Jolpica.',
  },
  'pro-match-results': {
    icon: 'VS',
    eyebrow: 'Professional esports',
    title: 'OpenDota match results',
    description: 'Professional match identity, kill counts, winner, timing, league, and series metadata with provider semantics kept explicit.',
  },
  'football-matchday': {
    icon: '⚽',
    eyebrow: 'Football matchday',
    title: 'OpenLigaDB schedule and results',
    description: 'Team identity, kickoff timing, status, goals, and typed result stages for one league matchday.',
  },
  'baseball-schedule': {
    icon: '⚾',
    eyebrow: 'Baseball schedule',
    title: 'MLB dated schedule',
    description: 'Game identity, start time, status, home/away teams, venue, series context, records, and provider-supplied scores.',
  },
  'dns-records': {
    icon: '⌘',
    eyebrow: 'DNS diagnosis',
    title: 'DNS records',
    description: 'Resolver status, cache lifetime, and complete answer records.',
  },
  'download-summary': {
    icon: '↓',
    eyebrow: 'Package adoption',
    title: 'Download summary',
    description: 'Period downloads with the provider reporting window.',
  },
  'release-lifecycle': {
    icon: '◷',
    eyebrow: 'Software lifecycle',
    title: 'Release support',
    description: 'Release cycles, maintenance flags and dated support milestones.',
  },
  'exchange-rates': {
    icon: '⇄',
    eyebrow: 'Currency conversion',
    title: 'Exchange rates',
    description: 'Convert using this response and inspect available rates.',
  },

  'weather-dashboard': {
    icon: '☀',
    eyebrow: 'Live response · Weather layout',
    title: 'Current conditions',
    description: 'A ready-to-use weather dashboard built from observations, units, and location data.',
  },
  'space-weather-scales': {
    icon: 'SW',
    eyebrow: 'Live response · Space-weather scales',
    title: 'NOAA R / S / G scales',
    description: 'Request-bound NOAA current and forecast scale evidence with missing values kept distinct from quiet zero activity.',
  },
  'country-profile': {
    icon: '◎',
    eyebrow: 'Live response · Profile layout',
    title: 'Country profile',
    description: 'A structured destination profile using regional and economic metadata.',
  },
  'market-chart': {
    icon: '↗',
    eyebrow: 'Live response · Market layout',
    title: 'Market snapshot',
    description: 'A financial panel that turns price history and rates into an at-a-glance trend.',
  },
  'state-population': {
    icon: 'US',
    eyebrow: 'Live response · State population',
    title: 'State population estimates',
    description: 'Request-bound ACS 5-year state rows with year, pagination, geography identity, and native population evidence.',
  },
  'fx-history': {
    icon: 'FX',
    eyebrow: 'Live response · FX history',
    title: 'SGD/MYR reference-rate history',
    description: 'Request-bound ECB reference rates with exact currency identity, date-range, and native-number evidence.',
  },
  'central-bank-series': {
    icon: 'BOC',
    eyebrow: 'Live response · Central bank series',
    title: 'Bank of Canada observations',
    description: 'Request-bound official observations with series identity, date-range, and provider decimal-value evidence.',
  },
  'labor-timeseries': {
    icon: 'BLS',
    eyebrow: 'Live response · Labor statistics',
    title: 'BLS time series',
    description: 'Request-bound official labor observations with series, period, ordering, and provider decimal-string evidence.',
  },
  'climate-series': {
    icon: '☀',
    eyebrow: 'Live response · Climate series',
    title: 'NASA POWER climate series',
    description: 'Request-bound daily climate measurements with parameter, date, metadata, location, and fill-value evidence.',
  },
  'indicator-series': {
    icon: 'WDI',
    eyebrow: 'Live response · Development indicator',
    title: 'World Bank indicator series',
    description: 'Request-bound yearly observations with country, indicator, pagination, and missing-value evidence.',
  },
  'ensemble-forecast': {
    icon: '≋',
    eyebrow: 'Live response · Ensemble forecast',
    title: 'Forecast uncertainty',
    description: 'Request-bound control and ensemble-member evidence for the selected hourly weather variable.',
  },
  'historical-weather': {
    icon: '◷',
    eyebrow: 'Live response · Historical weather',
    title: 'Historical weather',
    description: 'Request-bound daily temperature and precipitation evidence for the executed historical range.',
  },
  'federal-rulemaking': {
    icon: 'FR',
    eyebrow: 'Live response · Federal rulemaking',
    title: 'Federal Register documents',
    description: 'Publication-dated federal rulemaking documents with agency and document context.',
  },
  'launch-schedule': {
    icon: 'T−',
    eyebrow: 'Live response · Launch schedule',
    title: 'Upcoming space launches',
    description: 'Mission launch timing, provider, status, and launch-site context.',
  },
  'anime-media-search': {
    icon: 'AN',
    eyebrow: 'Live response · AniList media',
    title: 'Anime and manga discovery',
    description: 'Request-bound AniList media identities and result metadata.',
  },
  'generated-qr-code': {
    icon: 'QR',
    eyebrow: 'Live response · QR image',
    title: 'Generated QR code',
    description: 'The image produced by the exact QR generation request.',
  },
  'generated-avatar': {
    icon: 'AV',
    eyebrow: 'Live response · Avatar image',
    title: 'Generated avatar',
    description: 'The deterministic avatar image produced by the selected DiceBear request.',
  },
  'commons-media-search': {
    icon: 'WC',
    eyebrow: 'Live response · Wikimedia Commons',
    title: 'Commons media search',
    description: 'Request-bound Commons file identity, source links, and media metadata.',
  },
  'dog-gallery': {
    icon: 'DG',
    eyebrow: 'Live response · Dog CEO gallery',
    title: 'Dog image gallery',
    description: 'Exact-request-bound Dog CEO image identities with conservative source and rights context.',
  },
  'public-holiday-calendar': {
    icon: 'NH',
    eyebrow: 'Live response · Public holidays',
    title: 'Public holiday calendar',
    description: 'Exact-request-bound Nager.Holidays dates with country, year, national/regional scope, subdivisions, and holiday types.',
  },
  'uk-bank-holiday-calendar': {
    icon: 'UK',
    eyebrow: 'Live response · UK bank holidays',
    title: 'UK bank holiday calendar',
    description: 'Exact-request-bound GOV.UK dates grouped by England and Wales, Scotland, and Northern Ireland.',
  },
  'recipe-search': {
    icon: 'RE',
    eyebrow: 'Live response · Recipe search',
    title: 'Synthetic recipe search',
    description: 'Exact-request-bound synthetic recipe identities with cooking, nutrition, rating, ingredient, and instruction evidence.',
  },
  'synthetic-people': {
    icon: 'RU',
    eyebrow: 'Live response · Synthetic profiles',
    title: 'Generated placeholder profiles',
    description: 'Exact-request-bound synthetic test identities with provider UUID evidence and PII-minimized primary presentation.',
  },
  'met-open-access-object': {
    icon: 'MET',
    eyebrow: 'Live response · Open Access object',
    title: 'Met Museum object',
    description: 'Exact-request-bound artwork identity, provider metadata, and fail-closed Open Access image-rights evidence.',
  },
  'trading-card-search': { icon: 'TCG',
    eyebrow: 'Live response · Trading-card search',
    title: 'Trading-card search',
    description: 'Request-bound card identity, set metadata, collector numbers, Scryfall pages, and provider artwork.',
  },
  'encyclopedia-search': {
    icon: 'WP',
    eyebrow: 'Live response · Encyclopedia search',
    title: 'Wikipedia articles',
    description: 'Request-bound English Wikipedia article identities with optional extract and thumbnail evidence.',
  },
  'open-access-art-search': {
    icon: 'CMA',
    eyebrow: 'Live response · Open-access art',
    title: 'CC0 artwork search',
    description: 'Request-bound museum artworks with provider inventory identity, image evidence, and explicit CC0 designation.',
  },
  'public-domain-art-search': {
    icon: 'AIC',
    eyebrow: 'Live response · Public-domain art',
    title: 'Public-domain artwork search',
    description: 'Request-bound Art Institute artwork identities with provider-configured IIIF images and explicit public-domain evidence.',
  },
  'nasa-media-library': {
    icon: 'NASA',
    eyebrow: 'Live response · NASA media',
    title: 'NASA media library',
    description: 'Request-bound NASA media with provider asset identity, source metadata, and reuse guidance.',
  },
  'licensed-media-search': {
    icon: 'CC',
    eyebrow: 'Live response · Licensed media',
    title: 'Openverse licensed media',
    description: 'Request-bound openly licensed media with provider work identity, source links, and per-work license evidence.',
  },
  'itunes-media-search': {
    icon: 'IT',
    eyebrow: 'Live response · Apple media search',
    title: 'Apple media catalog',
    description: 'Exact-request-bound Apple catalog identities and storefront links without embedded promotional artwork or preview media.',
  },
  'spaceflight-news': { icon: 'SN',
    eyebrow: 'Live response · Spaceflight reporting',
    title: 'Spaceflight publisher articles',
    description: 'Exact-request-bound article identities, publisher links, publication timestamps, and documented reference counts.',
  },
  'pokemon-profile': {
    icon: 'PK',
    eyebrow: 'Live response · Pokémon profile',
    title: 'Pokémon identity and battle profile',
    description: 'Exact-request-bound Pokédex identity, native types, abilities, base stats, physical measurements, and provider sprite evidence.',
  },
  'tv-show-search': {
    icon: 'TV',
    eyebrow: 'Live response · TV show search',
    title: 'TVmaze show search',
    description: 'Exact-request-bound TVmaze show identities with native relevance, schedule, channel, rating, and source evidence.',
  },
  'character-search': {
    icon: 'RM',
    eyebrow: 'Live response · Character search',
    title: 'Rick and Morty characters',
    description: 'Exact-request-bound character identities with life status, species, origin, last-known location, and episode evidence.',
  },
  'appstream-profile': {
    icon: 'FL',
    eyebrow: 'Live response · AppStream profile',
    title: 'Flathub application profile',
    description: 'Exact-request-bound application identity, license, stable release, Flatpak runtime, screenshots, and project links.',
  },
  'archive-search': {
    icon: 'IA',
    eyebrow: 'Live response · Archive search',
    title: 'Internet Archive search',
    description: 'Exact-request-bound Archive.org item identities with optional uploader-supplied rights and license evidence.',
  },
  'location-map': {
    icon: '⌖',
    eyebrow: 'Live response · Location layout',
    title: 'Location explorer',
    description: 'A spatial interface that maps coordinates and keeps every location agent-readable.',
  },
  'brewery-directory': {
    icon: 'BR',
    eyebrow: 'Live response · Brewery directory',
    title: 'Brewery directory',
    description: 'Request-bound brewery identities, business types, address metadata, websites, and available provider coordinates.',
  },
  'iss-position': {
    icon: 'ISS',
    eyebrow: 'Live response · ISS orbital position',
    title: 'International Space Station',
    description: 'Request-bound WGS84 position, motion, observation time, visibility, and orbital context for NORAD 25544.',
  },
  'taxi-availability': {
    icon: 'TX',
    eyebrow: 'Live response · Taxi availability',
    title: 'Singapore taxi availability',
    description: 'Request-bound anonymous taxi positions with exact GeoJSON, count, and provider-acquisition-time evidence.',
  },
  'traffic-camera-snapshot': {
    icon: 'TI',
    eyebrow: 'Live response · Traffic cameras',
    title: 'Singapore traffic camera snapshot',
    description: 'Request-bound LTA traffic-camera images with strict camera, image, timestamp, location, dimensions, and MD5 identity.',
  },
  'place-geocoding': {
    icon: '⌖',
    eyebrow: 'Live response · Place geocoding',
    title: 'Place and postal-code search',
    description: 'Request-bound GeoNames-based locations with provider identity, WGS84 coordinates, and exact request evidence.',
  },
  'postcode-profile': {
    icon: 'PC',
    eyebrow: 'Live response · UK postcode',
    title: 'Postcode geography profile',
    description: 'Request-bound UK postcode identity with WGS84 coordinates and administrative geography from open datasets.',
  },
  'postcode-geolocation': {
    icon: 'ZIP',
    eyebrow: 'Live response · Postal geolocation',
    title: 'Postcode geolocation',
    description: 'Request-bound country, postcode, place, state, and documented coordinate-string evidence.',
  },
  'street-crime': {
    icon: '⌖',
    eyebrow: 'Street-crime evidence',
    title: 'UK Police street crime',
    description: 'Request-bound, anonymised area-level crime records with stable provider identities.',
  },
  'bike-share-network': {
    icon: 'CB',
    eyebrow: 'Live response · Bike-share network',
    title: 'Bike-share availability',
    description: 'Request-bound network identity with validated live station coordinates, available bicycles, and empty docks.',
  },
  'jewish-calendar': {
    icon: 'HB',
    eyebrow: 'Live response · Jewish calendar',
    title: 'Hebcal Hebrew-year calendar',
    description: 'Exact-request-bound Hebrew-year events with Gregorian/Hebrew dates, schedule identity, categories, and attribution.',
  },
  'solar-cycle': {
    icon: '☀',
    eyebrow: 'Live response · Solar layout',
    title: 'Sun & moon cycle',
    description: 'A daylight timeline built from local sunrise, sunset, twilight, solar, and lunar data.',
  },
  'natural-events': {
    icon: '◎',
    eyebrow: 'Live response · Earth monitor',
    title: 'Natural events monitor',
    description: 'Near-real-time natural events organized by category, location, status, and observation time.',
  },
  'transit-board': {
    icon: 'T',
    eyebrow: 'Live response · Transit layout',
    title: 'Transit route board',
    description: 'A route-focused interface using MBTA colors, destinations, and service types.',
  },
  'swiss-transit-connections': {
    icon: 'CH',
    eyebrow: 'Live response · Swiss connection evidence',
    title: 'Swiss transit connections',
    description: 'Exact-request-bound Swiss connections with provider station identity, scheduled timing, service products, and honest departure-delay evidence.',
  },
  'trivia-game': {
    icon: '?',
    eyebrow: 'Live response · Game layout',
    title: 'Trivia challenge',
    description: 'A playable-looking question deck with decoded prompts, answer options, and difficulty labels.',
  },
  'joke-stage': {
    icon: 'J',
    eyebrow: 'Live response · Joke safety',
    title: 'Safe joke stage',
    description: 'Exact-request-bound JokeAPI content with requested category/type identity and provider moderation-flag evidence.',
  },
  'rest-post': {
    icon: 'REST',
    eyebrow: 'Live response · REST resource',
    title: 'JSONPlaceholder post',
    description: 'Request-bound fake REST post identity, author relation, title, and body from the documented JSONPlaceholder resource.',
  },
  'community-articles': {
    icon: 'DEV',
    eyebrow: 'Live response · Community articles',
    title: 'DEV published articles',
    description: 'Request-bound public Forem articles with exact tag identity, authorship, publication timing, engagement, and reading-time semantics.',
  },
  'repository-list': {
    icon: 'GH',
    eyebrow: 'Live response · Repository list',
    title: 'GitHub public repositories',
    description: 'Request-bound GitHub repository identity, ownership, archive state, popularity metrics, language, topics, and update activity.',
  },
  'hn-item': {
    icon: 'HN',
    eyebrow: 'Live response · HN item',
    title: 'Hacker News item',
    description: 'Request-bound Hacker News item identity with type-aware status, authorship, publication, discussion, parent, poll, and score semantics.',
  },
  'go-module-versions': {
    icon: 'GO',
    eyebrow: 'Live response · Go module versions',
    title: 'Go module version catalog',
    description: 'Request-bound canonical tagged Go module versions with release/prerelease counts and semantic-version ordering.',
  },
  'cdn-package': {
    icon: 'CDN',
    eyebrow: 'Live response · CDN package metadata',
    title: 'jsDelivr package metadata',
    description: 'Request-bound npm package identity, trusted dist-tags, and validated published versions from the jsDelivr data API.',
  },
  'hn-search': {
    icon: 'HN',
    eyebrow: 'Live response · HN search',
    title: 'Hacker News search',
    description: 'Request-bound Hacker News stories and comments with validated content type, engagement metrics, publication identity, and provider search acknowledgement.',
  },
  'seasonal-outlook': {
    icon: 'SZN',
    eyebrow: 'Live response · Seasonal outlook',
    title: 'Seasonal weather outlook',
    description: 'Weekly ECMWF temperature and precipitation means with model-climatology anomalies and explicit forecast uncertainty context.',
  },
  'vehicle-safety-rating': {
    icon: 'NCAP',
    eyebrow: 'Live response · Vehicle safety',
    title: 'NHTSA safety ratings',
    description: 'VehicleId-bound NCAP crash, rollover, complaint, recall, investigation, and driver-assistance facts.',
  },
  'singapore-cpi': {
    icon: 'SG',
    eyebrow: 'Live response · Singapore CPI',
    title: 'Singapore consumer prices',
    description: 'Official monthly seasonally adjusted All Items CPI with 2024 as the base year and provider update evidence.',
  },
  'scholarly-graph': {
    icon: 'OA',
    eyebrow: 'Live response · Research graph',
    title: 'OpenAlex works',
    description: 'Provider-owned work IDs, titles, authorship, citation counts, DOI identity, publication years, and open-access status.',
  },
  'leading-indicator': {
    icon: 'CLI',
    eyebrow: 'Live response · Leading indicator',
    title: 'OECD Composite Leading Indicator',
    description: 'Harmonised monthly CLI observations for qualitative business-cycle turning-point signals.',
  },
  'project-search': {
    icon: 'GL',
    eyebrow: 'Live response · Project search',
    title: 'GitLab public projects',
    description: 'Request-bound public project search with trustworthy project identity, popularity metrics, activity, and topics.',
  },
  'community-questions': {
    icon: 'SE',
    eyebrow: 'Live response · Community questions',
    title: 'Stack Overflow questions',
    description: 'Request-bound tagged questions with trustworthy question identity, activity, engagement metrics, quota, and provider backoff evidence.',
  },
  'package-insights': {
    icon: 'PKG',
    eyebrow: 'Live response · Package insights',
    title: 'deps.dev package profile',
    description: 'Request-bound package identity, default release, publication timing, and deprecation metadata from deps.dev GetPackage.',
  },
  'npm-package-search': {
    icon: 'npm',
    eyebrow: 'Live response · npm search',
    title: 'npm package search',
    description: 'Request-bound npm registry search results with validated package identity, download metrics, and search metadata.',
  },
  'composer-package-search': {
    icon: 'PKG',
    eyebrow: 'Live response · Composer search',
    title: 'Packagist package search',
    description: 'Request-bound Composer package search results with validated Packagist identity, download metrics, and pagination metadata.',
  },
  'cpan-module-search': {
    icon: 'CPAN',
    eyebrow: 'Live response · CPAN module',
    title: 'MetaCPAN module lookup',
    description: 'Exact module-name search bound to latest indexed CPAN release identity, version, distribution, author, and provider completeness.',
  },
  'package-registration': {
    icon: '.NET',
    eyebrow: 'Live response · Package registration',
    title: 'NuGet package registration',
    description: 'NuGet SemVer 2 registration-page ranges and validated inline package metadata with explicit request identity and pagination completeness.',
  },
  'package-release': {
    icon: 'GEM',
    eyebrow: 'Live response · Package release',
    title: 'Ruby gem release',
    description: 'Request-bound RubyGems package identity, release version, download counters, authorship, platform, and licence metadata with explicit semantic validity.',
  },
  'python-package': {
    icon: 'PY',
    eyebrow: 'Live response · Python package',
    title: 'PyPI project profile',
    description: 'Request-bound PyPI project identity and current package metadata using the official normalized-name comparison contract.',
  },
  'dart-package': {
    icon: 'DART',
    eyebrow: 'Live response · Dart package',
    title: 'pub.dev package profile',
    description: 'Request-bound Hosted Pub package identity, latest release, SDK context, and validated version history.',
  },
  'hex-package': {
    icon: 'HXP',
    eyebrow: 'Live response · Hex package',
    title: 'Hex package profile',
    description: 'Request-bound Hex.pm package identity, release versions, download counters, licensing, and ownership with explicit semantic validity.',
  },
  'cve-record': {
    icon: 'CVE',
    eyebrow: 'Live response · CVE 5 record',
    title: 'CIRCL vulnerability record',
    description: 'Request-bound CVE identity, publication state, CNA description, affected products, and provider dates from a validated CVE 5 envelope.',
  },
  'cpe-product-search': {
    icon: 'CPE',
    eyebrow: 'Live response · NVD CPE products',
    title: 'NVD CPE product search',
    description: 'Request-bound CPE 2.3 product identities with strict NVD API 2.0 envelope, pagination, deprecation, and keyword evidence.',
  },
  'nvd-vulnerability': {
    icon: 'NVD',
    eyebrow: 'Live response · NVD CVE record',
    title: 'NVD vulnerability dossier',
    description: 'Request-bound CVE identity, strict NVD API 2.0 envelope evidence, sourced CVSS assessment, provider dates, references, and affected-product context.',
  },
  'nvd-cve-search': {
    icon: 'NVD',
    eyebrow: 'Live response · NVD CVE search',
    title: 'NVD CVE keyword search',
    description: 'Request-bound current-description keyword matches with strict NVD API 2.0 envelope, pagination, identity, and filter evidence.',
  },
  'nvd-modified-watchlist': {
    icon: 'NVD',
    eyebrow: 'Live response · NVD modified watchlist',
    title: 'Recently modified CVEs',
    description: 'Request-bound last-modified-window CVE records with strict NVD API 2.0 envelope and timestamp evidence.',
  },
  'vulnerability-record': {
    icon: 'OSV',
    eyebrow: 'Live response · OSV record',
    title: 'Open-source vulnerability record',
    description: 'Request-bound vulnerability identity, affected packages, aliases, lifecycle timestamps, and schema evidence from OSV.dev.',
  },
  'global-security-advisories': {
    icon: 'GH',
    eyebrow: 'Live response · GitHub advisories',
    title: 'GitHub reviewed advisories',
    description: 'Request-bound global security advisories with exact ecosystem and severity filter evidence.',
  },
  'security-center': {
    icon: '◇',
    eyebrow: 'Live response · Security layout',
    title: 'Security advisory center',
    description: 'Vulnerability and product records organized by severity, identifiers, and review dates.',
  },
  'research-library': {
    icon: '▤',
    eyebrow: 'Live response · Research layout',
    title: 'Research library',
    description: 'Books, papers, and clinical studies presented with authorship, status, and identifiers.',
  },
  'poetry-reading-room': {
    icon: '¶',
    eyebrow: 'Live response · Poetry reading room',
    title: 'PoetryDB reading room',
    description: 'Request-bound public-domain poems with selected-author identity, bounded count, lines, and line-count evidence.',
  },
  'book-search': {
    icon: 'OL',
    eyebrow: 'Live response · Book search',
    title: 'Open Library books',
    description: 'Request-bound Open Library work records with provider-owned work IDs, authorship, publication year, and count evidence.',
  },
  'dblp-publications': {
    icon: 'DBL',
    eyebrow: 'Live response · DBLP publication layout',
    title: 'DBLP publications',
    description: 'Request-bound DBLP publication records with grouped authors, bibliographic fields, and provider-owned record URLs.',
  },
  'organization-directory': {
    icon: 'ROR',
    eyebrow: 'Live response · Organization directory',
    title: 'Research organizations',
    description: 'Request-bound ROR organization candidates with provider-owned IDs and names for interactive human choice.',
  },
  'dictionary-entry': {
    icon: 'Aa',
    eyebrow: 'Live response · Language layout',
    title: 'Dictionary entry',
    description: 'Definitions, parts of speech, examples, and synonyms mapped from the word response.',
  },
  'drug-label': {
    icon: 'Rx',
    eyebrow: 'Live response · Drug label layout',
    title: 'Drug label summary',
    description: 'Product identity and regulated label sections mapped from the returned openFDA record.',
  },
  'food-recalls': {
    icon: 'FDA',
    eyebrow: 'Live response · Recall layout',
    title: 'Food recall enforcement report',
    description: 'Recall identity, classification, status, affected product, firm, dates, reason, and distribution mapped from FDA enforcement records.',
  },
  'prayer-schedule': {
    icon: '◷',
    eyebrow: 'Live response · Prayer schedule',
    title: 'Daily prayer times',
    description: 'Prayer times, Gregorian/Hijri date context, timezone, coordinates, and calculation method mapped from the AlAdhan response.',
  },
  'drug-terminology': {
    icon: 'Rx',
    eyebrow: 'Live response · Drug terminology',
    title: 'RxNorm drug concepts',
    description: 'Clinical and branded drug concepts grouped by RxNorm term type with stable RxCUI identifiers.',
  },
  'coastal-water-level': {
    icon: '≈',
    eyebrow: 'Live response · Coastal observation',
    title: 'Coastal water level',
    description: 'Station identity, observed height, datum, timing, and NOAA quality-control evidence from the latest CO-OPS water-level response.',
  },
  'protein-annotation': {
    icon: 'P',
    eyebrow: 'Live response · Protein annotation',
    title: 'Protein annotation',
    description: 'Stable UniProtKB identity, organism, gene, sequence facts, and bounded provider function annotation.',
  },
  'molecular-structure': {
    icon: '3D',
    eyebrow: 'Live response · Molecular structure',
    title: 'Molecular structure record',
    description: 'PDB entry identity, experimental method, resolution, archive facts, entity counts, and primary publication metadata.',
  },
  'molecule-profile': {
    icon: '◇',
    eyebrow: 'Live response · Molecule profile',
    title: 'ChEMBL molecule profile',
    description: 'Molecule identity, provider chemical properties, development metadata, structure identifiers, and classifications.',
  },
  'compound-properties': {
    icon: '◇',
    eyebrow: 'Live response · Compound properties',
    title: 'PubChem compound properties',
    description: 'Stable PubChem compound identity with the requested molecular formula, molecular weight, and IUPAC name.',
  },
  'gene-locus': {
    icon: 'DNA',
    eyebrow: 'Live response · Gene locus',
    title: 'Ensembl gene locus',
    description: 'Stable gene identity, species, assembly coordinates, strand, biotype, canonical transcript, and provider description.',
  },
  'domain-registration': {
    icon: '◎',
    eyebrow: 'Live response · Registration layout',
    title: 'Domain registration',
    description: 'Registrar identity, lifecycle dates, nameservers, registry handle, and complete RDAP status.',
  },
  'legal-entity': {
    icon: 'LEI',
    eyebrow: 'Live response · Entity layout',
    title: 'Legal entity profile',
    description: 'Official LEI identity, headquarters, registration state, mapped identifiers, and available corporate relationship links.',
  },
  'bank-institution': {
    icon: '$',
    eyebrow: 'Live response · Banking layout',
    title: 'FDIC institution profile',
    description: 'Institution identity, operating status, headquarters, reported assets/deposits, offices, and regulator metadata.',
  },
  'route-summary': {
    icon: '↝',
    eyebrow: 'Live response · Route layout',
    title: 'Route summary',
    description: 'Provider route distance, estimated travel time, snapped endpoints, geometry size, and turn-by-turn steps.',
  },
  'transaction-fees': {
    icon: '₿',
    eyebrow: 'Live response · Fee layout',
    title: 'Bitcoin fee recommendations',
    description: 'Provider-recommended sat/vB rates for fastest, half-hour, hour, economy, and minimum transaction targets.',
  },
  'availability-board': {
    icon: 'P',
    eyebrow: 'Live response · Availability layout',
    title: 'Availability board',
    description: 'Capacity, availability, occupancy, and record coverage mapped into an operational status board.',
  },
  'collection-index': {
    icon: '▦',
    eyebrow: 'Live response · Collection index',
    title: 'Collection index',
    description: 'Collection match counts and provider object identifiers exposed as a semantic search index.',
  },
  'manufacturer-directory': {
    icon: 'M',
    eyebrow: 'Live response · Directory layout',
    title: 'Manufacturer directory',
    description: 'Manufacturer identities and registry identifiers presented as a semantic directory.',
  },
  'taxonomy-directory': {
    icon: 'T',
    eyebrow: 'Live response · Taxonomy layout',
    title: 'Taxonomy directory',
    description: 'Scientific names, ranks, status, lineage, and taxonomy identifiers presented as domain records.',
  },
  'motorsport-results': {
    icon: 'F1',
    eyebrow: 'Live response · Motorsport layout',
    title: 'Motorsport results',
    description: 'Race-session, qualifying, standings, driver, constructor, and timing facts mapped into competition results.',
  },
  'quote-card': {
    icon: '“',
    eyebrow: 'Live response · Quote layout',
    title: 'Quote card',
    description: 'Quoted text, speaker identity, and source work presented as a readable semantic quotation.',
  },
  'character-dossier': {
    icon: '✦',
    eyebrow: 'Live response · Character layout',
    title: 'Character dossier',
    description: 'Character identity, physical attributes, appearances, and relationship facts presented as semantic profiles.',
  },
  'parliament-members': {
    icon: 'UK',
    eyebrow: 'Live response · Parliament members',
    title: 'Current Parliament members',
    description: 'Current Commons and Lords member identity, party affiliation, latest-house membership, and provider pagination context.',
  },
  'ai-model-catalog': {
    icon: 'AI',
    eyebrow: 'Live response · Model catalogue',
    title: 'Hugging Face model metadata',
    description: 'Model identity, task/library, access state, provider license tags, popularity, and update metadata from Hub search.',
  },
  'open-data-catalog': {
    icon: 'CA',
    eyebrow: 'Live response · Open-data catalogue',
    title: 'Canada open-government records',
    description: 'Dataset and publication catalogue identity, publisher, licence, dates, restrictions, bilingual metadata, and resource formats.',
  },
  'icon-catalog': {
    icon: '◈',
    eyebrow: 'Live response · Icon catalogue',
    title: 'Icon identifiers and licence context',
    description: 'Iconify identifiers joined to their returned icon-set author, licence, and search-page metadata.',
  },
  'homebrew-package': {
    icon: 'B',
    eyebrow: 'Live response · Package metadata',
    title: 'Homebrew package metadata',
    description: 'Formula and cask identity with version, dependencies or app artifacts, licence, and platform metadata kept semantically distinct.',
  },
  'monster-statblock': {
    icon: 'CR',
    eyebrow: 'Live response · Creature stat cards',
    title: 'Open5e creature search',
    description: 'Source-aware V2 creature identity, challenge rating, defence, health, movement, perception, and game-system context.',
  },
  'lexical-matches': {
    icon: 'Aa',
    eyebrow: 'Live response · Lexical matches',
    title: 'Pronunciation-aware word matches',
    description: 'Datamuse sounds-like results mapped into ranked words with pronunciation, part-of-speech, syllable, and provider-ordering context.',
  },
  'symbolic-math': {
    icon: '∑',
    eyebrow: 'Live response · Symbolic math',
    title: 'Symbolic operation result',
    description: 'The provider-returned operation, input expression, and symbolic result kept explicit for verification and reuse.',
  },
  'public-ip': {
    icon: 'IP',
    eyebrow: 'Live response · Network identity',
    title: 'Public IP address',
    description: 'The provider-observed IPv4 or IPv6 address with explicit network-identity semantics and no implied geolocation.',
  },
  'cat-fact': {
    icon: 'CAT',
    eyebrow: 'Live response · Cat fact',
    title: 'Random cat fact',
    description: 'Provider-returned cat trivia presented as readable semantic content with its reported length.',
  },
  'fuel-dashboard': {
    icon: '⛽',
    eyebrow: 'Live response · Fuel market layout',
    title: 'Malaysia fuel board',
    description: 'Official weekly pump prices, subsidy tiers, changes, and price history in a retail-market dashboard.',
  },
  'marine-forecast': {
    icon: '≈',
    eyebrow: 'Live response · Marine layout',
    title: 'Marine forecast',
    description: 'Wave, current, bearing, period, and sea-temperature series presented as a coastal conditions cockpit.',
  },
  'awards-timeline': {
    icon: 'N',
    eyebrow: 'Live response · Awards layout',
    title: 'Nobel Prize timeline',
    description: 'Prize years, categories, laureates, discoveries, and award values arranged chronologically.',
  },
  'chess-ratings': {
    icon: '♞',
    eyebrow: 'Live response · Chess layout',
    title: 'Player ratings',
    description: 'Public ratings, game counts, rating deviation, and provider-reported progress compared across chess modes.',
  },
  'scholarly-search': {
    icon: 'DOI',
    eyebrow: 'Live response · Scholarly layout',
    title: 'Scholarly works',
    description: 'DOI metadata organized by title, authorship, publication year, publisher, type, and citation count.',
  },
  'result-list': {
    icon: '✦',
    eyebrow: 'Live response · Results layout',
    title: 'Result explorer',
    description: 'A structured result browser adapted to this API response.',
  },
}

const weatherPreviewMeta: Record<WeatherPreviewVariant, { icon: string; eyebrow: string; title: string; description: string }> = {
  current: previewMeta['weather-dashboard'],
  'four-day': {
    icon: '☂',
    eyebrow: 'Live response · Daily forecast',
    title: '4-day outlook',
    description: 'Daily conditions, temperature ranges, humidity, and wind values mapped directly from the forecast response.',
  },
  'twenty-four-hour': {
    icon: '◒',
    eyebrow: 'Live response · Regional forecast',
    title: '24-hour forecast',
    description: 'A full-day outlook with general conditions and time-based forecasts for every Singapore region.',
  },
  'area-forecast': {
    icon: '⌖',
    eyebrow: 'Live response · Neighbourhood forecast',
    title: '2-hour area forecast',
    description: 'Short-range conditions grouped by named Singapore neighbourhoods.',
  },
  'station-readings': {
    icon: '◉',
    eyebrow: 'Live response · Sensor network',
    title: 'Station readings',
    description: 'Live measurements joined with station names, units, coordinates, and network statistics.',
  },
  'regional-air-quality': {
    icon: '≋',
    eyebrow: 'Live response · Air quality',
    title: 'Regional air quality',
    description: 'PSI and particulate readings compared across Singapore’s five reporting regions.',
  },
  'air-quality-forecast': {
    icon: '≋',
    eyebrow: 'Live response · Air quality',
    title: 'Current air quality',
    description: 'Current AQI and pollutant concentrations mapped directly from the selected coordinates.',
  },
  'uv-index': {
    icon: '☀',
    eyebrow: 'Live response · UV monitoring',
    title: 'UV index',
    description: 'The latest ultraviolet exposure level and its reporting timeline.',
  },
}

export function ResponseDemoPreview({ api, data, requestUrl, executedRequest, responseMedia, runtime, locale = 'en' }: { api: ApiDemo; data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext; responseMedia?: ResponseMediaContext; runtime?: SsotRuntimeMeta; locale?: UiLocale }) {
  const t = (key: UiMessageKey, values?: Record<string, string | number>) => uiText(locale, key, values)
  const ssotDefinition = apiSsotCardRegistry[api.id]
  const layout = ssotDefinition?.layout ?? selectPreviewLayout(api)
  const weatherVariant = layout === 'weather-dashboard' ? selectWeatherPreviewVariant(api) : undefined
  const profileLabel = ssotDefinition?.label ?? getPreviewProfile(api.id)?.label ?? previewMeta[layout].eyebrow
  const layoutMeta = weatherVariant ? weatherPreviewMeta[weatherVariant] : previewMeta[layout]
  const PreviewComponent = ssotDefinition?.Component ?? apiPreviewComponents[api.id]
  const content: ReactNode = PreviewComponent ? <PreviewComponent api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest} responseMedia={responseMedia}/> : <ResultListPreview data={data} api={api}/>

  const headingId = `demo-preview-${api.id}`
  const formattedSize = runtime ? formatResponseBytes(runtime.size) : undefined
  return (
    <section className={`demo-preview preview-${layout}`} aria-labelledby={headingId} data-webmcp-surface="api-demo-preview" data-ssot-card={api.id} data-ssot-design="result-card-v2" data-ssot-source="live-response" data-ssot-adapter={PreviewComponent ? componentName(api.id) : 'generic-fallback'} data-ssot-fallback={PreviewComponent ? 'false' : 'true'} data-preview-layout={layout} data-preview-variant={weatherVariant} data-preview-component={PreviewComponent ? api.id : 'generic-fallback'} data-api-id={api.id} data-provider={api.provider} data-category={api.category} style={{ '--preview-accent': api.accent } as CSSProperties}>
      <span className="sr-only" role="status">
        {t('request.responseReceived', { name: api.name })}
      </span>
      <div className="demo-preview-head">
        <span className="demo-preview-monogram" aria-hidden="true">
          {api.monogram}
        </span>
        <div className="demo-preview-copy">
          <div className="demo-preview-kicker">
            <span className="live-response-badge">
              <i aria-hidden="true"/>
              {t('request.liveResponse')}
            </span>
            <span className="preview-profile-badge" lang="en">
              <i aria-hidden="true">{layoutMeta.icon}</i>
              {profileLabel}
            </span>
          </div>
          <h2 id={headingId} lang="en">
            {api.name}
          </h2>
          <p lang="en">{api.description}</p>
          <div className="demo-preview-context" aria-label={t('request.apiContext')}>
            <span>
              {t('request.provider')} · <span lang="en">{api.provider}</span>
            </span>
            <span>
              {t('request.category')} · <span lang="en">{api.category}</span>
            </span>
          </div>
        </div>
        <div className="ssot-runtime" aria-label={t('request.liveMetadata')}>
          {runtime ? (
            <>
              <b
                aria-label={t('request.httpStatus', {
                  status: runtime.httpStatus,
                })}
              >
                {runtime.httpStatus} OK
              </b>
              <span
                aria-label={t('request.responseTime', {
                  elapsed: runtime.elapsed,
                })}
              >
                {runtime.elapsed} ms
              </span>
              <span
                aria-label={t('request.responseSize', {
                  size: formattedSize ?? '',
                })}
              >
                {formattedSize}
              </span>
            </>
          ) : (
            <span>{t('request.previewReady')}</span>
          )}
        </div>
      </div>
      {content}
    </section>
  )
}

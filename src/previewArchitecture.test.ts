import { describe, expect, it } from 'vitest'
import responsePreviewSource from './responsePreview.tsx?raw'
import previewProfilesSource from './previewProfiles.ts?raw'
import previewBundlesSource from './previews/previewBundles.tsx?raw'
import appSource from './App.tsx?raw'
import previewLoadBoundarySource from './PreviewLoadBoundary.tsx?raw'
import diagnosticBundleSource from './previews/DiagnosticPreviewBundle.ts?raw'
import semanticBundleSource from './previews/SemanticPreviewBundle.ts?raw'
import scienceSemanticBundleSource from './previews/ScienceSemanticPreviewBundle.ts?raw'
import sportsSemanticBundleSource from './previews/SportsSemanticPreviewBundle.ts?raw'
import operationalBundleSource from './previews/OperationalPreviews.tsx?raw'
import catalogFamilyBundleSource from './previews/CatalogFamilyPreviews.tsx?raw'
import trafficCameraBundleSource from './previews/TrafficCameraPreviewBundle.ts?raw'
import specializedCatalogBundleSource from './previews/SpecializedCatalogPreviews.tsx?raw'
import developerSemanticBundleSource from './previews/DeveloperSemanticPreviewBundle.ts?raw'
import packageSemanticBundleSource from './previews/PackageSemanticPreviewBundle.ts?raw'
import appStylesSource from './styles.css?raw'
import weatherBundleSource from './previews/WeatherPreviews.tsx?raw'
import marketBundleSource from './previews/MarketPreviews.tsx?raw'
import dateListSource from './previews/DateList.tsx?raw'
import semanticCardsSource from './previews/SemanticCards.tsx?raw'
import floodStationSource from './previews/FloodStationPreview.tsx?raw'


describe('response preview architecture', () => {
  it('keeps API-specific implementations behind on-demand preview bundles', () => {
    const previewFunctions = [...responsePreviewSource.matchAll(/(?:export\s+)?function\s+([A-Z][A-Za-z0-9]*Preview)\s*\(/g)]
      .map((match) => match[1])

    expect(previewFunctions).toEqual(['ResponseDemoPreview'])
    expect(responsePreviewSource).toContain("from './previews/previewBundles'")
    expect(responsePreviewSource).not.toMatch(/from '\.\/previews\/(?:CatalogFamilyPreviews|TrafficCameraPreviewBundle|SpecializedCatalogPreviews|WeatherPreviews|OperationalPreviews|MarketPreviews|SemanticPreviewBundle|ScienceSemanticPreviewBundle|SportsSemanticPreviewBundle|DiagnosticPreviewBundle)'/)
    for (const bundle of ['CatalogFamilyPreviews', 'TrafficCameraPreviewBundle', 'SpecializedCatalogPreviews', 'DeveloperSemanticPreviewBundle', 'PackageSemanticPreviewBundle', 'WeatherPreviews', 'OperationalPreviews', 'MarketPreviews', 'SemanticPreviewBundle', 'ScienceSemanticPreviewBundle', 'SportsSemanticPreviewBundle', 'DiagnosticPreviewBundle']) {
      expect(previewBundlesSource).toContain(`import('./${bundle}')`)
    }
    expect(previewBundlesSource).toContain("import { createElement, lazy, type ComponentType } from 'react'")
    expect(previewBundlesSource).toMatch(/const LazyPreview = lazy\(/)
    expect(previewBundlesSource).not.toContain('throw loadPreviewBundle(bundle)')
    expect(previewBundlesSource).toContain('resolvedBundles.get(bundle)')
    expect(previewBundlesSource).toContain('pendingBundles.delete(bundle)')
    expect(appSource).toContain('<PreviewLoadBoundary resetKey=')
    expect(appSource).toContain('<LazyResponseDemoPreview')
    expect(previewLoadBoundarySource).toContain('Semantic preview unavailable')
    expect(previewLoadBoundarySource).toContain('Reload application')
    expect(previewLoadBoundarySource).toContain('data-preview-load-state="error"')
  })

  it('keeps the retired generic developer feed out of the preview SSOT', () => {
    const developerFeedIds = [...previewProfilesSource.matchAll(/\['([^']+)',\s*'developer-feed',/g)].map((match) => match[1])
    expect(developerFeedIds).toEqual([])
    expect(previewProfilesSource).not.toContain("| 'developer-feed'")
    expect(responsePreviewSource).not.toContain('DeveloperFeedPreview')
    expect(catalogFamilyBundleSource).not.toContain('DeveloperFeedPreview')
  })

  it('retires the generic market snapshot and keeps all World Bank indicator routes on one strict request-bound path', () => {
    expect(marketBundleSource).toContain("export { WorldBankIndicatorPreview } from './WorldBankIndicatorPreview'")
    expect(marketBundleSource).not.toContain('function MarketPreview')
    expect(responsePreviewSource).not.toContain("marketPreview('MarketPreview')")
    expect(responsePreviewSource).toContain("'world-bank-gdp': defineApiPreview('world-bank-gdp', ({ api, data, executedRequest }) => <WorldBankIndicatorPreview api={api} data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).toContain("'world-bank-population': defineApiPreview('world-bank-population', ({ api, data, executedRequest }) => <WorldBankIndicatorPreview api={api} data={data} executedRequest={executedRequest}/>)")
    expect(previewProfilesSource).toContain("['world-bank-gdp', 'indicator-series'")
    expect(previewProfilesSource).toContain("['world-bank-population', 'indicator-series'")
  })
  it('keeps Data USA on one dedicated request-bound state-population preview path', () => {
    expect(marketBundleSource).toContain("export { DataUsaPopulationPreview } from './DataUsaPopulationPreview'")
    expect(responsePreviewSource).toContain('<DataUsaPopulationPreview data={data} executedRequest={executedRequest}/>')
    expect(responsePreviewSource).not.toContain("'data-usa': defineApiPreview('data-usa', ({ api, data }) => <MarketPreview")
    expect(previewProfilesSource).toContain("['data-usa', 'state-population'")
  })

  it('keeps USGS earthquakes on one dedicated request-bound GeoJSON preview path', () => {
    expect(catalogFamilyBundleSource).toContain("export { UsgsEarthquakePreview } from './UsgsEarthquakePreview'")
    expect(catalogFamilyBundleSource).not.toContain("api?.id === 'usgs'")
    expect(responsePreviewSource).toContain('<UsgsEarthquakePreview data={data} executedRequest={executedRequest}/>')
    expect(responsePreviewSource).not.toContain("usgs: defineApiPreview('usgs', ({ api, data }) => <LocationPreview")
    expect(previewProfilesSource).toContain("['usgs', 'location-map', 'Earthquake activity map']")
  })

  it('keeps data.gov.sg taxi availability on one dedicated request-bound GeoJSON path', () => {
    expect(catalogFamilyBundleSource).toContain("export { DataGovTaxiAvailabilityPreview } from './DataGovTaxiAvailabilityPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api?.id === 'data-gov-taxi'")
    expect(responsePreviewSource).toContain('<DataGovTaxiAvailabilityPreview data={data} executedRequest={executedRequest}/>')
    expect(responsePreviewSource).not.toContain("'data-gov-taxi': defineApiPreview('data-gov-taxi', ({ api, data }) => <LocationPreview")
    expect(previewProfilesSource).toContain("['data-gov-taxi', 'taxi-availability', 'Live taxi availability map and acquisition snapshot']")
  })

  it('keeps data.gov.sg traffic images on one dedicated request-bound camera snapshot path', () => {
    expect(trafficCameraBundleSource).toContain("export { DataGovTrafficImagesPreview } from './DataGovTrafficImagesPreview'")
    expect(catalogFamilyBundleSource).not.toContain("export { DataGovTrafficImagesPreview } from './DataGovTrafficImagesPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'data-gov-traffic-images'")
    expect(responsePreviewSource).toContain("deferredPreview('traffic-camera', 'DataGovTrafficImagesPreview')")
    expect(responsePreviewSource).toContain('<DataGovTrafficImagesPreview data={data} executedRequest={executedRequest}/>')
    expect(responsePreviewSource).not.toContain("'data-gov-traffic-images': defineApiPreview('data-gov-traffic-images', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['data-gov-traffic-images', 'traffic-camera-snapshot', 'Request-bound LTA traffic camera snapshot']")
  })

  it('keeps Open Brewery DB on one dedicated request-bound brewery-directory path', () => {
    expect(catalogFamilyBundleSource).toContain("export { OpenBreweryDirectoryPreview } from './OpenBreweryDirectoryPreview'")
    expect(catalogFamilyBundleSource).not.toContain('export function LocationPreview')
    expect(responsePreviewSource).not.toContain("familyPreview('LocationPreview')")
    expect(responsePreviewSource).toContain("'open-brewery-directory': defineApiPreview('open-brewery-directory', ({ api, data, requestUrl, executedRequest }) => <OpenBreweryDirectoryPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'open-brewery-directory': defineApiPreview('open-brewery-directory', ({ api, data }) => <LocationPreview")
    expect(previewProfilesSource).toContain("['open-brewery-directory', 'brewery-directory'")
  })

  it('keeps Zippopotam.us on one dedicated request-bound postcode-geolocation path', () => {
    expect(catalogFamilyBundleSource).toContain("export { ZippopotamPostcodePreview } from './ZippopotamPostcodePreview'")
    expect(responsePreviewSource).toContain("'zippopotam-postcode': defineApiPreview('zippopotam-postcode', ({ api, data, requestUrl, executedRequest }) => <ZippopotamPostcodePreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'zippopotam-postcode': defineApiPreview('zippopotam-postcode', ({ api, data }) => <LocationPreview")
    expect(catalogFamilyBundleSource).not.toContain("api?.id === 'zippopotam-postcode'")
    expect(previewProfilesSource).toContain("['zippopotam-postcode', 'postcode-geolocation'")
  })

  it('keeps Where The ISS At on one dedicated request-bound orbital-position path', () => {
    expect(semanticBundleSource).toContain("export { IssPositionPreview } from './IssPositionPreview'")
    expect(responsePreviewSource).toContain("'where-the-iss-at': defineApiPreview('where-the-iss-at', ({ data, executedRequest }) => <IssPositionPreview data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'where-the-iss-at': defineApiPreview('where-the-iss-at', ({ api, data }) => <LocationPreview")
    expect(previewProfilesSource).toContain("['where-the-iss-at', 'iss-position', 'Request-bound ISS orbital position and motion snapshot']")
  })

  it('keeps Openverse on one dedicated request-bound licensed-media path', () => {
    expect(catalogFamilyBundleSource).toContain("export { OpenverseSearchPreview } from './OpenverseSearchPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'openverse-search'")
    expect(responsePreviewSource).toContain("'openverse-search': defineApiPreview('openverse-search', ({ data, requestUrl, executedRequest }) => <OpenverseSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'openverse-search': defineApiPreview('openverse-search', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['openverse-search', 'licensed-media-search'")
  })

  it('keeps Scryfall on one dedicated request-bound trading-card path', () => {
    expect(catalogFamilyBundleSource).toContain("export { ScryfallCardSearchPreview } from './ScryfallCardSearchPreview'")
    expect(responsePreviewSource).toContain("const ScryfallCardSearchPreview = familyPreview('ScryfallCardSearchPreview')")
    expect(responsePreviewSource).toContain("'scryfall-card-search': defineApiPreview('scryfall-card-search', ({ data, requestUrl, executedRequest }) => <ScryfallCardSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'scryfall-card-search': defineApiPreview('scryfall-card-search', ({ api, data }) => <MediaGalleryPreview")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'scryfall-card-search'")
    expect(previewProfilesSource).toContain("['scryfall-card-search', 'trading-card-search', 'Request-bound Magic: The Gathering card search']")
    expect(responsePreviewSource).toContain("'trading-card-search': { icon: 'TCG'")
  })

  it('keeps Internet Archive on one dedicated exact-request-bound archive path', () => {
    expect(catalogFamilyBundleSource).toContain("export { InternetArchiveSearchPreview } from './InternetArchiveSearchPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'internet-archive-search'")
    expect(responsePreviewSource).toContain("'internet-archive-search': defineApiPreview('internet-archive-search', ({ data, executedRequest }) => <InternetArchiveSearchPreview data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'internet-archive-search': defineApiPreview('internet-archive-search', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['internet-archive-search', 'archive-search', 'Request-bound Internet Archive search with rights evidence']")
  })

  it('keeps NASA media search on one dedicated request-bound asset-identity path', () => {
    expect(catalogFamilyBundleSource).toContain("export { NasaImageSearchPreview } from './NasaImageSearchPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'nasa-image-search'")
    expect(responsePreviewSource).toContain("'nasa-image-search': defineApiPreview('nasa-image-search', ({ data, requestUrl, executedRequest }) => <NasaImageSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'nasa-image-search': defineApiPreview('nasa-image-search', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['nasa-image-search', 'nasa-media-library'")
  })

  it('keeps Wikimedia Commons on one dedicated request-bound licensed-media path', () => {
    expect(catalogFamilyBundleSource).toContain("export { WikimediaCommonsSearchPreview } from './WikimediaCommonsSearchPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'wikimedia-commons-search'")
    expect(responsePreviewSource).toContain("'wikimedia-commons-search': defineApiPreview('wikimedia-commons-search', ({ data, requestUrl, executedRequest }) => <WikimediaCommonsSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'wikimedia-commons-search': defineApiPreview('wikimedia-commons-search', ({ api, data }) => <MediaGalleryPreview")
  })

  it('keeps Wikipedia on one dedicated request-bound encyclopedia path', () => {
    expect(catalogFamilyBundleSource).toContain("export { WikipediaSearchPreview } from './WikipediaSearchPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'wikipedia-search'")
    expect(responsePreviewSource).toContain("'wikipedia-search': defineApiPreview('wikipedia-search', ({ data, requestUrl, executedRequest }) => <WikipediaSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'wikipedia-search': defineApiPreview('wikipedia-search', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['wikipedia-search', 'encyclopedia-search'")
  })

  it('keeps iNaturalist observations on one dedicated request-bound biodiversity path', () => {
    expect(catalogFamilyBundleSource).toContain("export { INaturalistObservationsPreview } from './INaturalistObservationsPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'inaturalist-observations'")
    expect(responsePreviewSource).toContain("'inaturalist-observations': defineApiPreview('inaturalist-observations', ({ data, requestUrl, executedRequest }) => <INaturalistObservationsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'inaturalist-observations': defineApiPreview('inaturalist-observations', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['inaturalist-observations', 'species-observations'")
  })

  it('keeps V&A Collections on one dedicated request-bound object-collection path', () => {
    expect(catalogFamilyBundleSource).toContain("export { VamCollectionsPreview } from './VamCollectionsPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'vam-collections'")
    expect(responsePreviewSource).toContain("'vam-collections': defineApiPreview('vam-collections', ({ data, requestUrl, executedRequest }) => <VamCollectionsPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'vam-collections': defineApiPreview('vam-collections', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['vam-collections', 'collection-index'")
  })

  it('keeps Art Institute search on one dedicated request-bound public-domain artwork path', () => {
    expect(catalogFamilyBundleSource).toContain("export { ArtInstituteSearchPreview } from './ArtInstituteSearchPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'art-institute-search'")
    expect(responsePreviewSource).toContain("'art-institute-search': defineApiPreview('art-institute-search', ({ data, requestUrl, executedRequest }) => <ArtInstituteSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'art-institute-search': defineApiPreview('art-institute-search', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['art-institute-search', 'public-domain-art-search'")
  })

  it('keeps the Met object detail on one dedicated request-bound Open Access path', () => {
    expect(specializedCatalogBundleSource).toContain("export { MetMuseumObjectPreview } from './MetMuseumObjectPreview'")
    expect(responsePreviewSource).toContain("const MetMuseumObjectPreview = specializedPreview('MetMuseumObjectPreview')")
    expect(responsePreviewSource).toContain("'met-museum-object-detail': defineApiPreview('met-museum-object-detail', ({ data, executedRequest }) => <MetMuseumObjectPreview data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'met-museum-object-detail': defineApiPreview('met-museum-object-detail', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['met-museum-object-detail', 'met-open-access-object'")
  })

  it('keeps Apple iTunes on one dedicated exact-request-bound rights-aware catalog path', () => {
    expect(catalogFamilyBundleSource).toContain("export { AppleItunesSearchPreview } from './AppleItunesSearchPreview'")
    expect(responsePreviewSource).toContain("'apple-itunes-search': defineApiPreview('apple-itunes-search', ({ data, executedRequest }) => <AppleItunesSearchPreview data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'apple-itunes-search': defineApiPreview('apple-itunes-search', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['apple-itunes-search', 'itunes-media-search'")
  })

  it('keeps Spaceflight News on one dedicated exact-request-bound article path', () => {
    expect(catalogFamilyBundleSource).toContain("export { SpaceflightNewsPreview } from './SpaceflightNewsPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'spaceflight-news'")
    expect(responsePreviewSource).toContain("const SpaceflightNewsPreview = familyPreview('SpaceflightNewsPreview')")
    expect(responsePreviewSource).toContain("'spaceflight-news': defineApiPreview('spaceflight-news', ({ data, executedRequest }) => <SpaceflightNewsPreview data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'spaceflight-news': defineApiPreview('spaceflight-news', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['spaceflight-news', 'spaceflight-news', 'Request-bound spaceflight publisher articles']")
    expect(responsePreviewSource).toContain("'spaceflight-news': { icon: 'SN'")
  })

  it('keeps PokéAPI on one dedicated exact-request-bound Pokémon profile path', () => {
    expect(catalogFamilyBundleSource).toContain("export { PokeApiPreview } from './PokeApiPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'pokeapi'")
    expect(responsePreviewSource).toContain("const PokeApiPreview = familyPreview('PokeApiPreview')")
    expect(responsePreviewSource).toContain("pokeapi: defineApiPreview('pokeapi', ({ data, requestUrl, executedRequest }) => <PokeApiPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("pokeapi: defineApiPreview('pokeapi', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['pokeapi', 'pokemon-profile'")
  })

  it('keeps TVmaze on one dedicated exact-request-bound show-search path', () => {
    expect(catalogFamilyBundleSource).toContain("export { TvmazeSearchPreview } from './TvmazeSearchPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'tvmaze-search'")
    expect(responsePreviewSource).toContain("const TvmazeSearchPreview = familyPreview('TvmazeSearchPreview')")
    expect(responsePreviewSource).toContain("'tvmaze-search': defineApiPreview('tvmaze-search', ({ data, requestUrl, executedRequest }) => <TvmazeSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'tvmaze-search': defineApiPreview('tvmaze-search', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['tvmaze-search', 'tv-show-search'")
  })

  it('keeps Rick and Morty on one dedicated exact-request-bound character-search path', () => {
    expect(catalogFamilyBundleSource).toContain("export { RickMortyCharactersPreview } from './RickMortyCharactersPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'rick-morty-characters'")
    expect(responsePreviewSource).toContain("const RickMortyCharactersPreview = familyPreview('RickMortyCharactersPreview')")
    expect(responsePreviewSource).toContain("'rick-morty-characters': defineApiPreview('rick-morty-characters', ({ data, requestUrl, executedRequest }) => <RickMortyCharactersPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'rick-morty-characters': defineApiPreview('rick-morty-characters', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['rick-morty-characters', 'character-search'")
  })

  it('keeps DummyJSON recipes on one dedicated request-bound semantic path', () => {
    expect(catalogFamilyBundleSource).toContain("export { DummyJsonRecipesPreview } from './DummyJsonRecipesPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'dummyjson-recipes'")
    expect(responsePreviewSource).toContain("const DummyJsonRecipesPreview = familyPreview('DummyJsonRecipesPreview')")
    expect(responsePreviewSource).toContain("'dummyjson-recipes': defineApiPreview('dummyjson-recipes', ({ data, executedRequest }) => <DummyJsonRecipesPreview data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'dummyjson-recipes': defineApiPreview('dummyjson-recipes', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['dummyjson-recipes', 'recipe-search', 'Request-bound synthetic recipe search']")
  })

  it('keeps Flathub on one dedicated exact-request-bound AppStream profile path', () => {
    expect(catalogFamilyBundleSource).toContain("export { FlathubAppstreamPreview } from './FlathubAppstreamPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'flathub-appstream'")
    expect(responsePreviewSource).toContain("const FlathubAppstreamPreview = familyPreview('FlathubAppstreamPreview')")
    expect(responsePreviewSource).toContain("'flathub-appstream': defineApiPreview('flathub-appstream', ({ data, executedRequest }) => <FlathubAppstreamPreview data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'flathub-appstream': defineApiPreview('flathub-appstream', ({ api, data }) => <MediaGalleryPreview")
    expect(previewProfilesSource).toContain("['flathub-appstream', 'appstream-profile'")
  })

  it('keeps GOV.UK Bank Holidays on one dedicated exact-request division-aware calendar path', () => {
    expect(catalogFamilyBundleSource).toContain("export { UkBankHolidaysPreview } from './UkBankHolidaysPreview'")
    expect(responsePreviewSource).toContain("const UkBankHolidaysPreview = familyPreview('UkBankHolidaysPreview')")
    expect(responsePreviewSource).toContain("'uk-bank-holidays': defineApiPreview('uk-bank-holidays', ({ data, executedRequest }) => <UkBankHolidaysPreview data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'uk-bank-holidays': defineApiPreview('uk-bank-holidays', ({ api, data }) => <CalendarPreview")
    expect(previewProfilesSource).toContain("['uk-bank-holidays', 'uk-bank-holiday-calendar', 'Request-bound GOV.UK division-aware bank holiday calendar']")
  })

  it('keeps Nager.Holidays on one dedicated Community API v4 calendar path', () => {
    expect(catalogFamilyBundleSource).toContain("export { NagerHolidaysPreview } from './NagerHolidaysPreview'")
    expect(responsePreviewSource).toContain("const NagerHolidaysPreview = familyPreview('NagerHolidaysPreview')")
    expect(responsePreviewSource).toContain("holidays: defineApiPreview('holidays', ({ data, executedRequest }) => <NagerHolidaysPreview data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("holidays: defineApiPreview('holidays', ({ api, data }) => <CalendarPreview")
    expect(previewProfilesSource).toContain("['holidays', 'public-holiday-calendar', 'Request-bound Nager.Holidays Community v4 calendar']")
  })

  it('keeps Hebcal on one dedicated exact-request Hebrew-year calendar path and retires generic CalendarPreview routing', () => {
    expect(catalogFamilyBundleSource).toContain("export { HebcalCalendarPreview } from './HebcalCalendarPreview'")
    expect(catalogFamilyBundleSource).not.toContain('export function CalendarPreview')
    expect(responsePreviewSource).toContain("const HebcalCalendarPreview = familyPreview('HebcalCalendarPreview')")
    expect(responsePreviewSource).toContain("'hebcal-calendar': defineApiPreview('hebcal-calendar', ({ data, executedRequest }) => <HebcalCalendarPreview data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("const CalendarPreview = familyPreview('CalendarPreview')")
    expect(responsePreviewSource).not.toContain("'hebcal-calendar': defineApiPreview('hebcal-calendar', ({ api, data }) => <CalendarPreview")
    expect(previewProfilesSource).toContain("['hebcal-calendar', 'jewish-calendar', 'Request-bound Hebcal Hebrew-year calendar']")
  })

  it('keeps Dog CEO on one dedicated exact-request-bound gallery path', () => {
    expect(catalogFamilyBundleSource).toContain("export { DogGalleryPreview } from './DogGalleryPreview'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'dogs'")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'randomfox-photo'")
    expect(responsePreviewSource).toContain("const DogGalleryPreview = familyPreview('DogGalleryPreview')")
    expect(responsePreviewSource).toContain("dogs: defineApiPreview('dogs', ({ data, executedRequest }) => <DogGalleryPreview data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("dogs: defineApiPreview('dogs', ({ api, data }) => <MediaGalleryPreview")
    expect(responsePreviewSource).not.toContain("'randomfox-photo': defineApiPreview")
    expect(previewProfilesSource).toContain("['dogs', 'dog-gallery', 'Exact-request Dog CEO image gallery']")
    expect(previewProfilesSource).not.toContain("['randomfox-photo'")
  })

  it('tracks the remaining active generic MediaGalleryPreview routes exactly', () => {
    const genericMediaGalleryIds = [...responsePreviewSource.matchAll(/defineApiPreview\('([^']+)',[^\n]*<MediaGalleryPreview/g)]
      .map((match) => match[1])
      .sort()
    expect(genericMediaGalleryIds).toEqual([])
  })

  it('retires stale generic media/calendar layout metadata once dedicated cards own those routes', () => {
    expect(previewProfilesSource).not.toContain("| 'media-gallery'")
    expect(previewProfilesSource).not.toContain("| 'calendar-timeline'")
    expect(previewProfilesSource).not.toContain("'media-gallery',")
    expect(previewProfilesSource).not.toContain("'calendar-timeline',")
    expect(responsePreviewSource).not.toContain("'media-gallery': {")
    expect(responsePreviewSource).not.toContain("'calendar-timeline': {")

    expect(previewProfilesSource).toContain("['federal-register-documents', 'federal-rulemaking'")
    expect(previewProfilesSource).toContain("['launch-library-upcoming', 'launch-schedule'")
    expect(previewProfilesSource).toContain("['anilist-graphql', 'anime-media-search'")
    expect(previewProfilesSource).toContain("['qr-code-generator', 'generated-qr-code'")
    expect(previewProfilesSource).toContain("['dicebear-avatar', 'generated-avatar'")
    expect(previewProfilesSource).toContain("['wikimedia-commons-search', 'commons-media-search'")
  })

  it('keeps UK Police street crime on one dedicated request-bound semantic path', () => {
    expect(catalogFamilyBundleSource).toContain("export { UkPoliceStreetCrimePreview } from './UkPoliceStreetCrimePreview'")
    expect(catalogFamilyBundleSource).not.toContain("api?.id === 'uk-police-street-crime'")
    expect(responsePreviewSource).toContain("'uk-police-street-crime': defineApiPreview('uk-police-street-crime', ({ api, data, executedRequest }) => <UkPoliceStreetCrimePreview api={api} data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'uk-police-street-crime': defineApiPreview('uk-police-street-crime', ({ api, data }) => <LocationPreview")
    expect(previewProfilesSource).toContain("['uk-police-street-crime', 'street-crime'")
  })

  it('keeps Bank of Canada on one dedicated request-bound preview path', () => {
    expect(marketBundleSource).toContain("export { BankOfCanadaValetPreview } from './BankOfCanadaValetPreview'")
    expect(marketBundleSource).not.toContain("api.id === 'bank-of-canada-valet'")
    expect(responsePreviewSource).toContain("<BankOfCanadaValetPreview data={data} executedRequest={executedRequest}/>")
    expect(previewProfilesSource).toContain("['bank-of-canada-valet', 'central-bank-series'")
  })

  it('keeps Frankfurter SGD/MYR history on one dedicated request-bound preview path', () => {
    expect(marketBundleSource).toContain("export { FrankfurterSgdMyrHistoryPreview } from './FrankfurterSgdMyrHistoryPreview'")
    expect(marketBundleSource).not.toContain("api.id === 'frankfurter-sgd-myr-history'")
    expect(responsePreviewSource).toContain('<FrankfurterSgdMyrHistoryPreview data={data} executedRequest={executedRequest}/>')
    expect(responsePreviewSource).not.toContain("'frankfurter-sgd-myr-history', ({ api, data }) => <MarketPreview")
    expect(previewProfilesSource).toContain("['frankfurter-sgd-myr-history', 'fx-history'")
  })

  it('keeps BLS on one dedicated request-bound preview path', () => {
    expect(marketBundleSource).toContain("export { BlsTimeseriesPreview } from './BlsTimeseriesPreview'")
    expect(marketBundleSource).not.toContain("api.id === 'bls-timeseries'")
    expect(responsePreviewSource).toContain('<BlsTimeseriesPreview api={api} data={data} executedRequest={executedRequest}/>')
    expect(previewProfilesSource).toContain("['bls-timeseries', 'labor-timeseries'")
  })

  it('keeps CoinPaprika on one dedicated request-bound preview path', () => {
    expect(marketBundleSource).toContain("export { CoinPaprikaTickerPreview } from './CoinPaprikaTickerPreview'")
    expect(marketBundleSource).not.toContain("api.id === 'coinpaprika-ticker'")
    expect(responsePreviewSource).toContain('<CoinPaprikaTickerPreview api={api} data={data} executedRequest={executedRequest}/>')
    expect(responsePreviewSource).not.toContain("'coinpaprika-ticker', ({ api, data }) => <MarketPreview")
  })

  it('keeps Kraken on one dedicated request-bound preview path', () => {
    expect(marketBundleSource).toContain("export { KrakenPublicTickerPreview } from './KrakenPublicTickerPreview'")
    expect(marketBundleSource).not.toContain("api.id === 'kraken-public-ticker'")
    expect(responsePreviewSource).toContain('<KrakenPublicTickerPreview api={api} data={data} executedRequest={executedRequest}/>')
    expect(responsePreviewSource).not.toContain("'kraken-public-ticker', ({ api, data }) => <MarketPreview")
  })

  it('keeps ROR on a dedicated request-bound semantic path while retaining other research family adapters', () => {
    expect(semanticBundleSource).toContain("export { RorSearchPreview } from './RorSearchPreview'")
    expect(responsePreviewSource).toContain("'ror-search': defineApiPreview('ror-search', ({ data, executedRequest }) => <RorSearchPreview data={data} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'ror-search': defineApiPreview('ror-search', ({ api, data }) => <ResearchLibraryPreview api={api} data={data}/>)")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'ror-search'")
    expect(semanticBundleSource).toContain("export { DoajSearchPreview } from './DoajSearchPreview'")
    expect(responsePreviewSource).toContain("'doaj-search': defineApiPreview('doaj-search', ({ data, requestUrl, executedRequest }) => <DoajSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'doaj-search': defineApiPreview('doaj-search', ({ api, data }) => <ResearchLibraryPreview api={api} data={data}/>)")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'doaj-search'")
    expect(previewProfilesSource).toContain("['doaj-search', 'scholarly-search'")
    expect(previewProfilesSource).toContain("['ror-search', 'organization-directory'")
  })
  it('keeps Open Library on a dedicated request-bound book-search semantic path', () => {
    expect(catalogFamilyBundleSource).toContain("export { OpenLibrarySearchPreview } from './OpenLibrarySearchPreview'")
    expect(responsePreviewSource).toContain("'open-library-search': defineApiPreview('open-library-search', ({ data, requestUrl, executedRequest }) => <OpenLibrarySearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'open-library-search': defineApiPreview('open-library-search', ({ api, data }) => <ResearchLibraryPreview api={api} data={data}/>)")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'open-library-search'")
    expect(previewProfilesSource).toContain("['open-library-search', 'book-search'")
  })

  it('keeps DBLP on a dedicated request-bound semantic path with strict SPARQL identity', () => {
    expect(semanticBundleSource).toContain("export { DblpSearchPreview } from './DblpSearchPreview'")
    expect(responsePreviewSource).toContain("'dblp-search': defineApiPreview('dblp-search', ({ data, requestUrl, executedRequest }) => <DblpSearchPreview data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'dblp-search': defineApiPreview('dblp-search', ({ api, data }) => <ResearchLibraryPreview api={api} data={data}/>)")
    expect(catalogFamilyBundleSource).not.toContain("api.id === 'dblp-search'")
    expect(previewProfilesSource).toContain("['dblp-search', 'dblp-publications'")
  })

  it('keeps Swiss transit on its dedicated request-bound connection adapter', () => {
    expect(catalogFamilyBundleSource).toContain("export { SwissTransitConnectionsPreview } from './SwissTransitConnectionsPreview'")
    expect(responsePreviewSource).toContain("const SwissTransitConnectionsPreview = familyPreview('SwissTransitConnectionsPreview')")
    expect(responsePreviewSource).toContain("'swiss-transit-connections': defineApiPreview('swiss-transit-connections', ({ api, data, requestUrl, executedRequest }) => <SwissTransitConnectionsPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'swiss-transit-connections': defineApiPreview('swiss-transit-connections', ({ data }) => <TransitBoardPreview")
    expect(catalogFamilyBundleSource).not.toContain('Swiss public transport')
  })

  it('keeps iRail on its dedicated request-bound liveboard adapter', () => {
    expect(catalogFamilyBundleSource).toContain("export { IRailLiveboardPreview } from './IRailLiveboardPreview'")
    expect(responsePreviewSource).toContain("const IRailLiveboardPreview = familyPreview('IRailLiveboardPreview')")
    expect(responsePreviewSource).toContain("'irail-liveboard': defineApiPreview('irail-liveboard', ({ api, data, requestUrl, executedRequest }) => <IRailLiveboardPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'irail-liveboard': defineApiPreview('irail-liveboard', ({ data }) => <TransitBoardPreview")
    expect(catalogFamilyBundleSource).not.toContain('Belgian rail liveboard')
  })

  it('keeps PoetryDB on a dedicated request-bound author/count reading-room adapter', () => {
    expect(specializedCatalogBundleSource).toContain("export { PoetryDbPreview } from './PoetryDbPreview'")
    expect(responsePreviewSource).toContain("const PoetryDbPreview = specializedPreview('PoetryDbPreview')")
    expect(responsePreviewSource).toContain("'poetrydb-poems': defineApiPreview('poetrydb-poems', ({ api, data, requestUrl, executedRequest }) => <PoetryDbPreview api={api} data={data} requestUrl={requestUrl} executedRequest={executedRequest}/>)")
    expect(responsePreviewSource).not.toContain("'poetrydb-poems': defineApiPreview('poetrydb-poems', ({ data }) => <PoetryReaderPreview data={data}/>)")
    expect(previewProfilesSource).toContain("['poetrydb-poems', 'poetry-reading-room', 'Request-bound PoetryDB reading room']")
  })

  it('keeps family-specific preview CSS behind the matching async bundle', () => {
    expect(responsePreviewSource).toContain("import './previews/domainCards.css'")
    expect(catalogFamilyBundleSource).toContain("import './catalogFamilyCards.css'")
    expect(trafficCameraBundleSource).toContain("import './trafficCameraCards.css'")
    expect(specializedCatalogBundleSource).toContain("import './specializedCatalogCards.css'")
    expect(packageSemanticBundleSource).toContain("import './packageSemanticCards.css'")
    expect(appStylesSource).not.toContain('.package-release-preview')
    expect(appStylesSource).not.toContain('.package-channel-grid')
    expect(appStylesSource).not.toContain('.ssot-stat-strip')
    expect(appStylesSource).not.toContain('.semantic-card-grid')
    expect(weatherBundleSource).toContain("import './weatherCards.css'")
    expect(marketBundleSource).toContain("import './marketCards.css'")
    expect(dateListSource).toContain("import './dateList.css'")
    expect(semanticCardsSource).toContain("import './semanticCards.css'")
    expect(weatherBundleSource).toContain("import './stationList.css'")
    expect(floodStationSource).toContain("import './stationList.css'")
    expect(responsePreviewSource).not.toContain('diagnosticCards.css')
    expect(responsePreviewSource).not.toContain('operationalCards.css')
    expect(responsePreviewSource).not.toContain('semanticDomainCards.css')

    expect(diagnosticBundleSource).toContain("import './diagnosticCards.css'")
    expect(operationalBundleSource).toContain("import './operationalCards.css'")
    expect(semanticBundleSource).toContain("import './semanticDomainCards.css'")
    expect(semanticBundleSource).toContain("export { RorSearchPreview } from './RorSearchPreview'")
    for (const sciencePreview of ['DrugLabelPreview', 'FoodRecallPreview', 'RxNormDrugPreview', 'ProteinAnnotationPreview', 'PdbStructurePreview', 'ChemblMoleculePreview', 'PubChemCompoundPreview', 'EnsemblGenePreview']) {
      expect(semanticBundleSource).not.toContain(sciencePreview)
      expect(scienceSemanticBundleSource).toContain(`export { ${sciencePreview} }`)
    }
    expect(scienceSemanticBundleSource).toContain("import './scienceSemanticCards.css'")
    const sportsPreviews = ['JolpicaF1Preview', 'OpenDotaMatchesPreview', 'OpenLigaDbMatchesPreview', 'MlbSchedulePreview']
    for (const sportsPreview of sportsPreviews) {
      expect(semanticBundleSource).not.toContain(sportsPreview)
      expect(sportsSemanticBundleSource).toContain(`export { ${sportsPreview} }`)
    }
    expect(sportsSemanticBundleSource).toContain("import './sportsSemanticCards.css'")

    for (const developerPreview of ['DevToArticlesPreview', 'JsonPlaceholderPostPreview', 'GitLabProjectSearchPreview', 'GitHubRepositoriesPreview', 'GitHubGlobalAdvisoriesPreview', 'NvdCpeSearchPreview', 'NvdCveSearchPreview', 'NvdRecentCvesPreview', 'HackerNewsItemPreview', 'HnAlgoliaSearchPreview', 'StackExchangeQuestionsPreview', 'HuggingFaceModelsPreview']) {
      expect(developerSemanticBundleSource).toContain(`export { ${developerPreview} }`)
      expect(specializedCatalogBundleSource).not.toContain(`export { ${developerPreview} }`)
    }
    for (const packagePreview of ['DepsDevPackagePreview', 'HomebrewPackagePreview', 'HexPmPackagePreview', 'JsDelivrPackagePreview', 'MetaCpanModulePreview', 'NuGetPackagePreview', 'NpmSearchPreview', 'PackagistSearchPreview', 'PyPiPackagePreview', 'PubDevPackagePreview', 'RubyGemsPackagePreview']) {
      expect(packageSemanticBundleSource).toContain(`export { ${packagePreview} }`)
      expect(specializedCatalogBundleSource).not.toContain(`export { ${packagePreview} }`)
    }

  })

})

import { createElement, lazy, type ComponentType } from 'react'

export type PreviewBundleName = 'family' | 'traffic-camera' | 'specialized' | 'developer-semantic' | 'package-semantic' | 'weather' | 'operational' | 'market' | 'semantic' | 'science-semantic' | 'sports-semantic' | 'diagnostic'

type PreviewBundleModule = Record<string, unknown>

const bundleLoaders: Record<PreviewBundleName, () => Promise<PreviewBundleModule>> = {
  family: () => import('./CatalogFamilyPreviews'),
  'traffic-camera': () => import('./TrafficCameraPreviewBundle'),
  specialized: () => import('./SpecializedCatalogPreviews'),
  'developer-semantic': () => import('./DeveloperSemanticPreviewBundle'),
  'package-semantic': () => import('./PackageSemanticPreviewBundle'),
  weather: () => import('./WeatherPreviews'),
  operational: () => import('./OperationalPreviews'),
  market: () => import('./MarketPreviews'),
  semantic: () => import('./SemanticPreviewBundle'),
  'science-semantic': () => import('./ScienceSemanticPreviewBundle'),
  'sports-semantic': () => import('./SportsSemanticPreviewBundle'),
  diagnostic: () => import('./DiagnosticPreviewBundle'),
}

const resolvedBundles = new Map<PreviewBundleName, PreviewBundleModule>()
const pendingBundles = new Map<PreviewBundleName, Promise<PreviewBundleModule>>()

export const loadPreviewBundle = (bundle: PreviewBundleName) => {
  const resolved = resolvedBundles.get(bundle)
  if (resolved) return Promise.resolve(resolved)
  const pending = pendingBundles.get(bundle)
  if (pending) return pending
  const promise = bundleLoaders[bundle]()
    .then((module) => {
      resolvedBundles.set(bundle, module)
      return module
    })
    .finally(() => {
      pendingBundles.delete(bundle)
    })
  pendingBundles.set(bundle, promise)
  return promise
}

export const preloadAllPreviewBundles = () => Promise.all((Object.keys(bundleLoaders) as PreviewBundleName[]).map(loadPreviewBundle))

const resolvePreviewExport = (bundle: PreviewBundleName, exportName: string, module: PreviewBundleModule): ComponentType<any> => {
  const Preview = module[exportName]
  if (typeof Preview !== 'function' && (typeof Preview !== 'object' || Preview === null)) {
    throw new Error(`Preview bundle ${bundle} does not export ${exportName}.`)
  }
  return Preview as ComponentType<any>
}

export const deferredPreview = (bundle: PreviewBundleName, exportName: string): ComponentType<any> => {
  const LazyPreview = lazy(async () => ({
    default: resolvePreviewExport(bundle, exportName, await loadPreviewBundle(bundle)),
  }))
  const DeferredPreview = (props: Record<string, unknown>) => {
    const resolved = resolvedBundles.get(bundle)
    return resolved
      ? createElement(resolvePreviewExport(bundle, exportName, resolved), props)
      : createElement(LazyPreview, props)
  }
  Object.defineProperty(DeferredPreview, 'name', { value: `Deferred${exportName}` })
  return DeferredPreview
}

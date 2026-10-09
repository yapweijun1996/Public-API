import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardHeading, DateValue, Facts, isoDate, numericText } from './cardPrimitives'
import { isRecord, nonNegativeSafeInteger, trimmedText } from './semanticValidation'

const requestPrefix = '/downloads/point/'
const namedPeriodDays = { 'last-day': 1, 'last-week': 7, 'last-month': 30 } as const

type NamedPeriod = keyof typeof namedPeriodDays
type DownloadRequestIdentity = { packageName: string; period: NamedPeriod }

const requestedDownload = (requestUrl?: string): DownloadRequestIdentity | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    if (url.origin !== 'https://api.npmjs.org' || url.search || url.hash || url.username || url.password || !url.pathname.startsWith(requestPrefix)) return undefined
    const remainder = url.pathname.slice(requestPrefix.length)
    const separator = remainder.indexOf('/')
    if (separator <= 0 || remainder.indexOf('/', separator + 1) !== -1) return undefined
    const period = remainder.slice(0, separator)
    if (!(period in namedPeriodDays)) return undefined
    const packageName = decodeURIComponent(remainder.slice(separator + 1)).trim()
    if (!packageName) return undefined
    return { period: period as NamedPeriod, packageName }
  } catch {
    return undefined
  }
}

const inclusiveDays = (start?: string, end?: string): number | undefined => {
  if (!start || !end || end < start) return undefined
  const days = (Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / 86400000 + 1
  return Number.isSafeInteger(days) && days > 0 ? days : undefined
}

export function downloadsModel(data: unknown, requestUrl?: string, executedRequest?: ExecutedRequestContext) {
  const root = isRecord(data) ? data : undefined
  const packageName = root ? trimmedText(root.package) : undefined
  const downloads = root ? nonNegativeSafeInteger(root.downloads) : undefined
  const start = root ? isoDate(root.start) : undefined
  const end = root ? isoDate(root.end) : undefined
  const days = inclusiveDays(start, end)
  const transportValid = !executedRequest || (executedRequest.method.toUpperCase() === 'GET' && executedRequest.body === undefined && (requestUrl === undefined || executedRequest.url === requestUrl))
  const requestSource = transportValid ? executedRequest?.url ?? requestUrl : undefined
  const request = requestedDownload(requestSource)
  const requestValid = executedRequest || requestUrl ? transportValid && Boolean(request) : undefined
  const identityMatch = request && packageName ? request.packageName === packageName : undefined
  const periodContract = request && days ? days === namedPeriodDays[request.period] : undefined
  const responseValid = Boolean(root && packageName && downloads !== undefined && start && end && days)
  const average = responseValid && downloads !== undefined && days ? downloads / days : undefined
  return { packageName, downloads, start, end, days, average, request, requestValid, identityMatch, periodContract, responseValid }
}

type DownloadsModel = ReturnType<typeof downloadsModel>

function InvalidDownloads({ model, detail }: { model: DownloadsModel; detail: string }) {
  return <div
    className="domain-card domain-empty"
    data-domain-card="download-summary"
    data-result-state="invalid"
    data-requested-package={model.request?.packageName}
    data-provider-package={model.packageName}
    data-requested-period={model.request?.period}
    data-provider-start={model.start}
    data-provider-end={model.end}
    data-window-days={model.days}
    data-identity-match={model.identityMatch === undefined ? undefined : String(model.identityMatch)}
    data-period-contract={model.periodContract === undefined ? undefined : String(model.periodContract)}
    data-download-contract={String(model.responseValid)}
  >
    <h3>Invalid npm download summary</h3>
    <p>{detail}</p>
  </div>
}

export function DownloadsPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const model = downloadsModel(data, requestUrl, executedRequest)

  if (!model.responseValid) {
    return <InvalidDownloads model={model} detail="npm returned HTTP-success data without the documented package, non-negative integer download total, or valid inclusive start/end reporting dates."/>
  }
  if (model.requestValid === false) {
    return <InvalidDownloads model={model} detail="The executed request is not the supported bodyless GET npm point-download endpoint with one named period and one package identity."/>
  }
  if (model.identityMatch === false) {
    return <InvalidDownloads model={model} detail="The provider package identity does not match the package in the executed npm request, so the plausible download total is withheld."/>
  }
  if (model.periodContract === false) {
    return <InvalidDownloads model={model} detail="The provider reporting window does not match the documented inclusive day count for the requested npm named period, so the plausible download total is withheld."/>
  }

  const state = model.request && model.identityMatch === true && model.periodContract === true ? 'ready' : 'partial'
  return <div
    className="domain-card downloads-workbench"
    data-domain-card="download-summary"
    data-result-state={state}
    data-requested-package={model.request?.packageName}
    data-provider-package={model.packageName}
    data-requested-period={model.request?.period}
    data-provider-start={model.start}
    data-provider-end={model.end}
    data-window-days={model.days}
    data-identity-match={model.identityMatch === undefined ? undefined : String(model.identityMatch)}
    data-period-contract={model.periodContract === undefined ? undefined : String(model.periodContract)}
    data-download-contract="true"
  >
    <CardHeading eyebrow="npm package downloads" title={model.packageName!} description="A total for the exact inclusive reporting window returned by npm."/>
    {state === 'partial' && <p className="domain-note">The provider download facts are structurally valid, but they cannot be fully bound to the executed npm request because request identity is unavailable.</p>}
    <div className="downloads-hero"><span>Downloads in this window</span><strong data-download-count={model.downloads}>{new Intl.NumberFormat('en').format(model.downloads!)}</strong><p>{`${model.days} calendar ${model.days === 1 ? 'day' : 'days'} · start and end included`}</p></div>
    <Facts items={[{ label: 'Window start · UTC', value: <DateValue value={model.start}/> }, { label: 'Window end · UTC', value: <DateValue value={model.end}/> }, { label: 'Daily average · calculated', value: `${numericText(model.average!)} downloads / day` }]}/>
    <p className="domain-note">This endpoint returns a period total, not a daily time series. The average is calculated from that total; it is not a growth rate or a count of unique users.</p>
  </div>
}

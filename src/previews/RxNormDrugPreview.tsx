import type { ExecutedRequestContext } from '../useApiRequestRuntime'
import { CardEmpty } from './cardPrimitives'
import { isRecord, trimmedText } from './semanticValidation'

type RequestContract = { name: string; transportBound: boolean }
type RequestUrl = Omit<RequestContract, 'transportBound'>

const termLabels: Record<string, string> = {
  SCD: 'Clinical Drug',
  SBD: 'Branded Drug',
  GPCK: 'Clinical Pack',
  BPCK: 'Branded Pack',
}
const supportedTermTypes = new Set(Object.keys(termLabels))

type RxConcept = {
  rxcui: string
  name: string
  synonym: string
  tty: string
}

type RxGroup = {
  tty: string
  label: string
  concepts: RxConcept[]
}

const parseRequest = (requestUrl?: string): RequestUrl | null | undefined => {
  if (!requestUrl) return undefined
  try {
    const url = new URL(requestUrl)
    const keys = [...url.searchParams.keys()]
    const exactName = keys.length === 1 && keys[0] === 'name' && url.searchParams.getAll('name').length === 1
    const name = url.searchParams.get('name')?.trim() ?? ''
    if (url.protocol !== 'https:' || url.hostname !== 'rxnav.nlm.nih.gov' || url.port || url.username || url.password
      || url.pathname !== '/REST/drugs.json' || url.hash || !exactName || !name) return null
    const canonical = `https://rxnav.nlm.nih.gov/REST/drugs.json?${new URLSearchParams({ name }).toString()}`
    return requestUrl === canonical ? { name } : null
  } catch {
    return null
  }
}

const requestIdentity = (requestUrl?: string, executedRequest?: ExecutedRequestContext): RequestContract | null | undefined => {
  const displayed = parseRequest(requestUrl)
  if (requestUrl && !displayed) return null
  if (!executedRequest) return displayed ? { ...displayed, transportBound: false } : undefined
  if (executedRequest.method.toUpperCase() !== 'GET' || executedRequest.body !== undefined || (requestUrl !== undefined && requestUrl !== executedRequest.url)) return null
  const executed = parseRequest(executedRequest.url)
  return executed ? { ...executed, transportBound: true } : null
}

export function RxNormDrugPreview({ data, requestUrl, executedRequest }: { data: unknown; requestUrl?: string; executedRequest?: ExecutedRequestContext }) {
  const displayedRequest = parseRequest(requestUrl)
  if (requestUrl && !displayedRequest) {
    return <CardEmpty domain="rxnorm-drug-terminology" title="Invalid RxNorm drug-search request" detail="The displayed request was not the supported exact RxNorm getDrugs name lookup." state="invalid"/>
  }
  const request = requestIdentity(requestUrl, executedRequest)
  if (request === null) {
    return <CardEmpty domain="rxnorm-drug-terminology" title="Invalid RxNorm executed request" detail="The successful response is not bound to the exact supported bodyless GET RxNorm getDrugs name lookup." state="invalid"/>
  }
  if (!request) {
    return <CardEmpty domain="rxnorm-drug-terminology" title="Invalid RxNorm drug-search request" detail="The successful response was not tied to the supported exact RxNorm getDrugs name lookup." state="invalid"/>
  }
  if (!isRecord(data) || !isRecord(data.drugGroup)) {
    return <CardEmpty domain="rxnorm-drug-terminology" title="Invalid RxNorm drug-search response" detail="NLM did not return the documented RxNorm drugGroup object." state="invalid"/>
  }

  const drugGroup = data.drugGroup
  const rawConceptGroup = drugGroup.conceptGroup
  if (rawConceptGroup !== undefined && rawConceptGroup !== null && !Array.isArray(rawConceptGroup)) {
    return <CardEmpty domain="rxnorm-drug-terminology" title="Invalid RxNorm drug-search response" detail="The documented RxNorm conceptGroup collection was malformed." state="invalid"/>
  }

  const rawGroups = Array.isArray(rawConceptGroup) ? rawConceptGroup : []
  const groups: RxGroup[] = []
  const seenRxcuis = new Set<string>()
  let providerConceptCount = 0
  let invalidConceptCount = 0
  let duplicateRxcuiCount = 0
  let malformedGroupCount = 0

  for (const rawGroup of rawGroups) {
    if (!isRecord(rawGroup)) {
      malformedGroupCount += 1
      continue
    }
    const tty = trimmedText(rawGroup.tty)
    const rawConcepts = rawGroup.conceptProperties
    if (!tty || !supportedTermTypes.has(tty)
      || (rawConcepts !== undefined && rawConcepts !== null && !Array.isArray(rawConcepts))) {
      malformedGroupCount += 1
      if (Array.isArray(rawConcepts)) {
        providerConceptCount += rawConcepts.length
        invalidConceptCount += rawConcepts.length
      }
      continue
    }

    const concepts: RxConcept[] = []
    for (const rawConcept of Array.isArray(rawConcepts) ? rawConcepts : []) {
      providerConceptCount += 1
      if (!isRecord(rawConcept)) {
        invalidConceptCount += 1
        continue
      }
      const rxcui = trimmedText(rawConcept.rxcui)
      const name = trimmedText(rawConcept.name)
      const conceptTty = trimmedText(rawConcept.tty)
      if (!rxcui || !name || (conceptTty !== undefined && conceptTty !== tty)) {
        invalidConceptCount += 1
        continue
      }
      if (seenRxcuis.has(rxcui)) {
        duplicateRxcuiCount += 1
        invalidConceptCount += 1
        continue
      }
      seenRxcuis.add(rxcui)
      concepts.push({ rxcui, name, synonym: trimmedText(rawConcept.synonym) ?? '', tty })
    }
    if (concepts.length > 0) groups.push({ tty, label: termLabels[tty], concepts })
  }

  const allConcepts = groups.flatMap((group) => group.concepts)
  if (!allConcepts.length) {
    if (providerConceptCount === 0 && malformedGroupCount === 0) {
      return request.transportBound
        ? <CardEmpty domain="rxnorm-drug-terminology" title="No associated RxNorm drug concepts" detail={`NLM returned a request-bound empty getDrugs result for “${request.name}”.`} state="empty"/>
        : <div className="domain-card domain-empty" data-domain-card="rxnorm-drug-terminology" data-result-state="partial" data-request-bound="false"><h3>RxNorm request identity unavailable</h3><p>NLM returned a coherent zero-concept result, but the executed request transport is unavailable, so the response is not trusted as a request-bound no-match result.</p></div>
    }
    return <CardEmpty domain="rxnorm-drug-terminology" title="Invalid RxNorm drug-search response" detail="The provider returned concept data, but no concept had a trustworthy RxCUI and RxNorm name under a documented product term type." state="invalid"/>
  }

  const primary = groups.find((group) => group.tty === 'SCD')?.concepts[0] ?? allConcepts[0]
  const partial = !request.transportBound || invalidConceptCount > 0 || malformedGroupCount > 0 || duplicateRxcuiCount > 0

  return <div
    className="rxnorm-preview domain-card"
    data-domain-card="rxnorm-drug-terminology"
    data-result-state={partial ? 'partial' : 'ready'}
    data-request-bound={request.transportBound ? 'true' : 'false'}
    data-request-contract="exact-get-drugs-name"
    data-query-name={request.name}
    data-provider-concept-count={providerConceptCount}
    data-valid-concept-count={allConcepts.length}
    data-invalid-concept-count={invalidConceptCount}
    data-malformed-group-count={malformedGroupCount}
    data-duplicate-rxcui-count={duplicateRxcuiCount}
    data-result-count={allConcepts.length}
    data-term-types={groups.map((group) => group.tty).join(',')}
    data-primary-rxcui={primary.rxcui}
    data-primary-concept-name={primary.name}
    data-primary-term-type={primary.tty}
  >
    <header className="domain-heading">
      <div>
        <small className="domain-eyebrow">RxNorm terminology lookup</small>
        <h3>{request.name}</h3>
        <p>{request.transportBound ? 'Standardized clinical and branded drug concepts associated with the exact executed NLM name lookup.' : 'Validated RxNorm concepts from the claimed NLM name lookup; executed transport identity is unavailable.'}</p>
      </div>
      <span className="domain-state">{allConcepts.length} trusted concepts</span>
    </header>

    {partial && <p className="domain-note">{request.transportBound ? 'Only concepts with a provider-owned RxCUI, RxNorm name, and coherent product term type are shown. Malformed or duplicate concept identities are withheld.' : 'The provider result is structurally useful, but executed-request identity is unavailable, so it cannot be marked ready.'}</p>}

    <dl className="domain-facts">
      <div><dt>Requested name</dt><dd>{request.name}</dd></div>
      <div><dt>Trusted concepts</dt><dd>{allConcepts.length}</dd></div>
      <div><dt>Term families</dt><dd>{groups.map((group) => group.tty).join(', ')}</dd></div>
      <div><dt>Primary RxCUI</dt><dd>{primary.rxcui}</dd></div>
    </dl>

    <div className="rxnorm-groups">
      {groups.map((group) => <section key={group.tty} aria-labelledby={`rxnorm-${group.tty.toLowerCase()}`}>
        <header>
          <div><small className="domain-eyebrow">{group.tty}</small><h4 id={`rxnorm-${group.tty.toLowerCase()}`}>{group.label}</h4></div>
          <span>{group.concepts.length} trusted</span>
        </header>
        <ol>
          {group.concepts.slice(0, 6).map((concept) => <li key={`${group.tty}-${concept.rxcui}`} data-rxcui={concept.rxcui} data-term-type={concept.tty}>
            <strong>{concept.name}</strong>
            <code>RxCUI {concept.rxcui}</code>
            {concept.synonym && concept.synonym !== concept.name && <span>{concept.synonym}</span>}
          </li>)}
        </ol>
        {group.concepts.length > 6 && <p className="domain-note">Showing 6 of {group.concepts.length} trusted {group.tty} concepts. Raw JSON retains the complete provider response.</p>}
      </section>)}
    </div>

    <p className="domain-note">RxNorm is terminology data from the U.S. National Library of Medicine. Use it for drug-name normalization and identifier lookup, not as prescribing or medical advice. Raw JSON retains every returned concept.</p>
  </div>
}

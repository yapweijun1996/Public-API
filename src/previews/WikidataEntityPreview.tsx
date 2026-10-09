import { asRecord, CardEmpty, CardHeading, Facts, text } from './cardPrimitives'

type WikidataEntityBinding = {
  uri: string
  qid: string
  label: string
  labelLanguage?: string
  itemType: string
  labelType: string
}

const entityId = (uri?: string) => uri?.match(/^https?:\/\/www\.wikidata\.org\/entity\/(Q\d+)$/i)?.[1]?.toUpperCase()

const entityBinding = (value: unknown): WikidataEntityBinding | undefined => {
  const binding = asRecord(value)
  const item = asRecord(binding.item)
  const itemLabel = asRecord(binding.itemLabel)
  const uri = text(item.value)
  const qid = entityId(uri)
  const label = text(itemLabel.value)
  const itemType = text(item.type)
  const labelType = text(itemLabel.type)
  if (!uri || !qid || !label || itemType !== 'uri' || labelType !== 'literal') return undefined
  return {
    uri,
    qid,
    label,
    labelLanguage: text(itemLabel['xml:lang']),
    itemType,
    labelType,
  }
}

export function WikidataEntityPreview({ data }: { data: unknown }) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return <CardEmpty domain="knowledge-entities" title="Invalid Wikidata SPARQL response" detail="Wikidata Query Service did not return the expected SPARQL result object." state="invalid"/>
  }

  const root = asRecord(data)
  const result = asRecord(root.results)
  const providerBindings = Array.isArray(result.bindings) ? result.bindings : undefined
  if (!providerBindings) {
    return <CardEmpty domain="knowledge-entities" title="Invalid Wikidata SPARQL response" detail="Wikidata Query Service returned HTTP-success data without the documented results.bindings array." state="invalid"/>
  }

  const head = asRecord(root.head)
  const variables = Array.isArray(head.vars) ? head.vars.filter((value): value is string => typeof value === 'string') : []
  const variablesMatchQuery = variables.includes('item') && variables.includes('itemLabel')

  if (providerBindings.length === 0) {
    if (!variablesMatchQuery) {
      return <CardEmpty domain="knowledge-entities" title="Invalid Wikidata SPARQL response" detail="The empty SPARQL response did not declare the item and itemLabel variables projected by this query." state="invalid"/>
    }
    return <CardEmpty domain="knowledge-entities" title="No Wikidata city bindings returned" detail="The valid SPARQL result contained an empty bindings array for this bounded city query." state="empty"/>
  }

  const entities = providerBindings.map(entityBinding).filter((entity): entity is WikidataEntityBinding => Boolean(entity))
  const invalidBindingCount = providerBindings.length - entities.length
  if (!entities.length) {
    return <CardEmpty domain="knowledge-entities" title="Invalid Wikidata SPARQL response" detail="The returned bindings did not contain a provider-owned Wikidata entity URI/QID and literal label from the same row." state="invalid"/>
  }

  const nonEnglishLabelCount = entities.filter((entity) => entity.labelLanguage !== 'en').length
  const state = invalidBindingCount > 0 || !variablesMatchQuery || nonEnglishLabelCount > 0 ? 'partial' : 'ready'
  const first = entities[0]
  return <div
    className="domain-card wikidata-entity-preview"
    data-domain-card="knowledge-entities"
    data-result-state={state}
    data-provider-binding-count={providerBindings.length}
    data-valid-binding-count={entities.length}
    data-invalid-binding-count={invalidBindingCount}
    data-english-label-count={entities.length - nonEnglishLabelCount}
    data-result-count={entities.length}
    data-primary-qid={first.qid}
    data-primary-label={first.label}
    data-sparql-variables={variables.join(',')}
    data-query-variables-valid={String(variablesMatchQuery)}
  >
    <CardHeading
      eyebrow="Wikidata Query Service · SPARQL bindings"
      title={`${entities.length} city entit${entities.length === 1 ? 'y' : 'ies'}`}
      description="Each visible row preserves a provider-owned Wikidata entity URI, stable QID, and literal label from the same SPARQL binding."
    ><span className="domain-state">{state === 'partial' ? 'Partial SPARQL result' : 'Bounded query result'}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">This SPARQL response is incomplete or malformed. Only bindings with a valid Wikidata entity URI/QID and literal label are shown; missing projected variables or non-English label metadata remain explicit.</p>}
    <Facts items={[
      { label: 'Returned bindings', value: String(providerBindings.length) },
      { label: 'Usable entity bindings', value: String(entities.length) },
      { label: 'SPARQL variables', value: variables.length ? variables.join(', ') : 'Not supplied' },
      { label: 'Entity class', value: 'city (wd:Q515)' },
    ]}/>
    <ol className="wikidata-entity-list" aria-label="Wikidata city entity bindings">
      {entities.map((entity, index) => <li
        key={`${entity.uri}-${index}`}
        data-binding-index={index + 1}
        data-qid={entity.qid}
        data-entity-uri={entity.uri}
        data-label={entity.label}
        data-label-language={entity.labelLanguage}
      >
        <header><div><small>Binding {index + 1}</small><h4>{entity.label}</h4></div><code>{entity.qid}</code></header>
        <Facts items={[
          { label: 'Entity URI', value: <code>{entity.uri}</code> },
          { label: 'Label language', value: entity.labelLanguage ?? 'Not supplied' },
          { label: 'Binding types', value: `${entity.itemType} / ${entity.labelType}` },
        ]}/>
      </li>)}
    </ol>
    <p className="domain-note">This is a bounded SPARQL result, not a complete or ranked list of all cities in Wikidata. Wikidata Query Service data can lag behind Wikidata edits.</p>
  </div>
}

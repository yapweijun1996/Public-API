import { asRecord, CardEmpty, CardHeading, displayed, Facts, finite, rows, text } from './cardPrimitives'

// DNS wire codes, not provider-health verdicts. Unknown codes remain visible.
const dnsTypes: Record<number, string> = { 1: 'A · IPv4', 2: 'NS · Name server', 5: 'CNAME · Alias', 6: 'SOA · Authority', 15: 'MX · Mail', 16: 'TXT · Text', 28: 'AAAA · IPv6', 33: 'SRV · Service', 43: 'DS', 46: 'RRSIG', 48: 'DNSKEY', 65: 'HTTPS', 257: 'CAA' }
const dnsCodes: Record<number, string> = { 0: 'NOERROR', 1: 'FORMERR', 2: 'SERVFAIL', 3: 'NXDOMAIN', 4: 'NOTIMP', 5: 'REFUSED' }
const typeLabel = (value: unknown) => {
  const code = finite(value)
  return code === undefined ? 'Type not supplied' : dnsTypes[code] ?? `TYPE ${code}`
}
export function dnsModel(data: unknown) {
  const root = asRecord(data)
  const code = finite(root.Status)
  return {
    code, status: code === undefined ? 'Status not supplied' : dnsCodes[code] ?? `RCODE ${code}`,
    questions: rows(root.Question).map((row) => ({ name: displayed(row.name), type: typeLabel(row.type) })),
    answers: rows(root.Answer).map((row) => ({ name: displayed(row.name), type: typeLabel(row.type), value: displayed(row.data), ttl: finite(row.TTL) })),
    dnssec: root.AD === true ? 'Validated by resolver' : root.AD === false ? 'Not validated by resolver' : 'Not supplied',
    truncated: root.TC === true, comment: text(root.Comment),
  }
}
export function DnsPreview({ data }: { data: unknown }) {
  const model = dnsModel(data)
  if (model.code === undefined && !model.questions.length && !model.answers.length) return <CardEmpty domain="dns-records" title="DNS response unavailable" detail="No DNS status, question or answer records were returned."/>
  return <div className="domain-card dns-workbench" data-domain-card="dns-records" data-result-state={model.code === undefined ? 'invalid' : model.code !== 0 ? 'dns-error' : model.answers.length ? 'ready' : 'empty'} data-dns-status={model.code}>
    <CardHeading eyebrow="DNS resolution" title={model.questions[0]?.name ?? 'Resolver response'} description={model.questions.map((q) => q.type).join(' · ')}>
      <span className={`domain-state ${model.code === 0 ? 'neutral' : 'warning'}`}>{model.status}</span>
    </CardHeading>
    <Facts items={[{ label: 'Answer records', value: model.answers.length }, { label: 'DNSSEC', value: model.dnssec }, { label: 'Response completeness', value: model.truncated ? 'Truncated by resolver' : 'No truncation reported' }]}/>
    {!model.answers.length && <p className="domain-notice">{model.code === 3 ? 'The resolver reports that this domain does not exist.' : model.code === 0 ? 'The query completed, but no answer records were returned for this record type.' : 'The DNS query did not return answer records. Check the resolver status above.'}</p>}
    {model.answers.length > 0 && <ol className="dns-records" role="list" aria-label="DNS answer records">{model.answers.map((answer, index) => <li key={`${answer.name}-${index}`}>
      <header><strong>{answer.type}</strong><span>TTL {answer.ttl === undefined || answer.ttl < 0 ? 'not supplied' : `${answer.ttl} seconds`}</span></header>
      <code>{answer.value}</code><small>{answer.name}</small>
    </li>)}</ol>}
    {model.comment && <details className="domain-disclosure"><summary>Resolver diagnostic</summary><p>{model.comment}</p></details>}
    <p className="domain-note">TTL is the DNS cache lifetime in seconds. A completed HTTP request does not by itself mean the domain resolved.</p>
  </div>
}

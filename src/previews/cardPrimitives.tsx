import { useEffect, useRef, useState, type ReactNode } from 'react'

export const asRecord = (value: unknown): Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
export const rows = (value: unknown) => Array.isArray(value) ? value.filter((item) => Object.keys(asRecord(item)).length > 0).map(asRecord) : []
export const text = (value: unknown) => typeof value === 'string' && value.trim() ? value : undefined
export const finite = (value: unknown): number | undefined => {
  if (typeof value !== 'number' && !(typeof value === 'string' && value.trim())) return undefined
  const number = Number(value)
  return Number.isFinite(number) ? number : undefined
}
export const numericText = (value: number) => new Intl.NumberFormat('en', { maximumSignificantDigits: 12 }).format(value)
export const isoDate = (value: unknown) => {
  const candidate = text(value)
  if (!candidate || !/^\d{4}-\d{2}-\d{2}$/.test(candidate)) return undefined
  const date = new Date(`${candidate}T00:00:00Z`)
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === candidate ? candidate : undefined
}
export const displayed = (value: unknown) => text(value) ?? (typeof value === 'number' && Number.isFinite(value) ? String(value) : 'Not supplied')

export function CardEmpty({ domain, title, detail, state = 'invalid' }: { domain: string; title: string; detail: string; state?: 'invalid' | 'empty' }) {
  return <div className="domain-card domain-empty" data-domain-card={domain} data-result-state={state}><h3>{title}</h3><p>{detail}</p></div>
}
export function CardHeading({ eyebrow, title, description, children }: { eyebrow: string; title: string; description?: string; children?: ReactNode }) {
  return <header className="domain-heading"><div><span className="domain-eyebrow">{eyebrow}</span><h3>{title}</h3>{description && <p>{description}</p>}</div>{children}</header>
}
export function Facts({ items }: { items: Array<{ label: string; value: ReactNode }> }) {
  return <dl className="domain-facts">{items.map(({ label, value }) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
}
export function DateValue({ value }: { value?: string }) {
  return value ? <time dateTime={value}>{value}</time> : <>Not supplied</>
}
export function CopyValue({ label, value }: { label: string; value: string }) {
  const [state, setState] = useState('')
  const generation = useRef(0)
  useEffect(() => { generation.current += 1; setState(''); return () => { generation.current += 1 } }, [value])
  const copy = async () => {
    const current = generation.current
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable')
      await navigator.clipboard.writeText(value)
      if (current === generation.current) setState(`${label} copied`)
    } catch {
      if (current === generation.current) setState('Copy unavailable. Select the value to copy manually.')
    }
  }
  return <div className="domain-copy"><button type="button" onClick={copy} aria-label={`Copy ${label}`}>Copy {label}</button><span role="status">{state}</span></div>
}

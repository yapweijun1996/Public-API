import { asRecord, CardEmpty, CardHeading, CopyValue, displayed, Facts, text } from './cardPrimitives'

const validHex = (value: unknown) => typeof value === 'string' && /^#[\da-f]{6}$/i.test(value) ? value.toUpperCase() : undefined
export function colorModel(data: unknown) {
  const root = asRecord(data)
  const name = asRecord(root.name)
  const hex = validHex(asRecord(root.hex).value)
  return {
    hex,
    name: text(name.value),
    match: name.exact_match_name === true ? 'Exact named match' : name.exact_match_name === false ? 'Closest named match' : 'Name match not specified',
    closest: validHex(name.closest_named_hex),
    contrast: validHex(asRecord(root.contrast).value),
    formats: ['rgb', 'hsl', 'hsv', 'cmyk', 'XYZ'].map((key) => ({ label: key.toUpperCase(), value: displayed(asRecord(root[key]).value) })),
  }
}

export function ColorPreview({ data }: { data: unknown }) {
  const model = colorModel(data)
  if (!model.hex) return <CardEmpty domain="color-swatch" title="Color unavailable" detail="The provider did not return a valid six-digit hex color. Check the input or inspect Raw JSON."/>
  return <div className="domain-card color-workbench" data-domain-card="color-swatch" data-result-state="ready">
    <div className="color-swatch-panel">
      <div className="color-swatch" role="img" aria-label={`Color swatch ${model.hex}`} style={{ backgroundColor: model.hex }}/>
      <div className="color-swatch-caption"><span>Selected color</span><strong>{model.hex}</strong><CopyValue label="HEX" value={model.hex}/></div>
    </div>
    <div className="color-info">
      <CardHeading eyebrow="Color specification" title={model.name ?? model.hex} description={model.match}/>
      {model.closest && model.match === 'Closest named match' && <p className="domain-note">Nearest named color: <code>{model.closest}</code>. The swatch shows your requested color, not the nearest match.</p>}
      <Facts items={model.formats}/>
      {model.contrast && <p className="domain-note">Provider-suggested text color: <code>{model.contrast}</code>. This is not a verified accessibility contrast rating.</p>}
    </div>
  </div>
}

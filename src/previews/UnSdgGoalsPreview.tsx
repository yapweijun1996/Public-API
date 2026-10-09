import { asRecord, CardEmpty, CardHeading, text } from './cardPrimitives'
import { cleanText } from './previewData'

type GoalModel = { code: string; title: string; description?: string; uri?: string }

const goalModel = (value: unknown): GoalModel | undefined => {
  const goal = asRecord(value)
  const code = text(goal.code)
  const title = cleanText(goal.title)
  if (!code || !title) return undefined
  return { code, title, description: cleanText(goal.description), uri: text(goal.uri) }
}

const officialGoalCodes = Array.from({ length: 17 }, (_, index) => String(index + 1))

export function UnSdgGoalsPreview({ data }: { data: unknown }) {
  if (!Array.isArray(data)) {
    return <CardEmpty domain="sdg-goals" title="Invalid SDG goal response" detail="The UN Statistics Division response was not the expected Goal/List array." state="invalid"/>
  }
  if (!data.length) {
    return <CardEmpty domain="sdg-goals" title="No SDG goals returned" detail="The UN Statistics Division returned an empty Goal/List catalogue." state="empty"/>
  }

  const goals = data.map(goalModel).filter((goal): goal is GoalModel => Boolean(goal))
  if (!goals.length) {
    return <CardEmpty domain="sdg-goals" title="Invalid SDG goal response" detail="The UN Statistics Division response did not contain usable goal code and title records." state="invalid"/>
  }

  const codes = goals.map((goal) => goal.code)
  const uniqueCodes = new Set(codes)
  const completeOfficialSet = goals.length === 17 && data.length === 17 && uniqueCodes.size === 17 && officialGoalCodes.every((code) => uniqueCodes.has(code))
  const malformedRecordCount = data.length - goals.length
  const state = completeOfficialSet && malformedRecordCount === 0 ? 'ready' : 'partial'

  return <div className="domain-card sdg-goals-preview" data-domain-card="sdg-goals" data-result-state={state} data-provider-record-count={data.length} data-usable-goal-count={goals.length} data-malformed-record-count={malformedRecordCount} data-invalid-record-count={malformedRecordCount} data-goal-count={goals.length} data-goal-codes={codes.join(',')} data-complete-official-set={completeOfficialSet ? 'true' : 'false'}>
    <CardHeading eyebrow="United Nations Statistics Division · SDG API" title={`${goals.length} Sustainable Development Goal${goals.length === 1 ? '' : 's'}`} description="Official goal records from the latest SDG API release. Goal descriptions remain readable in the page DOM instead of being reduced to generic rows."><span className="domain-state">{state === 'ready' ? 'Complete goal catalogue' : 'Incomplete Goal/List response'}</span></CardHeading>
    {state === 'partial' && <p className="domain-note">Incomplete Goal/List response. The official SDG framework contains Goal 1–17; this card shows only usable provider-owned goal records and does not invent missing goals.</p>}
    <ol className="sdg-goal-list" aria-label="United Nations Sustainable Development Goals">
      {goals.map((goal, index) => <li key={`${goal.code}-${index}`} data-goal-code={goal.code} data-goal-uri={goal.uri}>
        <span className="sdg-goal-number" aria-label={`Goal ${goal.code}`}>{goal.code}</span>
        <div><small>Goal {goal.code}</small><h4>{goal.title}</h4>{goal.description && <p>{goal.description}</p>}{goal.uri && <code aria-label={`Goal ${goal.code} API path`}>{goal.uri}</code>}</div>
      </li>)}
    </ol>
    <p className="domain-note">This endpoint lists goals. Targets, indicators, series and observations are separate SDG API resources and are not implied by this card.</p>
  </div>
}

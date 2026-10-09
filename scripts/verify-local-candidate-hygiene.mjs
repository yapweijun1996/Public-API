import { inspectCandidateHygiene } from './lib/candidate-hygiene.mjs'

const result = inspectCandidateHygiene()

if (result.issues.length > 0) {
  console.error('Local candidate hygiene: FAIL')
  for (const issue of result.issues) console.error(issue)
  process.exitCode = 1
} else {
  console.log(JSON.stringify({
    verdict: 'PASS',
    trackedCandidateFiles: result.trackedFiles.length,
    untrackedCandidateFiles: result.untrackedFiles.length,
    whitespaceErrors: 0,
    conflictMarkers: 0,
    stagingRequired: false,
  }, null, 2))
}

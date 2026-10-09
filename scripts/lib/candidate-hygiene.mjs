import fs from 'node:fs'
import path from 'node:path'
import { spawnSync } from 'node:child_process'

const conflictMarkerPattern = /^(<<<<<<< |=======\s*$|>>>>>>> )/

const runGit = (args, { cwd, allowedStatuses = [0] } = {}) => {
  const result = spawnSync('git', args, {
    cwd,
    encoding: 'utf8',
    maxBuffer: 16 * 1024 * 1024,
  })
  if (result.error) throw result.error
  if (!allowedStatuses.includes(result.status)) {
    const detail = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    throw new Error(`git ${args.join(' ')} failed with status ${result.status}${detail ? `\n${detail}` : ''}`)
  }
  return result
}

const splitNullList = (value) => value.split('\0').filter(Boolean)

export const listUntrackedCandidateFiles = (cwd = process.cwd()) => {
  const { stdout } = runGit(['ls-files', '--others', '--exclude-standard', '-z'], { cwd })
  return splitNullList(stdout)
}

export const listTrackedCandidateFiles = (cwd = process.cwd()) => {
  const { stdout } = runGit(['diff', '--name-only', '-z', 'HEAD', '--'], { cwd })
  return splitNullList(stdout)
}

const isBinary = (buffer) => buffer.includes(0)

export const findConflictMarkers = (files, cwd = process.cwd()) => {
  const issues = []
  for (const relativePath of files) {
    const absolutePath = path.join(cwd, relativePath)
    if (!fs.existsSync(absolutePath) || !fs.statSync(absolutePath).isFile()) continue
    const buffer = fs.readFileSync(absolutePath)
    if (isBinary(buffer)) continue
    const lines = buffer.toString('utf8').split(/\r?\n/)
    lines.forEach((line, index) => {
      if (conflictMarkerPattern.test(line)) issues.push(`${relativePath}:${index + 1}: unresolved conflict marker`)
    })
  }
  return issues
}

export const findUntrackedWhitespaceErrors = (files, cwd = process.cwd()) => {
  const issues = []
  for (const relativePath of files) {
    const result = runGit(['diff', '--no-index', '--check', '--', '/dev/null', relativePath], {
      cwd,
      allowedStatuses: [0, 1, 2, 3],
    })
    const output = [result.stdout, result.stderr].filter(Boolean).join('\n').trim()
    if (output) issues.push(output)
  }
  return issues
}

export const inspectCandidateHygiene = (cwd = process.cwd()) => {
  const trackedFiles = listTrackedCandidateFiles(cwd)
  const untrackedFiles = listUntrackedCandidateFiles(cwd)
  const trackedCheck = runGit(['diff', 'HEAD', '--check', '--'], { cwd, allowedStatuses: [0, 2] })
  const trackedWhitespace = [trackedCheck.stdout, trackedCheck.stderr].filter(Boolean).join('\n').trim()
  const conflictMarkers = findConflictMarkers([...new Set([...trackedFiles, ...untrackedFiles])], cwd)
  const untrackedWhitespace = findUntrackedWhitespaceErrors(untrackedFiles, cwd)
  const issues = [
    ...(trackedWhitespace ? [trackedWhitespace] : []),
    ...untrackedWhitespace,
    ...conflictMarkers,
  ]
  return {
    trackedFiles,
    untrackedFiles,
    issues,
  }
}

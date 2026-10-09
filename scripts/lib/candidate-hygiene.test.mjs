import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { afterEach, describe, expect, it } from 'vitest'
import { inspectCandidateHygiene } from './candidate-hygiene.mjs'

const tempRepos = []

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8' })

const createRepo = () => {
  const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'public-api-hygiene-test-'))
  tempRepos.push(cwd)
  git(cwd, 'init', '-q')
  git(cwd, 'config', 'user.email', 'test@example.invalid')
  git(cwd, 'config', 'user.name', 'Public API Test')
  fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'baseline\n')
  git(cwd, 'add', 'tracked.txt')
  git(cwd, 'commit', '-qm', 'baseline')
  return cwd
}

afterEach(() => {
  for (const cwd of tempRepos.splice(0)) fs.rmSync(cwd, { recursive: true, force: true })
})

describe('local candidate hygiene', () => {
  it('accepts clean tracked and untracked candidate files without staging them', () => {
    const cwd = createRepo()
    fs.writeFileSync(path.join(cwd, 'tracked.txt'), 'changed\n')
    fs.writeFileSync(path.join(cwd, 'new-file.txt'), 'clean\n')

    const result = inspectCandidateHygiene(cwd)

    expect(result.issues).toEqual([])
    expect(result.trackedFiles).toEqual(['tracked.txt'])
    expect(result.untrackedFiles).toEqual(['new-file.txt'])
    expect(git(cwd, 'status', '--porcelain')).toContain('?? new-file.txt')
  })

  it('detects whitespace errors in untracked files that git diff --check cannot see', () => {
    const cwd = createRepo()
    fs.writeFileSync(path.join(cwd, 'new-file.txt'), 'trailing whitespace   \n')

    const result = inspectCandidateHygiene(cwd)

    expect(result.issues.join('\n')).toContain('trailing whitespace')
  })

  it('detects unresolved conflict markers in tracked or untracked candidate files', () => {
    const cwd = createRepo()
    fs.writeFileSync(path.join(cwd, 'tracked.txt'), '<<<<<<< ours\nvalue\n=======\nother\n>>>>>>> theirs\n')

    const result = inspectCandidateHygiene(cwd)

    expect(result.issues).toContain('tracked.txt:1: unresolved conflict marker')
    expect(result.issues).toContain('tracked.txt:3: unresolved conflict marker')
    expect(result.issues).toContain('tracked.txt:5: unresolved conflict marker')
  })
})

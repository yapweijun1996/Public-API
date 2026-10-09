import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  browserProfileOwnerFile,
  createOwnedBrowserProfile,
  hasChildExited,
  reapStaleBrowserProfiles,
  removeOwnedBrowserProfile,
  terminateChildProcess,
} from './browser-temp-profile.mjs'

const roots = []
const makeRoot = () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'public-api-profile-test-'))
  roots.push(root)
  return root
}
const makeProfile = (root, prefix, name, { ownerPid, ageMs = 0 } = {}) => {
  const directory = path.join(root, `${prefix}${name}`)
  fs.mkdirSync(directory)
  if (ownerPid !== undefined) fs.writeFileSync(path.join(directory, browserProfileOwnerFile), `${ownerPid}\n`)
  if (ageMs > 0) {
    const date = new Date(Date.now() - ageMs)
    fs.utimesSync(directory, date, date)
  }
  return directory
}

afterEach(() => {
  for (const root of roots.splice(0)) fs.rmSync(root, { recursive: true, force: true })
})

describe('browser child-process cleanup', () => {
  it('treats signal-terminated children as exited even when exitCode stays null', () => {
    expect(hasChildExited({ exitCode: null, signalCode: 'SIGTERM' })).toBe(true)
    expect(hasChildExited({ exitCode: 0, signalCode: null })).toBe(true)
    expect(hasChildExited({ exitCode: null, signalCode: null })).toBe(false)
  })

  it('stops after graceful signal termination instead of sending a redundant force kill', async () => {
    const listeners = new Map()
    const signals = []
    const child = {
      exitCode: null,
      signalCode: null,
      once(event, listener) { listeners.set(event, listener) },
      off(event, listener) { if (listeners.get(event) === listener) listeners.delete(event) },
      kill(signal) {
        signals.push(signal)
        if (signal === 'SIGTERM') {
          child.signalCode = 'SIGTERM'
          queueMicrotask(() => listeners.get('exit')?.(null, 'SIGTERM'))
        }
        return true
      },
    }

    await expect(terminateChildProcess(child, { gracefulTimeoutMs: 50, forceTimeoutMs: 50 })).resolves.toBe(true)
    expect(signals).toEqual(['SIGTERM'])
    expect(hasChildExited(child)).toBe(true)
  })
})

describe('browser temp profile cleanup', () => {
  it('reaps a profile whose recorded owner process is no longer running', () => {
    const root = makeRoot()
    const prefix = 'browser-profile-'
    const stale = makeProfile(root, prefix, 'dead', { ownerPid: 424242 })

    const removed = reapStaleBrowserProfiles({ prefix, tmpdir: root, ownerRunning: () => false })

    expect(removed).toBe(1)
    expect(fs.existsSync(stale)).toBe(false)
  })

  it('preserves a profile while its recorded owner process is running', () => {
    const root = makeRoot()
    const prefix = 'browser-profile-'
    const active = makeProfile(root, prefix, 'active', { ownerPid: 123, ageMs: 24 * 60 * 60 * 1000 })

    const removed = reapStaleBrowserProfiles({ prefix, tmpdir: root, ownerRunning: () => true })

    expect(removed).toBe(0)
    expect(fs.existsSync(active)).toBe(true)
  })

  it('only reaps legacy unowned profiles after the conservative stale window', () => {
    const root = makeRoot()
    const prefix = 'browser-profile-'
    const recent = makeProfile(root, prefix, 'recent', { ageMs: 30 * 60 * 1000 })
    const stale = makeProfile(root, prefix, 'stale', { ageMs: 3 * 60 * 60 * 1000 })

    const removed = reapStaleBrowserProfiles({ prefix, tmpdir: root, legacyStaleMs: 2 * 60 * 60 * 1000 })

    expect(removed).toBe(1)
    expect(fs.existsSync(recent)).toBe(true)
    expect(fs.existsSync(stale)).toBe(false)
  })

  it('marks newly created profiles with the current owner pid and removes them explicitly', () => {
    const root = makeRoot()
    const profile = createOwnedBrowserProfile('browser-profile-', { tmpdir: root })

    expect(fs.readFileSync(path.join(profile, browserProfileOwnerFile), 'utf8').trim()).toBe(String(process.pid))
    removeOwnedBrowserProfile(profile)
    expect(fs.existsSync(profile)).toBe(false)
  })
})

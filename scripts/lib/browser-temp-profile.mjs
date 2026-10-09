import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

export const browserProfileOwnerFile = '.public-api-browser-owner-pid'
export const legacyProfileStaleMs = 2 * 60 * 60 * 1000

const ownedTempDirs = new Set()
let exitCleanupRegistered = false

const cleanupOwnedTempDirs = () => {
  for (const directory of ownedTempDirs) {
    try {
      fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    } catch {}
  }
  ownedTempDirs.clear()
}

const ensureExitCleanup = () => {
  if (exitCleanupRegistered) return
  exitCleanupRegistered = true
  process.once('exit', cleanupOwnedTempDirs)
}

export const isProcessRunning = (pid) => {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (error) {
    return error?.code === 'EPERM'
  }
}

export const hasChildExited = (child) =>
  !child || child.exitCode !== null || child.signalCode !== null

const waitForChildExit = (child, timeoutMs) => {
  if (hasChildExited(child)) return Promise.resolve(true)
  return new Promise((resolve) => {
    let timer
    const finish = (exited) => {
      if (timer) clearTimeout(timer)
      child.off('exit', onExit)
      resolve(exited)
    }
    const onExit = () => finish(true)
    child.once('exit', onExit)
    if (hasChildExited(child)) return finish(true)
    timer = setTimeout(() => finish(hasChildExited(child)), timeoutMs)
  })
}

export const terminateChildProcess = async (child, {
  gracefulSignal = 'SIGTERM',
  forceSignal = 'SIGKILL',
  gracefulTimeoutMs = 3000,
  forceTimeoutMs = 2000,
} = {}) => {
  if (hasChildExited(child)) return true
  child.kill(gracefulSignal)
  if (await waitForChildExit(child, gracefulTimeoutMs)) return true
  child.kill(forceSignal)
  return waitForChildExit(child, forceTimeoutMs)
}

const readOwnerPid = (directory) => {
  try {
    const value = Number.parseInt(fs.readFileSync(path.join(directory, browserProfileOwnerFile), 'utf8').trim(), 10)
    return Number.isInteger(value) && value > 0 ? value : null
  } catch {
    return null
  }
}

export const reapStaleBrowserProfiles = ({
  prefix,
  tmpdir = os.tmpdir(),
  now = Date.now(),
  legacyStaleMs = legacyProfileStaleMs,
  ownerRunning = isProcessRunning,
} = {}) => {
  if (!prefix) throw new Error('Browser profile prefix is required.')
  let removed = 0
  for (const entry of fs.readdirSync(tmpdir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !entry.name.startsWith(prefix)) continue
    const directory = path.join(tmpdir, entry.name)
    const ownerPid = readOwnerPid(directory)
    if (ownerPid !== null) {
      if (ownerRunning(ownerPid)) continue
    } else {
      let ageMs = 0
      try {
        ageMs = Math.max(0, now - fs.statSync(directory).mtimeMs)
      } catch {
        continue
      }
      if (ageMs < legacyStaleMs) continue
    }
    fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
    removed += 1
  }
  return removed
}

export const createOwnedBrowserProfile = (prefix, { tmpdir = os.tmpdir() } = {}) => {
  if (!prefix) throw new Error('Browser profile prefix is required.')
  ensureExitCleanup()
  reapStaleBrowserProfiles({ prefix, tmpdir })
  const directory = fs.mkdtempSync(path.join(tmpdir, prefix))
  fs.writeFileSync(path.join(directory, browserProfileOwnerFile), `${process.pid}\n`, { flag: 'wx' })
  ownedTempDirs.add(directory)
  return directory
}

export const removeOwnedBrowserProfile = (directory) => {
  if (!directory) return
  fs.rmSync(directory, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 })
  ownedTempDirs.delete(directory)
}

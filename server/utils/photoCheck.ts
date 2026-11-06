/**
 * Which photo URLs are gone for good. Many v3 pictures point at a Cloudinary
 * account that now answers 401, so they show as broken images on wedance.vip
 * too; the syncs leave those photos empty instead (the page shows its initials).
 *
 * Only a 4xx answer counts as dead — a timeout, network error or 5xx may be
 * passing, so that photo is kept.
 */
export async function findDeadPhotos(urls: Iterable<string>, opts: { concurrency?: number; timeoutMs?: number } = {}): Promise<Set<string>> {
  const todo = [...new Set(urls)]
  const dead = new Set<string>()
  const timeoutMs = opts.timeoutMs ?? 10_000
  async function check(url: string) {
    try {
      let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) })
      // Some hosts don't answer HEAD; ask for the first byte instead.
      if (res.status === 405 || res.status === 501) {
        res = await fetch(url, { headers: { range: 'bytes=0-0' }, redirect: 'follow', signal: AbortSignal.timeout(timeoutMs) })
        await res.body?.cancel()
      }
      if (res.status >= 400 && res.status < 500) dead.add(url)
    } catch {}
  }
  let next = 0
  const worker = async () => { while (next < todo.length) await check(todo[next++]!) }
  await Promise.all(Array.from({ length: Math.min(opts.concurrency ?? 16, todo.length) }, worker))
  return dead
}

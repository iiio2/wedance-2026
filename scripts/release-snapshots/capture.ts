/**
 * Release snapshots — full-page screenshots of key routes as visitors saw them.
 *
 *   bun scripts/release-snapshots/capture.ts --url=https://2026.wedance.vip --out=snapshots
 *
 * Runs after every production deploy (.github/workflows/release-snapshots.yml),
 * which attaches the output to a GitHub Release. Unlike the visual-regression
 * baselines in e2e/design (masked, overwritten), these keep real data and are
 * never overwritten: old Vercel deployments render today's database, so a
 * screenshot taken at release time is the only true record of what shipped.
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { chromium } from 'playwright'
import { SNAPSHOT_ROUTES, SNAPSHOT_VIEWPORTS } from './routes'

const args = Object.fromEntries(process.argv.slice(2).map((a) => {
  const [k, ...rest] = a.replace(/^--/, '').split('=')
  return [k, rest.length ? rest.join('=') : 'true']
})) as Record<string, string>

const BASE = (args.url ?? 'https://2026.wedance.vip').replace(/\/$/, '')
const OUT = args.out ?? 'snapshots'
mkdirSync(OUT, { recursive: true })

async function firstFestivalPath(): Promise<string | null> {
  try {
    const res = await fetch(`${BASE}/api/festivals`)
    const list = await res.json() as { slug: string }[]
    return list[0] ? `/festivals/${list[0].slug}` : null
  }
  catch { return null }
}

const festival = await firstFestivalPath()
const browser = await chromium.launch()
const results: { name: string, path: string, viewport: string, file?: string, height?: number, error?: string }[] = []

for (const vp of SNAPSHOT_VIEWPORTS) {
  const context = await browser.newContext({
    viewport: { width: vp.width, height: vp.height },
    deviceScaleFactor: vp.name === 'mobile' ? 2 : 1,
    reducedMotion: 'reduce',
  })
  for (const route of SNAPSHOT_ROUTES) {
    const path = route.path === 'festival' ? festival : route.path
    if (!path) { results.push({ name: route.name, path: route.path, viewport: vp.name, error: 'no festival to capture' }); continue }
    const page = await context.newPage()
    try {
      await page.goto(BASE + path, { waitUntil: 'load', timeout: 60_000 })
      // Scroll through once so lazy images and in-view content load, then settle.
      await page.evaluate(async () => {
        await document.fonts.ready
        for (let y = 0; y < document.body.scrollHeight; y += 700) {
          window.scrollTo(0, y)
          await new Promise(r => setTimeout(r, 150))
        }
        window.scrollTo(0, 0)
      })
      await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {})
      await page.waitForTimeout(1000)
      const height = await page.evaluate(() => document.documentElement.scrollHeight)
      // JPEG tops out at 65,535 px; very long pages (city directories at 2×) fall back to PNG.
      const tall = height * (vp.name === 'mobile' ? 2 : 1) > 60_000
      const file = `${route.name}-${vp.name}.${tall ? 'png' : 'jpg'}`
      await page.screenshot({ path: join(OUT, file), fullPage: true, ...(tall ? { type: 'png' as const } : { type: 'jpeg' as const, quality: 85 }) })
      results.push({ name: route.name, path, viewport: vp.name, file, height })
      console.log(`ok   ${vp.name.padEnd(7)} ${path}`)
    }
    catch (err) {
      results.push({ name: route.name, path, viewport: vp.name, error: (err as Error).message.split('\n')[0] })
      console.log(`FAIL ${vp.name.padEnd(7)} ${path}  ${(err as Error).message.split('\n')[0]}`)
    }
    await page.close()
  }
  await context.close()
}
await browser.close()

const manifest = { base: BASE, capturedAt: new Date().toISOString(), sha: process.env.GITHUB_SHA ?? null, results }
writeFileSync(join(OUT, 'manifest.json'), JSON.stringify(manifest, null, 2))

const ok = results.filter(r => r.file).length
const failed = results.filter(r => r.error)
writeFileSync(join(OUT, 'NOTES.md'), [
  `Full-page screenshots of ${BASE} right after this production deploy.`,
  '',
  `Captured ${manifest.capturedAt} — ${ok} screenshots${failed.length ? `, ${failed.length} failed` : ''}.`,
  '',
  '| Page | Path | Desktop | Mobile |',
  '|---|---|---|---|',
  ...SNAPSHOT_ROUTES.map((r) => {
    const d = results.find(x => x.name === r.name && x.viewport === 'desktop')
    const m = results.find(x => x.name === r.name && x.viewport === 'mobile')
    const cell = (x?: typeof d) => x?.file ? `\`${x.file}\`` : `failed${x?.error ? `: ${x.error.slice(0, 60)}` : ''}`
    return `| ${r.name} | \`${d?.path ?? r.path}\` | ${cell(d)} | ${cell(m)} |`
  }),
  '',
  'Archive only — real data, nothing masked. Visual-regression baselines live in e2e/design.',
].join('\n'))

console.log(`\n${ok}/${results.length} captured → ${OUT}`)
if (ok === 0) process.exit(1)

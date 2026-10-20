/**
 * Pushes one JSON log line per test to Grafana Cloud Loki, so test health
 * (flaky tests, pass rate, slow tests, failures per PR) is queryable over time
 * instead of living only in GitHub Actions logs (RAZ-631).
 *
 *   bun scripts/ci/loki-test-results.ts --suite vitest --file test-results/vitest.json
 *   bun scripts/ci/loki-test-results.ts --suite playwright-smoke --file test-results/playwright-smoke.json
 *
 * Reads LOKI_URL, LOKI_USER, LOKI_TOKEN. Never fails the build: missing secrets
 * (e.g. fork PRs), a missing results file or a Loki outage only print a warning.
 * Labels stay low-cardinality (service/repo/suite/event); per-run values such as
 * PR, SHA and test name go in the JSON line, where `| json` can filter on them.
 */
import { readFileSync, existsSync } from 'node:fs'

export type TestStatus = 'passed' | 'failed' | 'skipped' | 'flaky'

export interface TestRecord {
  file: string
  name: string
  status: TestStatus
  duration_ms: number
  retries: number
  error?: string
}

export interface RunMeta {
  sha?: string
  pr?: string
  branch?: string
  run_id?: string
  run_attempt?: string
  run_url?: string
}

const ERROR_MAX = 500

/** Makes an absolute runner path repo-relative: /home/runner/work/x/x/server/a.ts → server/a.ts */
export function relativeFile(path: string, cwd = process.cwd()): string {
  return path.startsWith(cwd + '/') ? path.slice(cwd.length + 1) : path
}

function shortError(messages: unknown): string | undefined {
  const text = (Array.isArray(messages) ? messages : [messages]).filter(Boolean).join('\n')
  // Strip ANSI colour codes so Grafana shows readable text.
  return text ? text.replace(/\u001b\[[0-9;]*m/g, '').slice(0, ERROR_MAX) : undefined
}

/** Vitest `--reporter=json` (Jest-compatible) → records. */
export function fromVitest(report: any, cwd = process.cwd()): TestRecord[] {
  const out: TestRecord[] = []
  for (const file of report?.testResults ?? []) {
    for (const t of file.assertionResults ?? []) {
      const status: TestStatus = t.status === 'passed' ? 'passed' : t.status === 'failed' ? 'failed' : 'skipped'
      out.push({
        file: relativeFile(file.name, cwd),
        name: t.fullName ?? t.title,
        status,
        duration_ms: Math.round(t.duration ?? 0),
        retries: Math.max(0, (t.retryCount ?? 0)),
        ...(status === 'failed' ? { error: shortError(t.failureMessages) } : {}),
      })
    }
  }
  return out
}

const PW_STATUS: Record<string, TestStatus> = {
  expected: 'passed',
  unexpected: 'failed',
  flaky: 'flaky',
  skipped: 'skipped',
}

/** Playwright `json` reporter → records (one per spec × project). */
export function fromPlaywright(report: any): TestRecord[] {
  const out: TestRecord[] = []
  const walk = (suite: any, titles: string[]) => {
    const path = suite.title ? [...titles, suite.title] : titles
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        const results = test.results ?? []
        const last = results[results.length - 1]
        const status = PW_STATUS[test.status] ?? 'skipped'
        out.push({
          file: spec.file ?? suite.file ?? '',
          name: [...path.slice(1), spec.title].join(' > ') + (test.projectName ? ` [${test.projectName}]` : ''),
          status,
          duration_ms: Math.round(results.reduce((sum: number, r: any) => sum + (r.duration ?? 0), 0)),
          retries: Math.max(0, results.length - 1),
          ...(status === 'failed' ? { error: shortError(last?.error?.message ?? last?.errors?.map((e: any) => e.message)) } : {}),
        })
      }
    }
    for (const child of suite.suites ?? []) walk(child, path)
  }
  for (const suite of report?.suites ?? []) walk(suite, [])
  return out
}

/**
 * Loki push body. Each line gets its own nanosecond timestamp (now + index) so
 * lines keep their order and two identical tests never collide.
 */
export function buildPushBody(records: TestRecord[], labels: Record<string, string>, meta: RunMeta, nowNs: bigint) {
  return {
    streams: [{
      stream: labels,
      values: records.map((r, i) => [String(nowNs + BigInt(i)), JSON.stringify({ ...r, ...meta })]),
    }],
  }
}

export function metaFromEnv(env: NodeJS.ProcessEnv = process.env): RunMeta {
  const runUrl = env.GITHUB_SERVER_URL && env.GITHUB_REPOSITORY && env.GITHUB_RUN_ID
    ? `${env.GITHUB_SERVER_URL}/${env.GITHUB_REPOSITORY}/actions/runs/${env.GITHUB_RUN_ID}`
    : undefined
  return {
    sha: env.GITHUB_SHA,
    pr: env.PR_NUMBER || undefined,
    branch: env.GITHUB_HEAD_REF || env.GITHUB_REF_NAME,
    run_id: env.GITHUB_RUN_ID,
    run_attempt: env.GITHUB_RUN_ATTEMPT,
    run_url: runUrl,
  }
}

const CHUNK = 500

async function main() {
  const arg = (name: string) => {
    const i = process.argv.indexOf(`--${name}`)
    return i > -1 ? process.argv[i + 1] : undefined
  }
  const suite = arg('suite')
  const file = arg('file')
  const { LOKI_URL, LOKI_USER, LOKI_TOKEN } = process.env
  const warn = (msg: string) => console.log(`::warning::loki-test-results: ${msg}`)

  if (!suite || !file) return warn('usage: --suite <name> --file <results.json>')
  if (!LOKI_URL || !LOKI_USER || !LOKI_TOKEN) return warn('LOKI_URL / LOKI_USER / LOKI_TOKEN not set, skipping')
  if (!existsSync(file)) return warn(`${file} not found (tests did not run?), skipping`)

  const report = JSON.parse(readFileSync(file, 'utf8'))
  const records = suite.startsWith('playwright') ? fromPlaywright(report) : fromVitest(report)
  if (!records.length) return warn(`${file} has no test results, skipping`)

  const labels = {
    service_name: 'ci-tests',
    repo: process.env.GITHUB_REPOSITORY?.split('/')[1] ?? 'wedance-2026',
    suite,
    event: process.env.GITHUB_EVENT_NAME ?? 'local',
  }
  const meta = metaFromEnv()
  const nowNs = BigInt(Date.now()) * 1_000_000n
  const auth = 'Basic ' + Buffer.from(`${LOKI_USER}:${LOKI_TOKEN}`).toString('base64')

  for (let i = 0; i < records.length; i += CHUNK) {
    const body = buildPushBody(records.slice(i, i + CHUNK), labels, meta, nowNs + BigInt(i))
    try {
      const res = await fetch(`${LOKI_URL.replace(/\/$/, '')}/loki/api/v1/push`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: auth },
        body: JSON.stringify(body),
      })
      if (!res.ok) return warn(`push failed: HTTP ${res.status} ${(await res.text()).slice(0, 300)}`)
    } catch (e) {
      return warn(`push failed: ${(e as Error).message}`)
    }
  }
  const count = (s: TestStatus) => records.filter(r => r.status === s).length
  console.log(`loki-test-results: pushed ${records.length} ${suite} results (passed ${count('passed')}, failed ${count('failed')}, flaky ${count('flaky')}, skipped ${count('skipped')})`)
}

if ((import.meta as any).main) await main()

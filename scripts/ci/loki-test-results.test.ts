/**
 * The Loki push turns raw reporter JSON into one log line per test (RAZ-631).
 * A wrong mapping here silently corrupts the Grafana dashboards, so the
 * reporter → record mapping is pinned against minimal real-shaped reports.
 */
import { describe, expect, it } from 'vitest'
import { buildPushBody, fromPlaywright, fromVitest, metaFromEnv, relativeFile } from './loki-test-results'

describe('relativeFile', () => {
  it('strips the runner checkout prefix', () => {
    expect(relativeFile('/home/runner/work/w/w/server/a.test.ts', '/home/runner/work/w/w')).toBe('server/a.test.ts')
  })
  it('leaves already-relative paths alone', () => {
    expect(relativeFile('e2e/features/auth.feature', '/repo')).toBe('e2e/features/auth.feature')
  })
})

describe('fromVitest', () => {
  const report = {
    testResults: [{
      name: '/repo/shared/utils/recurrence.test.ts',
      assertionResults: [
        { fullName: 'seriesDates weekly', status: 'passed', duration: 1.6 },
        { fullName: 'seriesDates count', status: 'failed', duration: 3, failureMessages: ['\u001b[31mExpected 3\u001b[39m'] },
        { fullName: 'seriesDates todo', status: 'pending' },
      ],
    }],
  }
  const records = fromVitest(report, '/repo')

  it('emits one record per test with a repo-relative file', () => {
    expect(records).toHaveLength(3)
    expect(records[0]).toEqual({ file: 'shared/utils/recurrence.test.ts', name: 'seriesDates weekly', status: 'passed', duration_ms: 2, retries: 0 })
  })
  it('keeps a readable error only on failures', () => {
    expect(records[1]).toMatchObject({ status: 'failed', error: 'Expected 3' })
    expect(records[0].error).toBeUndefined()
  })
  it('maps pending/todo to skipped', () => {
    expect(records[2].status).toBe('skipped')
  })
})

describe('fromPlaywright', () => {
  const report = {
    suites: [{
      title: 'auth-signup-signin.feature',
      file: 'auth-signup-signin.feature',
      suites: [{
        title: 'Sign up and sign in',
        specs: [
          { title: 'New dancer signs up', file: 'auth-signup-signin.feature', tests: [{ projectName: 'chromium', status: 'expected', results: [{ duration: 1200 }] }] },
          { title: 'Wrong password', file: 'auth-signup-signin.feature', tests: [{ projectName: 'chromium', status: 'flaky', results: [{ duration: 900, error: { message: 'timeout' } }, { duration: 800 }] }] },
          { title: 'Reset link', file: 'auth-signup-signin.feature', tests: [{ projectName: 'chromium', status: 'unexpected', results: [{ duration: 500, error: { message: 'boom' } }] }] },
        ],
      }],
    }],
  }
  const records = fromPlaywright(report)

  it('names tests by describe path + title + project, without the file suite', () => {
    expect(records[0].name).toBe('Sign up and sign in > New dancer signs up [chromium]')
  })
  it('maps expected/flaky/unexpected and counts retries', () => {
    expect(records.map(r => [r.status, r.retries])).toEqual([['passed', 0], ['flaky', 1], ['failed', 0]])
  })
  it('sums durations across retries and keeps the error of failures', () => {
    expect(records[1].duration_ms).toBe(1700)
    expect(records[2].error).toBe('boom')
  })
})

describe('buildPushBody', () => {
  it('builds one stream with ordered, unique nanosecond timestamps and run meta in each line', () => {
    const body = buildPushBody(
      [{ file: 'a', name: 'x', status: 'passed', duration_ms: 1, retries: 0 }, { file: 'a', name: 'y', status: 'failed', duration_ms: 2, retries: 0 }],
      { service_name: 'ci-tests', suite: 'vitest' },
      { sha: 'abc', pr: '12' },
      1_000n,
    )
    expect(body.streams).toHaveLength(1)
    expect(body.streams[0].stream).toEqual({ service_name: 'ci-tests', suite: 'vitest' })
    expect(body.streams[0].values.map(v => v[0])).toEqual(['1000', '1001'])
    expect(JSON.parse(body.streams[0].values[1][1])).toMatchObject({ name: 'y', status: 'failed', sha: 'abc', pr: '12' })
  })
})

describe('metaFromEnv', () => {
  it('prefers the PR head branch and builds the run URL', () => {
    const meta = metaFromEnv({ GITHUB_HEAD_REF: 'feat-x', GITHUB_REF_NAME: '12/merge', GITHUB_SERVER_URL: 'https://github.com', GITHUB_REPOSITORY: 'o/r', GITHUB_RUN_ID: '9', PR_NUMBER: '12' })
    expect(meta).toMatchObject({ branch: 'feat-x', pr: '12', run_url: 'https://github.com/o/r/actions/runs/9' })
  })
  it('leaves pr empty on push builds', () => {
    expect(metaFromEnv({ GITHUB_REF_NAME: 'main', PR_NUMBER: '' }).pr).toBeUndefined()
  })
})

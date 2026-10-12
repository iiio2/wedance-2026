/**
 * Every GitHub workflow must be valid YAML. An invalid file doesn't fail loudly —
 * GitHub just marks the run "workflow file issue" and runs nothing, which is how
 * CI silently skipped all tests 2026-10-10..12 (an inline `run:` with ": ").
 */
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parse } from 'yaml'

const dir = join(__dirname, '../../.github/workflows')
const files = readdirSync(dir).filter(f => /\.ya?ml$/.test(f))

describe('GitHub workflows', () => {
  it('exist', () => expect(files.length).toBeGreaterThan(0))
  for (const f of files) {
    it(`${f} is valid YAML with jobs`, () => {
      const doc = parse(readFileSync(join(dir, f), 'utf8'), { strict: true })
      expect(doc?.jobs, `${f} has no jobs`).toBeTruthy()
    })
  }
})

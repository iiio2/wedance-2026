import { readdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { SKETCHES } from './sketches'

const dir = resolve(__dirname, '../pages/sketches')
const onDisk = readdirSync(dir)
  .filter(f => f !== 'index.vue')
  .map(f => f.replace(/\.vue$/, ''))
  .sort()

describe('sketch registry', () => {
  it('has an entry for every sketch page or folder', () => {
    expect(SKETCHES.map(s => s.slug).sort()).toEqual(onDisk)
  })

  it('links every live sketch to its decision ticket', () => {
    const missing = SKETCHES.filter(s => s.status !== 'archived' && !s.ticket).map(s => s.slug)
    expect(missing).toEqual([])
  })

  it('records the decision once a sketch is decided or shipped', () => {
    const missing = SKETCHES.filter(s => (s.status === 'decided' || s.status === 'shipped') && !s.decision).map(s => s.slug)
    expect(missing).toEqual([])
  })
})

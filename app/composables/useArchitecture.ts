import type { Architecture } from '../../scripts/architecture/generate'
import meta from '~/generated/architecture/meta.json'
import data from '~/generated/architecture/data.json'
import api from '~/generated/architecture/api.json'
import stories from '~/generated/architecture/stories.json'
import decisions from '~/generated/architecture/decisions.json'

/**
 * The generated /docs/architecture data (scripts/architecture/generate.ts). These
 * JSON files are produced from the code on every prepare/dev/build and are
 * public — admin-level procedures are never in them (see /api/architecture/admin).
 */
export function useArchitecture() {
  return {
    meta: meta as Omit<Architecture['meta'], 'generatedAt'>,
    data: data as Architecture['data'],
    api: api as Architecture['api'],
    stories: stories as Architecture['stories'],
    decisions: decisions as Architecture['decisions'],
  }
}

export type ArchTable = Architecture['data']['tables'][number]
export type ArchProcedure = Architecture['api']['procedures'][number]

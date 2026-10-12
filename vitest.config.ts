import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'
import { loadEnv } from 'vite'

export default defineConfig({
  resolve: {
    alias: { '#shared': fileURLToPath(new URL('./shared', import.meta.url)) },
  },
  test: {
    include: ['server/**/*.test.ts', 'shared/**/*.test.ts', 'app/composables/**/*.test.ts', 'app/lib/**/*.test.ts', 'scripts/design-guardrails/**/*.test.ts', 'scripts/architecture/**/*.test.ts'],
    setupFiles: ['server/test-setup.ts'],
    env: loadEnv('', process.cwd(), ''),
    fileParallelism: false,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
})

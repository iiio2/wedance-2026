import { describe, it, expect } from 'vitest'
import { mcpApp } from './caller'

describe('mcpApp', () => {
  it('names the known apps from the User-Agent', () => {
    expect(mcpApp('openai-mcp/1.0.0 (+https://openai.com/bot)')).toBe('chatgpt')
    expect(mcpApp('Claude-User (claude-code/2.0; +https://www.anthropic.com)')).toBe('claude')
    expect(mcpApp('Cursor/1.7.0')).toBe('cursor')
    expect(mcpApp('Visual Studio Code/1.105.0')).toBe('vscode')
  })
  it('falls back to the OAuth client, then the first product token', () => {
    expect(mcpApp('node', 'https://claude.ai/oauth/mcp-oauth-client-metadata')).toBe('claude')
    expect(mcpApp(null, 'https://example-agent.dev/client.json')).toBe('example-agent.dev')
    expect(mcpApp('python-httpx/0.28.1', 'dcr_8f2a')).toBe('python-httpx')
    expect(mcpApp(undefined)).toBe('unknown')
  })
})

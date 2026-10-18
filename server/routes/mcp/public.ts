import { defineEventHandler } from 'h3'
import { handleAnonymous } from '../../mcp/http'

// Anonymous, read-only MCP: public events, festivals, venues and artists. Rate limited per IP.
export default defineEventHandler(handleAnonymous)

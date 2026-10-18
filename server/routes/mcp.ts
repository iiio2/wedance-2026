import { defineEventHandler } from 'h3'
import { handleAuthenticated } from '../mcp/http'

// The WeDance MCP server for signed-in assistants (OAuth 2.1, see /docs/connect-ai).
export default defineEventHandler(handleAuthenticated)

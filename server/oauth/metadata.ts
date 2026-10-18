import { PUBLIC_SCOPES, issuerFor, mcpResourceFor } from './config'

/** RFC 8414 authorization server metadata. */
export function authorizationServerMetadata(origin: string) {
  const issuer = issuerFor(origin)
  return {
    issuer,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    revocation_endpoint: `${origin}/oauth/revoke`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    revocation_endpoint_auth_methods_supported: ['none', 'client_secret_post', 'client_secret_basic'],
    scopes_supported: PUBLIC_SCOPES,
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    service_documentation: `${origin}/docs/connect-ai`,
  }
}

/** RFC 9728 protected resource metadata for the MCP endpoint. */
export function protectedResourceMetadata(origin: string) {
  return {
    resource: mcpResourceFor(origin),
    authorization_servers: [issuerFor(origin)],
    scopes_supported: PUBLIC_SCOPES,
    bearer_methods_supported: ['header'],
    resource_name: 'WeDance',
    resource_documentation: `${origin}/docs/mcp`,
  }
}

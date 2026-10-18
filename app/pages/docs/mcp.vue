<script setup lang="ts">
import { REPO_URL } from '~/lib/docs-nav'

definePageMeta({ layout: 'docs' })

const { data } = await useFetch('/api/mcp-tools', { key: 'mcp-tools' })

type Tool = NonNullable<typeof data.value>['tools'][number]
const group = (t: Tool) => t.scopes.includes('admin') ? 'Admin'
  : t.business ? 'Organizers, artists, promoters'
  : t.scopes.length ? 'Dancers'
  : 'Everyone (no sign-in)'
const groups = computed(() => {
  const order = ['Everyone (no sign-in)', 'Dancers', 'Organizers, artists, promoters', 'Admin']
  const by = new Map<string, Tool[]>(order.map(o => [o, []]))
  for (const t of data.value?.tools ?? []) by.get(group(t))!.push(t)
  return order.map(o => ({ title: o, tools: by.get(o)! })).filter(g => g.tools.length)
})

const endpoints = [
  ['MCP (signed in)', 'POST /mcp', 'Streamable HTTP, stateless, JSON responses. 401 + WWW-Authenticate without a valid token.'],
  ['MCP (anonymous)', 'POST /mcp/public', 'Public read tools only; rate limited per IP.'],
  ['Protected resource metadata', 'GET /.well-known/oauth-protected-resource/mcp', 'RFC 9728'],
  ['Authorization server metadata', 'GET /.well-known/oauth-authorization-server', 'RFC 8414'],
  ['Dynamic client registration', 'POST /oauth/register', 'RFC 7591; or use an https client_id (Client ID Metadata Document).'],
  ['Authorize', 'GET /oauth/authorize', 'Code flow, PKCE S256 required, resource (RFC 8707) required.'],
  ['Token', 'POST /oauth/token', 'authorization_code, refresh_token (rotating; reuse revokes the grant).'],
  ['Revoke', 'POST /oauth/revoke', 'RFC 7009'],
]

const inspector = `npx @modelcontextprotocol/inspector --cli https://2026.wedance.vip/mcp/public --method tools/list`
</script>

<template>
  <DesignPage
    eyebrow="Developers"
    site="WeDance Docs"
    title="MCP server reference"
    lead="One MCP server for dancers, organizers, artists and promoters. Every tool is a thin adapter over the same tRPC procedures the web app uses, so permissions and validation are identical."
  >
    <DesignSection id="endpoints" title="Endpoints">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-muted-foreground"><tr><th class="py-2 pr-4">What</th><th class="py-2 pr-4">Endpoint</th><th class="py-2">Notes</th></tr></thead>
          <tbody>
            <tr v-for="[what, path, note] in endpoints" :key="path" class="border-t border-border align-top">
              <td class="py-2 pr-4 font-bold">{{ what }}</td>
              <td class="py-2 pr-4"><code class="font-mono text-[13px] whitespace-nowrap">{{ path }}</code></td>
              <td class="py-2 text-muted-foreground">{{ note }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </DesignSection>

    <DesignSection id="rules" title="Rules every tool follows">
      <ul class="list-disc pl-5 space-y-2 text-muted-foreground">
        <li><strong class="text-foreground">Dynamic list.</strong> tools/list returns only what the token’s scopes allow; business tools also need at least one business page ticked on the consent screen.</li>
        <li><strong class="text-foreground">Enforced in tRPC, not only here.</strong> Each procedure declares its scope (<code class="font-mono text-[13px]">server/trpc/scopes.ts</code>, default deny), and the profile helpers check the granted pages.</li>
        <li><strong class="text-foreground">Two-step publishing.</strong> Tools marked “confirm” return a preview and a <code class="font-mono text-[13px]">confirm_token</code> (10 minutes, single use, bound to the connection, the tool and the arguments). Call again with it after the user agrees.</li>
        <li><strong class="text-foreground">User text is data.</strong> Free text written by people comes as <code class="font-mono text-[13px]">{"untrusted_text": …}</code> inside a <code class="font-mono text-[13px]">&lt;wedance-data&gt;</code> block.</li>
        <li><strong class="text-foreground">No payments.</strong> Ticket tools return a Stripe checkout link the person opens.</li>
        <li><strong class="text-foreground">Async flyers.</strong> make_flyer, flyer_variants and fix_flyer return a batch_id; poll flyer_status.</li>
        <li><strong class="text-foreground">Audited and rate limited.</strong> Every call is logged (input hash, never the input) and limited per connection; anonymous calls per IP.</li>
      </ul>
    </DesignSection>

    <DesignSection id="scopes" title="Scopes">
      <dl class="grid gap-2">
        <div v-for="s in data?.scopes ?? []" :key="s.id" class="grid sm:grid-cols-[10rem_1fr] gap-1">
          <dt><code class="font-mono text-[13px] font-bold">{{ s.id }}</code></dt>
          <dd class="text-sm text-muted-foreground">{{ s.detail }}</dd>
        </div>
      </dl>
      <p class="text-sm text-muted-foreground mt-3">business:publish ⊃ business:write ⊃ business:read. <code class="font-mono text-[13px]">admin</code> exists only for WeDance admins on an allowlisted app and is never offered publicly.</p>
    </DesignSection>

    <DesignSection v-for="g in groups" :id="g.title.toLowerCase().replace(/[^a-z]+/g, '-')" :key="g.title" :title="`Tools: ${g.title}`">
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead class="text-left text-muted-foreground"><tr><th class="py-2 pr-4">Tool</th><th class="py-2 pr-4">What it does</th><th class="py-2">Needs</th></tr></thead>
          <tbody>
            <tr v-for="t in g.tools" :key="t.name" class="border-t border-border align-top">
              <td class="py-2 pr-4">
                <code class="font-mono text-[13px] font-bold">{{ t.name }}</code>
                <div class="text-meta text-muted-foreground">{{ t.args.join(', ') || 'no arguments' }}</div>
              </td>
              <td class="py-2 pr-4 text-muted-foreground">{{ t.description }}</td>
              <td class="py-2 whitespace-nowrap text-meta">
                <div v-for="s in t.scopes" :key="s"><code class="font-mono">{{ s }}</code></div>
                <div v-if="!t.scopes.length" class="text-muted-foreground">nothing</div>
                <div v-if="t.confirm" class="text-wd-red-800 font-bold">confirm {{ t.confirm === 'always' ? '' : '(when public)' }}</div>
                <div v-if="t.readOnly" class="text-muted-foreground">read-only</div>
                <div v-else-if="t.destructive" class="text-muted-foreground">destructive</div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </DesignSection>

    <DesignSection id="resources" title="Resources and prompts">
      <ul class="list-disc pl-5 space-y-1 text-muted-foreground">
        <li><code class="font-mono text-[13px]">wedance://city/{slug}/events</code>, <code class="font-mono text-[13px]">wedance://event/{id}</code>, <code class="font-mono text-[13px]">wedance://profile/{handle}</code></li>
        <li>Prompts: <code class="font-mono text-[13px]">plan_my_weekend</code>, <code class="font-mono text-[13px]">prepare_festival_trip</code>; with business scopes also <code class="font-mono text-[13px]">promote_my_event</code>, <code class="font-mono text-[13px]">weekly_class_update</code>.</li>
      </ul>
    </DesignSection>

    <DesignSection id="try" title="Try it">
      <DesignCode :code="inspector" lang="bash" />
      <p class="text-sm text-muted-foreground mt-3">
        Code: <a :href="`${REPO_URL}/tree/main/server/mcp`" class="font-bold text-wd-red-800 hover:underline">server/mcp</a> (tools, server),
        <a :href="`${REPO_URL}/tree/main/server/oauth`" class="font-bold text-wd-red-800 hover:underline">server/oauth</a> (authorization server).
        Design: <a :href="`${REPO_URL}/blob/main/docs/proposals/2026-10-18-mcp-server.md`" class="font-bold text-wd-red-800 hover:underline">docs/proposals/2026-10-18-mcp-server.md</a>.
      </p>
    </DesignSection>
  </DesignPage>
</template>

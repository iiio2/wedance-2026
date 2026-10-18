<script setup lang="ts">
definePageMeta({ layout: 'docs' })

// The connector URL is the site's own /mcp (the OAuth resource).
const origin = useRequestURL().origin.includes('localhost') ? useRequestURL().origin : 'https://2026.wedance.vip'
const mcpUrl = `${origin}/mcp`
const publicUrl = `${origin}/mcp/public`

const { data } = await useFetch('/api/mcp-tools', { key: 'mcp-tools' })

const claudeCode = `claude mcp add --transport http wedance ${mcpUrl}`
const chatgptSteps = [
  'Settings → Apps & Connectors → Advanced settings: turn on Developer mode.',
  'Back in Apps & Connectors, choose Create.',
  `Name it WeDance, paste ${mcpUrl} as the MCP server URL, authentication OAuth.`,
  'Sign in to WeDance in the window that opens and choose what ChatGPT may do.',
]
const claudeSteps = [
  'Claude (web or desktop): Settings → Connectors → Add custom connector.',
  `Name it WeDance and paste ${mcpUrl}.`,
  'Click Connect, sign in to WeDance, and choose what Claude may do and for which of your pages.',
  'In a chat, turn WeDance on in the tools menu and ask: “What’s on in Munich this weekend?”',
]
const examples = [
  { who: 'Dancers', asks: ['What salsa parties are on in Munich this weekend?', 'Add the Thursday party to my plan and show me who else is going.', 'Find me a ride to Meneate Viena.'] },
  { who: 'Organizers', asks: ['Put our Sunday taster class on WeDance for 18:00 at Buena Vista.', 'Make the flyer and write the Instagram captions.', 'Invite @felix as guest teacher on the 25th.'] },
  { who: 'Artists', asks: ['Show my booking requests.', 'Which events am I in next month?', 'Approve the photos the organizer suggested.'] },
]
</script>

<template>
  <DesignPage
    eyebrow="Connect"
    site="WeDance Docs"
    title="Connect WeDance to Claude or ChatGPT"
    lead="Ask your assistant what’s on, plan your nights, or run your events, with your WeDance account behind it. You choose what it may do, and you can disconnect it any time."
  >
    <DesignSection id="url" title="The connector URL">
      <DesignCode :code="mcpUrl" lang="text" />
      <p class="text-sm text-muted-foreground mt-3">
        This is a remote MCP server (Model Context Protocol). Your assistant signs you in to WeDance the first time
        (OAuth); it never sees your password. Without an account, <code class="font-mono text-[13px]">{{ publicUrl }}</code>
        answers public questions (events, festivals, venues, artists) without signing in.
      </p>
    </DesignSection>

    <DesignSection id="claude" title="Claude">
      <ol class="list-decimal pl-5 space-y-2 text-muted-foreground">
        <li v-for="s in claudeSteps" :key="s">{{ s }}</li>
      </ol>
      <p class="text-sm text-muted-foreground mt-4 mb-2">Claude Code:</p>
      <DesignCode :code="claudeCode" lang="bash" />
    </DesignSection>

    <DesignSection id="chatgpt" title="ChatGPT">
      <ol class="list-decimal pl-5 space-y-2 text-muted-foreground">
        <li v-for="s in chatgptSteps" :key="s">{{ s }}</li>
      </ol>
      <p class="text-sm text-muted-foreground mt-3">Connectors need a ChatGPT plan that allows custom apps.</p>
    </DesignSection>

    <DesignSection id="permissions" title="What the permissions mean" lead="On the sign-in screen every permission has its own tick box. Untick what you don’t want.">
      <dl class="grid gap-3">
        <div v-for="s in data?.scopes ?? []" :key="s.id" class="rounded-2xl border border-border bg-card p-4">
          <dt class="font-bold">{{ s.title }} <code class="ml-1 font-mono text-[12px] text-muted-foreground">{{ s.id }}</code></dt>
          <dd class="text-sm text-muted-foreground mt-1">{{ s.detail }}</dd>
        </div>
      </dl>
      <p class="text-sm text-muted-foreground mt-4">
        <strong class="text-foreground">Business pages.</strong> If you run pages on WeDance (a school, a party, an artist page), you also
        tick which of them the assistant may work on. It can’t see or change the others.
      </p>
      <p class="text-sm text-muted-foreground mt-2">
        <strong class="text-foreground">Nothing goes public behind your back.</strong> Publishing an event, inviting an artist, answering
        an invite or changing your team always comes back to you as a preview first; the assistant acts only after you say yes.
        Ticket purchases only ever give you a Stripe link to pay yourself.
      </p>
    </DesignSection>

    <DesignSection id="examples" title="Things to ask">
      <div class="grid sm:grid-cols-3 gap-3">
        <div v-for="e in examples" :key="e.who" class="rounded-2xl border border-border bg-card p-4">
          <div class="text-eyebrow uppercase tracking-[0.3em] font-bold text-secondary">{{ e.who }}</div>
          <ul class="mt-2 space-y-2 text-sm">
            <li v-for="a in e.asks" :key="a">“{{ a }}”</li>
          </ul>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="disconnect" title="Disconnect">
      <p class="text-muted-foreground">
        <NuxtLink to="/settings/connections" class="font-bold text-wd-red-800 hover:underline">Settings → Connected apps</NuxtLink>
        lists every assistant you connected, what it may do, for which pages, and when it was last used. Revoke ends its access at once.
      </p>
    </DesignSection>

    <DesignSection id="developers" title="For developers">
      <p class="text-muted-foreground">
        The full tool list, OAuth endpoints and rules are on <NuxtLink to="/docs/mcp" class="font-bold text-wd-red-800 hover:underline">MCP server reference</NuxtLink>.
      </p>
    </DesignSection>
  </DesignPage>
</template>

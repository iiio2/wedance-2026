<script setup lang="ts">
definePageMeta({ layout: 'docs' })

// Tokens live in app/assets/css/tailwind.css (--wd-duration-*, --wd-ease-*).
const durations = [
  { name: 'Instant', token: '--wd-duration-instant', cls: 'duration-wd-instant', ms: '80ms', use: 'Press feedback (active state)' },
  { name: 'Quick', token: '--wd-duration-quick', cls: 'duration-wd-quick', ms: '150ms', use: 'Colour and border changes on hover. Same as Tailwind’s default transition duration.' },
  { name: 'Standard', token: '--wd-duration-standard', cls: 'duration-wd-standard', ms: '220ms', use: 'Lift, scale, small movements' },
  { name: 'Slow', token: '--wd-duration-slow', cls: 'duration-wd-slow', ms: '380ms', use: 'Ripples, entrances, panels opening' },
]

const easings = [
  { name: 'Spring', token: '--wd-ease-spring', cls: 'ease-wd-spring', css: 'cubic-bezier(0.34, 1.56, 0.64, 1)', use: 'Playful overshoot — lifts and pops' },
  { name: 'Out', token: '--wd-ease-out', cls: 'ease-wd-out', css: 'ease-out', use: 'Things arriving or settling. The CSS keyword, not Tailwind’s ease-out curve.' },
  { name: 'In-out', token: '--wd-ease-in-out', cls: 'ease-wd-in-out', css: 'ease-in-out', use: 'Loops that go back and forth' },
]

const usage = `<!-- Tailwind -->
<button class="transition-transform duration-wd-standard ease-wd-spring hover:-translate-y-0.5">…</button>
<a class="transition-colors duration-wd-quick hover:text-primary">…</a>

/* CSS */
.thing {
  transition: transform var(--wd-duration-standard) var(--wd-ease-spring);
}
.thing:active { transition-duration: var(--wd-duration-instant); }`

const reduced = `@media (prefers-reduced-motion: reduce) {
  .wd-cta,
  .wd-cta::before {
    animation: none !important;
  }
}

<!-- Tailwind -->
<div class="transition-transform duration-wd-standard motion-reduce:transition-none">…</div>`

// Replays the demo bars when clicked.
const playing = ref(false)
function play() {
  playing.value = false
  requestAnimationFrame(() => requestAnimationFrame(() => (playing.value = true)))
}
</script>

<template>
  <DesignPage
    eyebrow="Foundations"
    title="Motion"
    status="stable"
    lead="Motion should feel like a dancer’s bounce — quick, springy, never slow or floaty. It confirms what happened; it never makes you wait."
  >
    <DesignSection id="principles" title="Principles">
      <ul class="grid sm:grid-cols-3 gap-4">
        <li class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Feedback first</h3>
          <p class="text-sm text-muted-foreground mt-1">Animate the result of an action — a press, a save, a selection. Don’t animate to decorate.</p>
        </li>
        <li class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">One showpiece per screen</h3>
          <p class="text-sm text-muted-foreground mt-1">Ambient loops (breathing, shimmer) belong to the single main CTA. Everything else stays still at rest.</p>
        </li>
        <li class="rounded-2xl border border-border bg-card p-5">
          <h3 class="font-display font-bold text-lg">Respect reduced motion</h3>
          <p class="text-sm text-muted-foreground mt-1">Every loop and large movement switches off under prefers-reduced-motion.</p>
        </li>
      </ul>
    </DesignSection>

    <DesignSection id="showcase" title="The brand CTA" lead="Hover, press and watch: breathing gradient, shimmer sweep, springy lift, press-down and a click ripple — all from one class. Its timings use the tokens below.">
      <DesignExample code='<button class="wd-cta inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-bold uppercase tracking-wider">
  Find your next festival
</button>' center>
        <button type="button" class="wd-cta inline-flex items-center gap-2 px-6 py-3 rounded-full text-white text-sm font-bold uppercase tracking-wider">
          Find your next festival
        </button>
      </DesignExample>
    </DesignSection>

    <DesignSection id="durations" title="Durations" lead="Four steps. Anything longer than slow is either an ambient loop (only on the brand CTA) or a bug.">
      <div class="rounded-2xl border border-border bg-card divide-y divide-border">
        <div v-for="d in durations" :key="d.name" class="grid sm:grid-cols-[6rem_4rem_1fr_1fr] gap-x-4 gap-y-1 px-5 py-3 text-sm items-baseline">
          <span class="font-bold">{{ d.name }}</span>
          <code class="font-mono text-secondary">{{ d.ms }}</code>
          <span class="min-w-0">
            <code class="block font-mono text-[12px]">{{ d.cls }}</code>
            <code class="block font-mono text-[12px] text-muted-foreground">var({{ d.token }})</code>
          </span>
          <span class="text-muted-foreground">{{ d.use }}</span>
        </div>
      </div>
      <p class="text-sm text-muted-foreground mt-3">Ambient loops on the brand CTA run 4.5–6s and the gradient shift 800ms; they stay literal inside <code class="font-mono text-[13px]">.wd-cta</code> because nothing else should use them.</p>
    </DesignSection>

    <DesignSection id="easing" title="Easing">
      <div class="rounded-2xl border border-border bg-card divide-y divide-border">
        <div v-for="e in easings" :key="e.name" class="grid sm:grid-cols-[6rem_1fr_1fr] gap-x-4 gap-y-1 px-5 py-3 text-sm items-baseline">
          <span class="font-bold">{{ e.name }}</span>
          <span class="min-w-0">
            <code class="block font-mono text-[12px]">{{ e.cls }}</code>
            <code class="block font-mono text-[12px] text-muted-foreground">var({{ e.token }}) · {{ e.css }}</code>
          </span>
          <span class="text-muted-foreground">{{ e.use }}</span>
        </div>
      </div>
    </DesignSection>

    <DesignSection id="compare" title="See them side by side" lead="Each dot travels the same distance with a different duration and the spring easing.">
      <div class="rounded-2xl border border-border bg-card p-5 space-y-3">
        <div v-for="d in durations" :key="d.name" class="grid grid-cols-[5rem_1fr] items-center gap-3">
          <span class="text-xs font-bold">{{ d.name }}</span>
          <div class="relative h-6 rounded-full bg-muted">
            <span
              class="absolute top-1 left-1 w-4 h-4 rounded-full bg-primary transition-transform ease-wd-spring motion-reduce:transition-none"
              :class="d.cls"
              :style="playing ? { transform: 'translateX(min(16rem, 55vw))' } : undefined"
            />
          </div>
        </div>
        <button type="button" class="mt-2 inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-bold hover:bg-accent transition-colors duration-wd-quick" @click="play">
          Play
        </button>
      </div>
    </DesignSection>

    <DesignSection id="usage" title="Using the tokens">
      <DesignCode :code="usage" lang="html" />
    </DesignSection>

    <DesignSection id="reduced-motion" title="Reduced motion" lead="Required for every looping or large animation.">
      <DesignCode :code="reduced" lang="css" />
    </DesignSection>
  </DesignPage>
</template>

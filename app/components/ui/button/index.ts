import type { VariantProps } from "class-variance-authority"
import { cva } from "class-variance-authority"

export { default as Button } from "./Button.vue"

/*
 * Brand variants (cta, pill, soft, outline-pill) and the pill-sm / icon-round sizes
 * cover the looks pages used to hand-roll on raw <button>s (survey 2026-10-10, 255
 * raw buttons in 55 product files): red→orange gradient pill ≈28, solid red pill with
 * a lip shadow ≈10, soft tinted pill 12, white outline pill 14, small uppercase pill 39,
 * round icon-only buttons. Docs + decision guide: /docs/design/components/button.
 *
 * Brand pills share BRAND: rounded-full, bold, uppercase, tracked. Size classes carry
 * no rounding so a variant's rounded-full survives tailwind-merge.
 */
const BRAND = "rounded-full font-bold uppercase tracking-wider transition-all"

export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-45 disabled:saturate-50 disabled:shadow-none disabled:transform-none aria-busy:cursor-progress aria-busy:opacity-80! aria-busy:saturate-100! [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 disabled:hover:bg-primary",
        // Outlined so it never reads as the (also red) primary; fills on hover.
        destructive:
          "border border-destructive bg-background text-wd-red-800 hover:bg-destructive hover:text-destructive-foreground disabled:hover:bg-background disabled:hover:text-wd-red-800",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-wd-red-800 underline-offset-4 hover:underline",

        // ── Brand ──────────────────────────────────────────────────────────
        // The one hero action per screen. Global .wd-cta (tailwind.css) brings the
        // breathing gradient, shimmer, lift, press and ripple; disabled freezes it.
        cta: `wd-cta text-white ${BRAND} disabled:animate-none disabled:before:hidden`,
        // Solid primary with the brand lip — the primary action inside cards, forms, modals.
        pill: `bg-primary text-primary-foreground shadow-[0_3px_0_-1px_var(--wd-red-800)] hover:bg-primary/92 enabled:hover:-translate-y-px enabled:active:translate-y-px enabled:active:shadow-[0_1px_0_-1px_var(--wd-red-800)] disabled:hover:bg-primary ${BRAND}`,
        // Tinted primary — secondary actions that should still feel warm.
        soft: `bg-primary/8 text-wd-red-800 hover:bg-primary/15 disabled:hover:bg-primary/8 ${BRAND}`,
        // White pill, coloured border — the alternative next to a cta or pill.
        "outline-pill": `border-2 border-primary/30 bg-card text-wd-red-800 hover:border-primary hover:bg-primary/5 disabled:hover:border-primary/30 disabled:hover:bg-card ${BRAND}`,
      },
      size: {
        "default": "h-10 px-4 py-2",
        "sm": "h-9 px-3",
        "lg": "h-11 px-8",
        "icon": "h-10 w-10",
        "icon-sm": "size-9",
        "icon-lg": "size-11",
        // Small uppercase pill — inline card actions, filters, "Ask locals".
        "pill-sm": "h-8 px-4 text-xs rounded-full font-bold uppercase tracking-wider",
        // Round icon-only button (favourite, share, close on media).
        "icon-round": "size-11 rounded-full",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export type ButtonVariants = VariantProps<typeof buttonVariants>

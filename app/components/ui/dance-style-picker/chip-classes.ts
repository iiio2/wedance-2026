import { cn } from '@/lib/utils'

/** Size/type of a selectable dance-style chip — shared by DanceStylePicker and DanceStyleFilter. */
export const danceStyleChipClass = 'px-3 py-1.5 text-xs uppercase tracking-wider font-sans'

/** The disclosure button ("All N styles", "+N more"): dashed outline, so it never reads as a style. */
export const danceStyleMoreClass = cn(
  'inline-flex items-center rounded-full font-bold border border-dashed border-input bg-card text-foreground hover:border-foreground/40 cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:cursor-not-allowed disabled:opacity-50',
  danceStyleChipClass,
)

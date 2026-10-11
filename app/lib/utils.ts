import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// text-eyebrow / text-meta / text-tag are font-size tokens (@theme --text-*). Without this,
// tailwind-merge reads them as text colours: `text-meta text-secondary` on a <Button> drops
// text-meta, and `text-meta` alone keeps the base text-sm alongside it.
const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['eyebrow', 'meta', 'tag'] }] } },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

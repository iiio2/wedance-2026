/** An icon per section kind of a profile's website, shared by the outline and the picker. */
import { PanelTop, AlignLeft, LayoutGrid, CalendarDays, CircleHelp, Youtube, UserRound, MapPin, ClipboardList, MousePointerClick } from 'lucide-vue-next'
import type { SectionKind } from '#shared/types/profileSite'

export const KIND_ICONS: Record<SectionKind, any> = {
  hero: PanelTop, text: AlignLeft, cards: LayoutGrid, events: CalendarDays, faq: CircleHelp,
  video: Youtube, person: UserRound, location: MapPin, signup: ClipboardList, cta: MousePointerClick,
}

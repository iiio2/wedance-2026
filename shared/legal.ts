/**
 * The operator of WeDance, used by the imprint, privacy policy and terms.
 * Today WeDance is run by Aleksey Razbakov as a sole trader
 * (Einzelunternehmen, Kleinunternehmer §19 UStG). When the UG is registered,
 * change it here (name, legal form, register, VAT) and every legal page follows.
 */
export const OPERATOR = {
  name: 'Aleksey Razbakov',
  tradeName: 'WeDance',
  legalForm: 'Sole trader (Einzelunternehmen)',
  street: 'Adalbertstr. 41a',
  postalCode: '80799',
  city: 'München',
  country: 'Germany',
  email: 'hello@wedance.vip',
  website: 'https://2026.wedance.vip',
} as const

export const OPERATOR_ADDRESS = `${OPERATOR.street}, ${OPERATOR.postalCode} ${OPERATOR.city}, ${OPERATOR.country}`

/** Shown as "Last updated" on the legal pages. Change it with any content change. */
export const LEGAL_UPDATED = '6 November 2026'

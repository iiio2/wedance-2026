/**
 * Google Places (legacy web service) — the two calls the city picker needs,
 * also used for venues (hangout "Where?", types=establishment, biased to a city).
 *
 *   autocomplete  /maps/api/place/autocomplete/json  types=(cities), language=en
 *   details       /maps/api/place/details/json       fields=place_id,name,address_components,geometry,formatted_address
 *
 * Server-side only: the key never reaches the browser. Both calls carry the
 * same `sessiontoken`, so a typing session that ends in one Details call is
 * billed as one Autocomplete session (autocomplete requests inside it are not
 * billed per request). Framework-free on purpose — scripts/cities/backfill.ts
 * imports it outside Nuxt. `fetch` is injectable for tests.
 */

const BASE = 'https://maps.googleapis.com/maps/api/place'

export interface PlacePrediction {
  placeId: string
  /** "Munich" */
  mainText: string
  /** "Germany" / "Bavaria, Germany" */
  secondaryText: string
  description: string
  types: string[]
  /**
   * Did Google match the query against the (English) text? false = it matched
   * through another name of the place — "Мюнх" → Munich — which is the only
   * case where the typed query is worth remembering as a spelling. ("Berchtesg"
   * → Anger matches the region text, so it must not become an alt name of Anger.)
   */
  matchedText: boolean
}

export interface AddressComponent { long_name: string, short_name: string, types: string[] }

export interface PlaceDetails {
  placeId: string
  name: string
  addressComponents: AddressComponent[]
  /** "Neuhauser Str. 47, 80331 München, Germany" */
  formattedAddress?: string
  lat: number | null
  lng: number | null
}

export interface PlacesClient {
  autocomplete(input: string, opts: AutocompleteOptions): Promise<PlacePrediction[]>
  details(placeId: string, opts: { sessionToken?: string, language?: string }): Promise<PlaceDetails | null>
  /** Calls made since creation — the backfill reports it. */
  readonly calls: number
}

export interface AutocompleteOptions {
  sessionToken?: string
  language?: string
  /** Places types filter. Default '(cities)'; 'establishment' for venues. */
  types?: string
  /** Bias results around a point (radius in metres). */
  near?: { lat: number, lng: number, radius: number }
}

export class PlacesError extends Error {
  constructor(public status: string, message?: string) {
    super(`Google Places ${status}${message ? `: ${message}` : ''}`)
  }
}

export function createPlacesClient(apiKey: string, fetchImpl: typeof fetch = fetch): PlacesClient {
  let calls = 0
  async function get(path: string, params: Record<string, string | undefined>) {
    const url = new URL(`${BASE}/${path}/json`)
    for (const [k, v] of Object.entries(params)) if (v) url.searchParams.set(k, v)
    url.searchParams.set('key', apiKey)
    calls++
    const res = await fetchImpl(url.toString())
    if (!res.ok) throw new PlacesError(`HTTP_${res.status}`)
    const body = await res.json() as { status: string, error_message?: string, predictions?: any[], result?: any }
    if (body.status === 'ZERO_RESULTS') return body
    // Never echo the URL — it carries the key.
    if (body.status !== 'OK') throw new PlacesError(body.status, body.error_message)
    return body
  }

  return {
    get calls() { return calls },
    async autocomplete(input, { sessionToken, language = 'en', types = '(cities)', near }) {
      const body = await get('autocomplete', {
        input,
        types,
        language,
        sessiontoken: sessionToken,
        location: near ? `${near.lat},${near.lng}` : undefined,
        radius: near ? String(near.radius) : undefined,
      })
      return (body.predictions ?? []).map((p: any): PlacePrediction => ({
        placeId: p.place_id,
        mainText: p.structured_formatting?.main_text ?? p.terms?.[0]?.value ?? p.description,
        secondaryText: p.structured_formatting?.secondary_text ?? '',
        description: p.description ?? '',
        types: p.types ?? [],
        matchedText: (p.matched_substrings?.length ?? 0) > 0
          || (p.structured_formatting?.main_text_matched_substrings?.length ?? 0) > 0,
      }))
    },
    async details(placeId, { sessionToken, language = 'en' }) {
      const body = await get('details', {
        place_id: placeId,
        fields: 'place_id,name,address_components,geometry,formatted_address',
        language,
        sessiontoken: sessionToken,
      })
      const r = body.result
      if (!r) return null
      return {
        placeId: r.place_id ?? placeId,
        name: r.name ?? '',
        addressComponents: r.address_components ?? [],
        formattedAddress: r.formatted_address ?? '',
        lat: r.geometry?.location?.lat ?? null,
        lng: r.geometry?.location?.lng ?? null,
      }
    },
  }
}

export function component(d: PlaceDetails, type: string): AddressComponent | undefined {
  return d.addressComponents.find(c => c.types.includes(type))
}

/** The city's own name in a Details result: the place name, else locality / postal town. */
export function placeCityName(d: PlaceDetails): string {
  return (d.name || component(d, 'locality')?.long_name || component(d, 'postal_town')?.long_name
    || component(d, 'administrative_area_level_3')?.long_name || '').trim()
}

/** Country of a Places prediction: the last comma-separated term ("Bavaria, Germany" → "Germany"). */
export function predictionCountry(p: PlacePrediction): string | null {
  const parts = p.secondaryText.split(',').map(s => s.trim()).filter(Boolean)
  return parts.at(-1) ?? null
}

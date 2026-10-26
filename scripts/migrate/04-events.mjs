import { neon } from '@neondatabase/serverless'
const v4 = neon(process.env.DIRECT_URL_V4), tgt = neon(process.env.DATABASE_URL)
const DRY = process.argv.includes('--dry-run')
const arr = (r) => r.rows ?? r
const rows = arr(await v4.query(`
  SELECT e.id eid, e."shortId" sid, e.slug, e.name, e.type, e.description, e.cover, e.price,
         e."startDate" sd, e."endDate" ed, e."ticketUrl" turl, e."firebaseId" fbid,
         v.username venue_u, o.username org_u, c.name city
  FROM "Event" e
  LEFT JOIN "Profile" v ON v.id = e."venueId"
  LEFT JOIN "Profile" o ON o.id = e."organizerId"
  LEFT JOIN "City" c ON c.id = v."cityId"
  WHERE e.published = true
`))
// dedup by effective slug
const seen = new Set(); const list = []
for (const e of rows) {
  let s = (e.slug && e.slug.trim()) ? e.slug.trim() : `ev-${e.sid || e.eid.slice(0,8)}`
  if (seen.has(s)) s = `${s}-${e.eid.slice(0,6)}`
  if (seen.has(s)) continue
  seen.add(s); e._slug = s; list.push(e)
}
const isFest = (e) => !!(e.sd && e.ed && new Date(e.ed) > new Date(new Date(e.sd).getTime()+86400000))
let inserted=0, updated=0
const CH=500
for(let i=0;i<list.length;i+=CH){
  const b=list.slice(i,i+CH)
  const C={slug:[],name:[],type:[],desc:[],cover:[],sd:[],ed:[],fest:[],turl:[],price:[],city:[],vu:[],ou:[],sref:[]}
  for(const e of b){
    C.slug.push(e._slug); C.name.push(e.name||'Untitled event'); C.type.push(e.type||'Party')
    C.desc.push(e.description||''); C.cover.push(e.cover||''); C.sd.push(e.sd?new Date(e.sd).toISOString():null)
    C.ed.push(e.ed?new Date(e.ed).toISOString():null); C.fest.push(isFest(e)); C.turl.push(e.turl||null)
    C.price.push(e.price||''); C.city.push(e.city||null); C.vu.push(e.venue_u||null); C.ou.push(e.org_u||null)
    C.sref.push(JSON.stringify({v4EventId:e.eid, firebaseId:e.fbid||null}))
  }
  if(DRY){inserted+=b.length;continue}
  const q2=`INSERT INTO events (slug,name,type,description,cover,start_date,end_date,is_festival,ticket_url,price,city,venue_username,organizer_username,archived,published,source_ref)
    SELECT slug,name,type,description,cover,sd,ed,fest,turl,price,city,vu,ou,true,false,sref FROM unnest(
      $1::text[],$2::text[],$3::text[],$4::text[],$5::text[],$6::timestamp[],$7::timestamp[],$8::boolean[],$9::text[],$10::text[],$11::text[],$12::text[],$13::text[],$14::jsonb[]
    ) AS t(slug,name,type,description,cover,sd,ed,fest,turl,price,city,vu,ou,sref)
    ON CONFLICT (slug) WHERE slug IS NOT NULL DO UPDATE SET name=EXCLUDED.name, start_date=EXCLUDED.start_date, end_date=EXCLUDED.end_date, is_festival=EXCLUDED.is_festival, ticket_url=EXCLUDED.ticket_url, venue_username=EXCLUDED.venue_username, organizer_username=EXCLUDED.organizer_username, source_ref=EXCLUDED.source_ref
    RETURNING (xmax=0) AS is_insert`
  const res=arr(await tgt.query(q2,[C.slug,C.name,C.type,C.desc,C.cover,C.sd,C.ed,C.fest,C.turl,C.price,C.city,C.vu,C.ou,C.sref]))
  for(const r of res)(r.is_insert?inserted++:updated++)
  process.stderr.write(`  …${Math.min(i+CH,list.length)}/${list.length}\n`)
}
const tot=arr(await tgt.query(`SELECT count(*)::int n FROM events WHERE source_ref IS NOT NULL`))[0].n
const fest=arr(await tgt.query(`SELECT count(*)::int n FROM events WHERE source_ref IS NOT NULL AND is_festival`))[0].n
const arch=arr(await tgt.query(`SELECT count(*)::int n FROM events WHERE source_ref IS NOT NULL AND archived AND NOT published`))[0].n
console.log(JSON.stringify({mode:DRY?'DRY':'WRITE',source_rows:list.length,inserted,updated,total_migrated:tot,as_festival:fest,archived_hidden:arch},null,2))

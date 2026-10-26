import { neon } from '@neondatabase/serverless'
const v4 = neon(process.env.DIRECT_URL_V4), tgt = neon(process.env.DATABASE_URL)
const arr = (r) => r.rows ?? r
// follower profile → owning userId; following profile → username
const rows = arr(await v4.query(`
  SELECT fu."userId" follower_user, fo.username target_username
  FROM "ProfileFollower" pf
  JOIN "Profile" fu ON fu.id = pf."followerId"
  JOIN "Profile" fo ON fo.id = pf."profileId"
  WHERE fu."userId" IS NOT NULL AND fo.username <> ''
`))
// map v4 userId -> 2026 dancer id via source_ref
const dmap = new Map(arr(await tgt.query(`SELECT id, source_ref->>'v4UserId' v4u FROM dancers WHERE source_ref ? 'v4UserId'`)).map(r=>[r.v4u, r.id]))
const pairs = []
for (const r of rows) { const fid = dmap.get(r.follower_user); if (fid) pairs.push([fid, r.target_username]) }
// dedup
const seen = new Set(); const list = pairs.filter(([f,t])=>{const k=f+'|'+t; if(seen.has(k))return false; seen.add(k); return true})
let inserted=0
const CH=500
for(let i=0;i<list.length;i+=CH){
  const b=list.slice(i,i+CH)
  const f=b.map(x=>x[0]), t=b.map(x=>x[1]), s=b.map(()=>JSON.stringify({migrated:true}))
  const res=arr(await tgt.query(`INSERT INTO follows (follower_id,target_username,source_ref)
    SELECT * FROM unnest($1::uuid[],$2::text[],$3::jsonb[])
    ON CONFLICT (follower_id,target_username) DO NOTHING RETURNING id`,[f,t,s]))
  inserted+=res.length
}
const tot=arr(await tgt.query(`SELECT count(*)::int n FROM follows`))[0].n
console.log(JSON.stringify({source_rows:rows.length, mappable_to_account:pairs.length, inserted, follows_total:tot},null,2))

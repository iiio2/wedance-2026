---
status: open
created: 2026-10-10 17:05
---

# Image upload endpoint accepts anonymous uploads

## Tension

`server/api/media/image.post.ts` uploads any posted image (≤ request limit) to the
production Cloudinary account without checking for a signed-in session. Anyone can use
WeDance's Cloudinary quota as free image hosting.

## Driver

Uploads now serve dancer avatars and (since hosting mode) artist/venue profile galleries,
so the endpoint will see more traffic.

## Requirement

- Require a valid `wedance-session` (same check as tRPC context) before uploading.
- Enforce the 10 MB limit and image MIME type on the server too (today only the client checks).

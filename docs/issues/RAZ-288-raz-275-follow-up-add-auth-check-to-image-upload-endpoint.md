---
title: "RAZ-275 follow-up: Add auth check to image upload endpoint"
type: Task
id: RAZ-288
status: triage
state: Triage
state_type: triage
project: "WeDance CUJ"
labels: []
assignee: "Mr. Abir"
creator: "Aleksey Razbakov"
priority: "No priority"
estimate: null
parent: null
created: 2026-10-09T16:18:28.735Z
completed: null
canceled: null
due: null
links: []
linear_url: https://linear.app/alosha/issue/RAZ-288/raz-275-follow-up-add-auth-check-to-image-upload-endpoint
exported: 2026-10-25
---

# RAZ-288 — RAZ-275 follow-up: Add auth check to image upload endpoint

The image upload endpoint at server/api/media/image.post.ts:4 accepts unauthenticated POST requests. Any caller can upload files to Cloudinary using the server's credentials without being logged in. Add the project's standard server-side auth check before reading the body or starting the upload. Also add server-side file type validation (inspect binary content, not MIME) and size limits (image.post.ts:22-25). From PR [https://github.com/razbakov/wedance-2026/pull/225](<https://github.com/razbakov/wedance-2026/pull/225>) (CodeRabbit review).

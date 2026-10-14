/**
 * Artist profiles live at /@handle. The old static /artists/<id> page is
 * gone, so links already shared (/artists/<handle>) go to the profile.
 * /artists itself (the directory) is untouched.
 */
export default defineEventHandler((event) => {
  const m = event.path.match(/^\/artists\/([^/?#]+)\/?(\?.*)?$/)
  if (m) return sendRedirect(event, `/@${m[1]}`, 301)
})

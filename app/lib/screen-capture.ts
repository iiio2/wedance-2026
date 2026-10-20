/**
 * One-frame screenshot via the browser's own screen capture
 * (navigator.mediaDevices.getDisplayMedia) — used by the "Report a problem"
 * form (app/components/ReportProblem.vue).
 *
 * The browser shows its own permission prompt; Chrome/Edge pre-select the
 * current tab (`preferCurrentTab`). We take ONE frame and stop every track
 * straight away, so the "sharing this tab" indicator disappears. Mobile
 * browsers have no getDisplayMedia — there the report relies on Sentry Replay.
 *
 * getDisplayMedia needs a user gesture: call `captureScreenFrame()` directly
 * from a click handler, with no `await` before it. The call itself is the
 * first statement here, so it runs synchronously inside that gesture.
 */

export interface ScreenFrame {
  /** JPEG bytes, ready to attach to the Sentry feedback event. */
  bytes: Uint8Array
  /** Blob of the same bytes, for an <img> preview via URL.createObjectURL. */
  blob: Blob
}

/** Longest edge of the stored screenshot; a 4K/retina frame is scaled down. */
const MAX_EDGE = 1920
const JPEG_QUALITY = 0.8

export function isScreenCaptureSupported(): boolean {
  return typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function'
}

/**
 * Ask for a capture, grab one frame, stop the stream. Resolves `null` (never
 * throws) when capture is unsupported, declined or fails.
 *
 * `settle` runs after the user has picked a surface and before the frame is
 * grabbed — the caller uses it to wait until its own dialog is gone and the
 * browser's picker has closed, so neither ends up in the shot.
 */
export async function captureScreenFrame(settle?: () => Promise<void>): Promise<ScreenFrame | null> {
  if (!isScreenCaptureSupported()) return null
  let stream: MediaStream | null = null
  try {
    // Must stay the first awaited call (user-gesture requirement).
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: { displaySurface: 'browser' },
      audio: false,
      preferCurrentTab: true,
      selfBrowserSurface: 'include',
      surfaceSwitching: 'exclude',
    } as DisplayMediaStreamOptions)
    const track = stream.getVideoTracks()[0]
    if (!track) return null
    if (settle) await settle()
    const canvas = await grabFrame(track, stream)
    stopAll(stream)
    stream = null
    return canvas ? await encodeJpeg(canvas) : null
  } catch (e) {
    // NotAllowedError = the user declined; anything else is a browser quirk.
    if ((e as DOMException)?.name !== 'NotAllowedError') console.warn('[screen-capture] failed:', e)
    return null
  } finally {
    if (stream) stopAll(stream)
  }
}

function stopAll(stream: MediaStream) {
  for (const t of stream.getTracks()) t.stop()
}

/** Size a canvas so the longest edge is at most MAX_EDGE. */
function sizedCanvas(w: number, h: number): HTMLCanvasElement | null {
  if (!w || !h) return null
  const scale = Math.min(1, MAX_EDGE / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  return canvas
}

type ImageCaptureLike = { grabFrame(): Promise<ImageBitmap> }

async function grabFrame(track: MediaStreamTrack, stream: MediaStream): Promise<HTMLCanvasElement | null> {
  // Chromium: ImageCapture.grabFrame() returns the next frame directly.
  const IC = (globalThis as unknown as { ImageCapture?: new (t: MediaStreamTrack) => ImageCaptureLike }).ImageCapture
  if (IC) {
    try {
      const bitmap = await new IC(track).grabFrame()
      const canvas = sizedCanvas(bitmap.width, bitmap.height)
      canvas?.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      if (canvas) return canvas
    } catch { /* fall through to the <video> path */ }
  }

  // Firefox / Safari: play the stream in a detached <video> and draw a frame.
  const video = document.createElement('video')
  video.muted = true
  video.playsInline = true
  video.srcObject = stream
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('video frame timeout')), 5000)
      video.addEventListener('loadeddata', () => { clearTimeout(timer); resolve() }, { once: true })
      video.play().catch(() => { /* loadeddata still fires for a muted stream */ })
    })
    await new Promise<void>((resolve) => {
      const v = video as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }
      if (typeof v.requestVideoFrameCallback === 'function') v.requestVideoFrameCallback(() => resolve())
      else requestAnimationFrame(() => resolve())
    })
    const canvas = sizedCanvas(video.videoWidth, video.videoHeight)
    canvas?.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas
  } finally {
    video.pause()
    video.srcObject = null
  }
}

async function encodeJpeg(canvas: HTMLCanvasElement): Promise<ScreenFrame | null> {
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY))
  if (!blob) return null
  return { blob, bytes: new Uint8Array(await blob.arrayBuffer()) }
}

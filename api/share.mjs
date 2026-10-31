// Vercel serverless function: /api/share?v=<video id>
//
// Chat apps (WhatsApp, Facebook, X, Telegram...) build their link preview by reading a page's
// <meta> tags without running any JavaScript. The main site is a single JavaScript page, so it
// can't show a different title/thumbnail per video. This function fills that gap: it returns a
// tiny page carrying the video's title + thumbnail, and then sends real visitors on to the site
// with that video's pop-up open.

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY

const SITE_NAME = 'Jesus My Light Fellowship'
const DEFAULT_DESCRIPTION = 'Sermons, highlights and moments from Jesus My Light Fellowship - The Winning Family.'

function esc(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function youtubeThumb(url) {
  const m = String(url || '').match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/)
  return m ? 'https://img.youtube.com/vi/' + m[1] + '/hqdefault.jpg' : null
}

async function fetchVideo(id) {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null
  try {
    const response = await fetch(
      SUPABASE_URL + '/rest/v1/videos?id=eq.' + id + '&select=title,description,video_type,video_url&limit=1',
      { headers: { apikey: SUPABASE_KEY, Authorization: 'Bearer ' + SUPABASE_KEY } }
    )
    if (!response.ok) return null
    const rows = await response.json()
    return rows && rows[0] ? rows[0] : null
  } catch (e) {
    return null
  }
}

export default async function handler(req, res) {
  const host = req.headers['x-forwarded-host'] || req.headers.host || ''
  const proto = req.headers['x-forwarded-proto'] || 'https'
  const origin = proto + '://' + host

  let id = ''
  try {
    id = (new URL(req.url, origin).searchParams.get('v') || '').trim()
  } catch (e) {}
  const validId = /^[0-9a-fA-F-]{36}$/.test(id)

  const video = validId ? await fetchVideo(id) : null

  const title = video ? video.title + ' | ' + SITE_NAME : SITE_NAME + ' | The Winning Family'
  const description = (video && video.description ? video.description : DEFAULT_DESCRIPTION).slice(0, 200)
  let image = origin + '/og-image.png'
  if (video && video.video_type === 'link') {
    image = youtubeThumb(video.video_url) || image
  }

  const shareUrl = origin + '/api/share' + (validId ? '?v=' + id : '')
  const target = origin + '/' + (validId ? '?video=' + id : '') + '#videos'

  const html = '<!doctype html>\n' +
    '<html lang="en"><head><meta charset="utf-8">\n' +
    '<meta name="viewport" content="width=device-width, initial-scale=1">\n' +
    '<title>' + esc(title) + '</title>\n' +
    '<meta name="description" content="' + esc(description) + '">\n' +
    '<meta property="og:type" content="website">\n' +
    '<meta property="og:site_name" content="' + esc(SITE_NAME) + '">\n' +
    '<meta property="og:title" content="' + esc(title) + '">\n' +
    '<meta property="og:description" content="' + esc(description) + '">\n' +
    '<meta property="og:image" content="' + esc(image) + '">\n' +
    '<meta property="og:url" content="' + esc(shareUrl) + '">\n' +
    '<meta name="twitter:card" content="summary_large_image">\n' +
    '<meta name="twitter:title" content="' + esc(title) + '">\n' +
    '<meta name="twitter:description" content="' + esc(description) + '">\n' +
    '<meta name="twitter:image" content="' + esc(image) + '">\n' +
    '</head><body style="font-family:sans-serif;text-align:center;padding:48px 20px;">\n' +
    '<p>Opening the video&hellip;</p>\n' +
    '<p><a href="' + esc(target) + '">Tap here if nothing happens</a></p>\n' +
    '<script>location.replace(' + JSON.stringify(target).replace(/</g, '\\u003c') + ')</script>\n' +
    '</body></html>'

  res.setHeader('Content-Type', 'text/html; charset=utf-8')
  res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600')
  res.status(200).send(html)
}

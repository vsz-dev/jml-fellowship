import './style.css'
import { supabase } from './supabaseClient.js'

// mobile nav toggle
document.getElementById('navToggle').addEventListener('click', function () {
  document.getElementById('navLinks').classList.toggle('open')
})
document.querySelectorAll('#navLinks a').forEach(function (a) {
  a.addEventListener('click', function () {
    document.getElementById('navLinks').classList.remove('open')
  })
})

// turn plain text (with blank-line paragraphs and single-line breaks) into clean HTML
function formatParagraphs(text) {
  if (!text) return ''
  return text
    .split(/\n\s*\n/)
    .map(function (para) {
      return '<p>' + para.trim().replace(/\n/g, '<br>') + '</p>'
    })
    .join('')
}

// make text safe to place inside HTML (used for anything visitors type in)
function escapeHtml(text) {
  return String(text == null ? '' : text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

// ---------- Word of the month ----------
async function loadWordOfMonth() {
  const { data, error } = await supabase
    .from('word_of_month')
    .select('*')
    .eq('is_current', true)
    .single()

  if (error || !data) return

  document.getElementById('wordMonth').textContent = data.month_label
  document.getElementById('wordTitle').textContent = data.title
  document.getElementById('wordRef').textContent = data.scripture_ref
  document.getElementById('wordBody').innerHTML = formatParagraphs(data.body)
}

// ---------- Dated prayer archive ----------
let weekDates = []
let currentWeekIndex = 0

function formatWeekDate(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
}

async function loadWeekDates() {
  const { data, error } = await supabase
    .from('prayer_points')
    .select('week_of')
    .eq('category', 'week')
    .order('week_of', { ascending: false })

  if (error || !data) return []
  return [...new Set(data.map(function (d) { return d.week_of }))]
}

async function loadPrayerPointsForWeek(weekOf) {
  const { data, error } = await supabase
    .from('prayer_points')
    .select('*')
    .eq('category', 'week')
    .eq('week_of', weekOf)
    .order('sort_order', { ascending: true })

  if (error || !data || data.length === 0) return

  const container = document.getElementById('week')
  container.innerHTML = data.map(function (p) {
    const ref = p.scripture_ref ? '<span class="scripture">' + p.scripture_ref + '</span>' : ''
    return '<div class="prayer-item"><p>' + p.point + ref + '</p></div>'
  }).join('')

  document.getElementById('weekDateLabel').textContent = formatWeekDate(weekOf)
}

function updateWeekNavButtons() {
  document.getElementById('prevWeekBtn').disabled = currentWeekIndex >= weekDates.length - 1
  document.getElementById('nextWeekBtn').disabled = currentWeekIndex <= 0
}

async function initPrayerArchive() {
  weekDates = await loadWeekDates()
  if (weekDates.length === 0) {
    document.getElementById('weekDateLabel').textContent = ''
    return
  }
  currentWeekIndex = 0
  await loadPrayerPointsForWeek(weekDates[currentWeekIndex])
  updateWeekNavButtons()
}

document.getElementById('prevWeekBtn').addEventListener('click', async function () {
  if (currentWeekIndex < weekDates.length - 1) {
    currentWeekIndex++
    await loadPrayerPointsForWeek(weekDates[currentWeekIndex])
    updateWeekNavButtons()
  }
})

document.getElementById('nextWeekBtn').addEventListener('click', async function () {
  if (currentWeekIndex > 0) {
    currentWeekIndex--
    await loadPrayerPointsForWeek(weekDates[currentWeekIndex])
    updateWeekNavButtons()
  }
})

// ---------- Inspirations (horizontal scroll, click to open) ----------
let inspirationsById = {}
let currentInspirationId = null

async function loadInspirations() {
  const { data, error } = await supabase
    .from('inspirations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !data || data.length === 0) return

  inspirationsById = {}
  data.forEach(function (i) { inspirationsById[i.id] = i })

  const container = document.getElementById('inspirationList')
  container.innerHTML = data.map(function (i) {
    const author = i.author ? '<p class="inspiration-author">&mdash; ' + i.author + '</p>' : ''
    return '<div class="inspiration-card" data-inspiration-id="' + i.id + '">' +
      '<div class="inspiration-message">' + formatParagraphs(i.message) + '</div>' +
      author +
      '<p class="inspiration-readmore">Click to open &rarr;</p>' +
    '</div>'
  }).join('')

  document.querySelectorAll('.inspiration-card').forEach(function (card) {
    card.addEventListener('click', function () {
      openInspirationModal(card.dataset.inspirationId)
    })
  })
}

async function openInspirationModal(id) {
  const insp = inspirationsById[id]
  if (!insp) return

  currentInspirationId = id
  document.getElementById('inspModalAuthor').textContent = insp.author ? ('— ' + insp.author) : 'Inspiration'
  document.getElementById('inspModalMessage').innerHTML = formatParagraphs(insp.message)
  document.getElementById('inspirationModal').classList.add('active')

  document.getElementById('commentForm').reset()
  document.getElementById('requestForm').reset()
  document.getElementById('commentNote').textContent = ''
  document.getElementById('requestNote').textContent = ''

  await loadReactionCounts(id)
  await loadComments(id)
}

// ---------- Reactions ----------
async function loadReactionCounts(inspirationId) {
  const { data, error } = await supabase
    .from('inspiration_reactions')
    .select('reaction_type')
    .eq('inspiration_id', inspirationId)

  const counts = { like: 0, heart: 0, amen: 0 }
  if (!error && data) {
    data.forEach(function (r) {
      if (counts[r.reaction_type] !== undefined) counts[r.reaction_type]++
    })
  }

  document.getElementById('countLike').textContent = counts.like
  document.getElementById('countHeart').textContent = counts.heart
  document.getElementById('countAmen').textContent = counts.amen
}

document.querySelectorAll('.reaction-btn').forEach(function (btn) {
  btn.addEventListener('click', async function () {
    if (!currentInspirationId) return
    const type = btn.dataset.reaction

    const storageKey = 'reacted_' + currentInspirationId + '_' + type
    if (localStorage.getItem(storageKey)) {
      return // already reacted this way on this device
    }

    const { error } = await supabase
      .from('inspiration_reactions')
      .insert({ inspiration_id: currentInspirationId, reaction_type: type })

    if (!error) {
      try { localStorage.setItem(storageKey, 'true') } catch (e) {}
      btn.classList.add('reacted')
      await loadReactionCounts(currentInspirationId)
    }
  })
})

// ---------- Comments ----------
async function loadComments(inspirationId) {
  const { data, error } = await supabase
    .from('inspiration_comments')
    .select('*')
    .eq('inspiration_id', inspirationId)
    .order('created_at', { ascending: true })

  const container = document.getElementById('commentList')
  if (error || !data || data.length === 0) {
    container.innerHTML = '<p class="comment-empty">No comments yet. Be the first to share a thought.</p>'
    return
  }

  container.innerHTML = data.map(function (c) {
    return '<div class="comment-item"><p class="comment-name">' + escapeHtml(c.name) + '</p><p class="comment-text">' + escapeHtml(c.comment) + '</p></div>'
  }).join('')
}

document.getElementById('commentForm').addEventListener('submit', async function (e) {
  e.preventDefault()
  if (!currentInspirationId) return

  const name = document.getElementById('commentName').value.trim()
  const comment = document.getElementById('commentText').value.trim()
  const note = document.getElementById('commentNote')

  const { error } = await supabase
    .from('inspiration_comments')
    .insert({ inspiration_id: currentInspirationId, name: name, comment: comment })

  if (error) {
    note.textContent = 'Something went wrong. Please try again.'
    return
  }

  note.textContent = 'Comment posted!'
  document.getElementById('commentForm').reset()
  await loadComments(currentInspirationId)
})

// ---------- Requests ----------
document.getElementById('requestForm').addEventListener('submit', async function (e) {
  e.preventDefault()
  if (!currentInspirationId) return

  const name = document.getElementById('requestName').value.trim()
  const request = document.getElementById('requestText').value.trim()
  const note = document.getElementById('requestNote')

  const { error } = await supabase
    .from('member_requests')
    .insert({ inspiration_id: currentInspirationId, name: name || null, request: request })

  if (error) {
    note.textContent = 'Something went wrong. Please try again.'
    return
  }

  note.textContent = 'Thank you — your request has been sent to the fellowship.'
  document.getElementById('requestForm').reset()
})

// ---------- Videos ----------
let videosById = {}
let currentVideoId = null

// work out how to show a posted video: YouTube, Vimeo, Instagram, Facebook, an uploaded file, or a plain link
function getVideoInfo(v) {
  if (v.video_type === 'upload') return { kind: 'upload', src: v.video_url }

  const url = (v.video_url || '').trim()
  let m

  m = url.match(/(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/)
  if (m) {
    return {
      kind: 'youtube',
      src: 'https://www.youtube.com/embed/' + m[1],
      thumb: 'https://img.youtube.com/vi/' + m[1] + '/hqdefault.jpg'
    }
  }

  m = url.match(/vimeo\.com\/(?:video\/)?(\d+)/)
  if (m) return { kind: 'vimeo', src: 'https://player.vimeo.com/video/' + m[1] }

  m = url.match(/instagram\.com\/(?:[A-Za-z0-9_.]+\/)?(p|reel|reels|tv)\/([A-Za-z0-9_-]+)/)
  if (m) {
    const type = m[1] === 'reels' ? 'reel' : m[1]
    return { kind: 'instagram', layout: 'portrait', src: 'https://www.instagram.com/' + type + '/' + m[2] + '/embed/captioned/' }
  }

  if (/facebook\.com|fb\.watch|fb\.com/.test(url)) {
    const encoded = encodeURIComponent(url)
    const isReel = /\/reel\/|\/share\/r\//.test(url)
    const isVideo = isReel || /\/videos\/|\/watch|fb\.watch|\/share\/v\//.test(url)
    if (isVideo) {
      return {
        kind: 'facebook',
        layout: isReel ? 'portrait' : 'wide',
        src: 'https://www.facebook.com/plugins/video.php?href=' + encoded + '&show_text=false&width=560'
      }
    }
    return {
      kind: 'facebook',
      layout: 'portrait',
      src: 'https://www.facebook.com/plugins/post.php?href=' + encoded + '&show_text=true&width=500'
    }
  }

  return { kind: 'link', src: url }
}

const VIDEO_LABELS = { youtube: 'YouTube', vimeo: 'Vimeo', instagram: 'Instagram', facebook: 'Facebook', link: 'Video' }

function formatViews(n) {
  const count = n || 0
  return '👁 ' + count + (count === 1 ? ' view' : ' views')
}

function videoThumbHtml(info) {
  if (info.kind === 'youtube') {
    return '<img src="' + escapeHtml(info.thumb) + '" alt="" loading="lazy">'
  }
  if (info.kind === 'upload') {
    return '<video src="' + escapeHtml(info.src) + '#t=0.5" preload="metadata" muted playsinline></video>'
  }
  return '<div class="video-thumb-placeholder ' + info.kind + '"><span>' + (VIDEO_LABELS[info.kind] || 'Video') + '</span></div>'
}

function videoPlayerHtml(info, v) {
  if (info.kind === 'upload') {
    return '<video class="video-player" controls playsinline preload="metadata" src="' + escapeHtml(info.src) + '"></video>'
  }
  if (info.kind === 'link') {
    if (!/^https?:\/\//i.test(info.src)) return '<p class="comment-empty">This video link could not be opened.</p>'
    return '<a class="btn btn-outline-modal" href="' + escapeHtml(info.src) + '" target="_blank" rel="noopener">Open video &rarr;</a>'
  }
  const wrapClass = info.layout === 'portrait' ? 'video-embed-portrait' : 'video-embed-wrap'
  return '<div class="' + wrapClass + '">' +
    '<iframe src="' + escapeHtml(info.src) + '" title="' + escapeHtml(v.title) + '" ' +
    'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" ' +
    'allowfullscreen loading="lazy"></iframe></div>'
}

async function loadVideos() {
  const container = document.getElementById('videoList')
  if (!container) return

  const { data, error } = await supabase
    .from('videos')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(20)

  if (error || !data || data.length === 0) {
    container.innerHTML = '<p class="section-desc">No videos posted yet. Check back soon.</p>'
    return
  }

  videosById = {}
  data.forEach(function (v) { videosById[v.id] = v })

  container.innerHTML = data.map(function (v) {
    const info = getVideoInfo(v)
    const desc = v.description ? '<p class="video-desc-preview">' + escapeHtml(v.description) + '</p>' : ''
    return '<div class="video-card" data-video-id="' + escapeHtml(v.id) + '" role="button" tabindex="0">' +
      '<div class="video-thumb">' + videoThumbHtml(info) + '<span class="video-play"></span></div>' +
      '<div class="video-card-body">' +
        '<h3 class="video-title">' + escapeHtml(v.title) + '</h3>' +
        '<p class="video-meta" data-views-for="' + escapeHtml(v.id) + '">' + formatViews(v.view_count) + '</p>' +
        desc +
      '</div>' +
    '</div>'
  }).join('')

  container.querySelectorAll('.video-card').forEach(function (card) {
    card.addEventListener('click', function () { openVideoModal(card.dataset.videoId) })
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openVideoModal(card.dataset.videoId)
      }
    })
  })
}

async function openVideoModal(id) {
  const v = videosById[id]
  if (!v) return

  currentVideoId = id
  const info = getVideoInfo(v)

  document.getElementById('videoModalTitle').textContent = v.title
  document.getElementById('videoModalPlayer').innerHTML = videoPlayerHtml(info, v)
  document.getElementById('videoModalDesc').innerHTML = v.description ? formatParagraphs(escapeHtml(v.description)) : ''
  document.getElementById('videoModalViews').textContent = formatViews(v.view_count)
  document.getElementById('videoCommentForm').reset()
  document.getElementById('videoCommentNote').textContent = ''
  document.getElementById('videoModal').classList.add('active')

  recordVideoView(id)
  await loadVideoReactions(id)
  await loadVideoComments(id)
}

// ---------- Video views (counted once per device per video) ----------
async function recordVideoView(id) {
  const key = 'viewed_video_' + id
  try { if (localStorage.getItem(key)) return } catch (e) {}

  const { data, error } = await supabase.rpc('increment_video_view', { vid: id })
  if (error) {
    console.error('Could not record view:', error)
    return
  }
  try { localStorage.setItem(key, 'true') } catch (e) {}

  if (typeof data === 'number') {
    if (videosById[id]) videosById[id].view_count = data
    document.querySelectorAll('[data-views-for="' + id + '"]').forEach(function (el) {
      el.textContent = formatViews(data)
    })
    if (currentVideoId === id) {
      document.getElementById('videoModalViews').textContent = formatViews(data)
    }
  }
}

// ---------- Video reactions ----------
async function loadVideoReactions(id) {
  const { data, error } = await supabase
    .from('video_reactions')
    .select('reaction_type')
    .eq('video_id', id)

  if (currentVideoId !== id) return

  const counts = { like: 0, heart: 0, amen: 0 }
  if (!error && data) {
    data.forEach(function (r) {
      if (counts[r.reaction_type] !== undefined) counts[r.reaction_type]++
    })
  }

  document.getElementById('vCountLike').textContent = counts.like
  document.getElementById('vCountHeart').textContent = counts.heart
  document.getElementById('vCountAmen').textContent = counts.amen

  document.querySelectorAll('.video-reaction-btn').forEach(function (btn) {
    let reacted = false
    try { reacted = !!localStorage.getItem('vreacted_' + id + '_' + btn.dataset.vreaction) } catch (e) {}
    btn.classList.toggle('reacted', reacted)
  })
}

document.querySelectorAll('.video-reaction-btn').forEach(function (btn) {
  btn.addEventListener('click', async function () {
    if (!currentVideoId) return
    const id = currentVideoId
    const type = btn.dataset.vreaction
    const key = 'vreacted_' + id + '_' + type

    try { if (localStorage.getItem(key)) return } catch (e) {}

    const { error } = await supabase
      .from('video_reactions')
      .insert({ video_id: id, reaction_type: type })

    if (error) {
      console.error('Could not save reaction:', error)
      return
    }
    try { localStorage.setItem(key, 'true') } catch (e) {}
    if (currentVideoId === id) await loadVideoReactions(id)
  })
})

// ---------- Video comments ----------
async function loadVideoComments(id) {
  const { data, error } = await supabase
    .from('video_comments')
    .select('*')
    .eq('video_id', id)
    .order('created_at', { ascending: true })

  if (currentVideoId !== id) return

  const container = document.getElementById('videoCommentList')
  if (error || !data || data.length === 0) {
    container.innerHTML = '<p class="comment-empty">No comments yet. Be the first to share a thought.</p>'
    return
  }

  container.innerHTML = data.map(function (c) {
    return '<div class="comment-item"><p class="comment-name">' + escapeHtml(c.name) + '</p><p class="comment-text">' + escapeHtml(c.comment) + '</p></div>'
  }).join('')
}

document.getElementById('videoCommentForm').addEventListener('submit', async function (e) {
  e.preventDefault()
  if (!currentVideoId) return

  const id = currentVideoId
  const name = document.getElementById('videoCommentName').value.trim()
  const comment = document.getElementById('videoCommentText').value.trim()
  const note = document.getElementById('videoCommentNote')

  const { error } = await supabase
    .from('video_comments')
    .insert({ video_id: id, name: name, comment: comment })

  if (error) {
    console.error('Could not post comment:', error)
    note.textContent = 'Something went wrong. Please try again.'
    return
  }

  note.textContent = 'Comment posted!'
  document.getElementById('videoCommentForm').reset()
  if (currentVideoId === id) await loadVideoComments(id)
})

// ---------- Purpose & Vision / Announcement modals ----------
let siteContent = {}

async function loadSiteContent() {
  const { data, error } = await supabase.from('site_content').select('*')
  if (error || !data) return
  data.forEach(function (row) { siteContent[row.key] = row })
}

function openModal(key, modalId, titleId, bodyId, defaultTitle) {
  const content = siteContent[key]
  document.getElementById(titleId).textContent = (content && content.title) ? content.title : defaultTitle
  document.getElementById(bodyId).innerHTML = (content && content.body)
    ? formatParagraphs(content.body)
    : '<p>Nothing posted yet. Check back soon.</p>'
  document.getElementById(modalId).classList.add('active')
}

function closeModal(modalEl) {
  modalEl.classList.remove('active')
  // stop any playing video/audio when the video popup is closed
  if (modalEl.id === 'videoModal') {
    document.getElementById('videoModalPlayer').innerHTML = ''
    currentVideoId = null
  }
}

document.getElementById('purposeNavBtn').addEventListener('click', function () {
  openModal('purpose_vision', 'purposeModal', 'purposeModalTitle', 'purposeModalBody', 'Purpose & Vision')
  document.getElementById('navLinks').classList.remove('open')
})
document.getElementById('announcementNavBtn').addEventListener('click', function () {
  openModal('announcement', 'announcementModal', 'announcementModalTitle', 'announcementModalBody', 'Announcement')
  document.getElementById('navLinks').classList.remove('open')
})
document.querySelectorAll('[data-close-modal]').forEach(function (btn) {
  btn.addEventListener('click', function () {
    closeModal(btn.closest('.modal-overlay'))
  })
})
document.querySelectorAll('.modal-overlay').forEach(function (overlay) {
  overlay.addEventListener('click', function (e) {
    if (e.target === overlay) closeModal(overlay)
  })
})

// ---------- Join Fellowship sign-up form ----------
const dobDaySelect = document.getElementById('signupDobDay')
if (dobDaySelect) {
  for (let d = 1; d <= 31; d++) {
    const opt = document.createElement('option')
    opt.value = d
    opt.textContent = d
    dobDaySelect.appendChild(opt)
  }
}

const signupForm = document.getElementById('signupForm')
if (signupForm) {
  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault()
    const name = document.getElementById('signupName').value.trim()
    const email = document.getElementById('signupEmail').value.trim()
    const whatsapp = document.getElementById('signupWhatsapp').value.trim()
    const dobMonth = document.getElementById('signupDobMonth').value
    const dobDay = document.getElementById('signupDobDay').value
    const scripture = document.getElementById('signupScripture').value.trim()

    const { error } = await supabase
      .from('signups')
      .insert({
        full_name: name,
        email: email,
        whatsapp_number: whatsapp,
        dob_month: dobMonth ? parseInt(dobMonth) : null,
        dob_day: dobDay ? parseInt(dobDay) : null,
        favorite_scripture: scripture || null
      })

    if (error) {
      console.error('Signup save failed:', error)
      document.getElementById('signupNote').textContent = "Something went wrong saving your details. Please try again."
      return
    }

    document.getElementById('signupNote').textContent = "Thanks! We've saved your details. We'll be in touch on WhatsApp soon."
    signupForm.reset()
  })
}

// ---------- Push notifications: install + subscribe ----------
const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

async function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    try {
      await navigator.serviceWorker.register('/service-worker.js')
    } catch (e) {
      console.error('Service worker registration failed:', e)
    }
  }
}

async function enableNotifications() {
  const btn = document.getElementById('enableNotifBtn')
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    alert('Notifications are not supported on this browser.')
    return
  }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    alert('Notifications were not allowed. You can turn them on later from your browser settings.')
    return
  }

  const registration = await navigator.serviceWorker.ready
  let subscription = await registration.pushManager.getSubscription()

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    })
  }

  await saveSubscription(subscription)
  btn.textContent = '🔔 Notifications On'
  btn.disabled = true
}

async function saveSubscription(subscription) {
  const sub = subscription.toJSON()
  const { error } = await supabase
    .from('push_subscriptions')
    .upsert({
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth
    }, { onConflict: 'endpoint' })
  if (error) console.error('Could not save subscription:', error)
}

async function refreshNotifButtonState() {
  const btn = document.getElementById('enableNotifBtn')
  if (!btn) return
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return

  if (Notification.permission !== 'granted') {
    btn.textContent = '🔔 Enable Notification'
    btn.disabled = false
    return
  }

  try {
    const registration = await navigator.serviceWorker.ready
    let subscription = await registration.pushManager.getSubscription()

    // Permission was already granted before, but the phone/OS may have
    // silently killed the old subscription in the background. Since
    // permission is already granted, re-subscribing needs no popup —
    // this quietly repairs a dead connection every time the site opens.
    if (!subscription) {
      subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
      })
    }

    await saveSubscription(subscription)
    btn.textContent = '🔔 Notifications On'
    btn.disabled = true
  } catch (e) {
    console.error('Could not refresh notification subscription:', e)
    btn.textContent = '🔔 Enable Notification'
    btn.disabled = false
  }
}

const notifBtn = document.getElementById('enableNotifBtn')
if (notifBtn) notifBtn.addEventListener('click', enableNotifications)
registerServiceWorker().then(refreshNotifButtonState)

loadWordOfMonth()
initPrayerArchive()
loadInspirations()
loadVideos()
loadSiteContent()
import './style.css'
import { supabase } from './supabaseClient.js'

const loginSection = document.getElementById('loginSection')
const dashboardSection = document.getElementById('dashboardSection')

async function checkSession() {
  const { data: { session } } = await supabase.auth.getSession()
  session ? showDashboard() : showLogin()
}

function showLogin() {
  loginSection.style.display = 'block'
  dashboardSection.style.display = 'none'
}

function showDashboard() {
  loginSection.style.display = 'none'
  dashboardSection.style.display = 'block'
  loadRecentInspirations()
  loadWordOfMonthIntoForm()
  loadSiteContentIntoForm('purpose_vision', 'purposeTitleInput', 'purposeBodyInput')
  loadSiteContentIntoForm('announcement', 'announcementTitleInput', 'announcementBodyInput')
  loadRequests()
  loadSignups()
}

document.getElementById('loginForm').addEventListener('submit', async function (e) {
  e.preventDefault()
  const email = document.getElementById('loginEmail').value.trim()
  const password = document.getElementById('loginPassword').value
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  const note = document.getElementById('loginNote')
  if (error) {
    note.textContent = 'Login failed: ' + error.message
    return
  }
  note.textContent = ''
  showDashboard()
})

document.getElementById('logoutBtn').addEventListener('click', async function () {
  await supabase.auth.signOut()
  showLogin()
})

// ---------- Tabs ----------
document.querySelectorAll('.admin-tab-btn').forEach(function (btn) {
  btn.addEventListener('click', function () {
    document.querySelectorAll('.admin-tab-btn').forEach(function (b) { b.classList.remove('active') })
    document.querySelectorAll('.admin-panel').forEach(function (p) { p.classList.remove('active') })
    btn.classList.add('active')
    document.getElementById(btn.dataset.panel).classList.add('active')
  })
})

// ---------- Inspirations: add + edit ----------
let editingInspirationId = null

document.getElementById('inspirationForm').addEventListener('submit', async function (e) {
  e.preventDefault()
  const message = document.getElementById('inspMessage').value.trim()
  const author = document.getElementById('inspAuthor').value.trim()
  const note = document.getElementById('inspNote')

  let error
  if (editingInspirationId) {
    const result = await supabase
      .from('inspirations')
      .update({ message: message, author: author || null })
      .eq('id', editingInspirationId)
    error = result.error
  } else {
    const result = await supabase
      .from('inspirations')
      .insert({ message: message, author: author || null })
    error = result.error
  }

  if (error) {
    note.textContent = 'Something went wrong: ' + error.message
    return
  }

  const wasNew = !editingInspirationId
  note.textContent = editingInspirationId ? 'Updated!' : 'Posted! It will now show on the website.'
  cancelInspirationEdit()
  loadRecentInspirations()

  if (wasNew) {
    sendNotification('New Inspiration — JML Fellowship', message.slice(0, 120), '/#inspiration')
  }
})

document.getElementById('inspCancelEditBtn').addEventListener('click', cancelInspirationEdit)

function cancelInspirationEdit() {
  editingInspirationId = null
  document.getElementById('inspirationForm').reset()
  document.getElementById('inspSubmitBtn').textContent = 'Post inspiration'
  document.getElementById('inspCancelEditBtn').style.display = 'none'
}

async function loadRecentInspirations() {
  const { data, error } = await supabase
    .from('inspirations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error || !data) return

  document.getElementById('recentList').innerHTML = data.map(function (i) {
    const author = i.author ? ' — ' + i.author : ''
    const shortMessage = i.message.length > 80 ? i.message.slice(0, 80) + '...' : i.message
    return '<div class="recent-item">' +
      '<div class="recent-item-text">' + shortMessage + author + '</div>' +
      '<div class="recent-item-actions">' +
        '<button data-edit-id="' + i.id + '">Edit</button>' +
        '<button data-delete-id="' + i.id + '">Delete</button>' +
      '</div>' +
    '</div>'
  }).join('')

  document.querySelectorAll('[data-edit-id]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      const { data } = await supabase.from('inspirations').select('*').eq('id', btn.dataset.editId).single()
      if (!data) return
      document.getElementById('inspMessage').value = data.message
      document.getElementById('inspAuthor').value = data.author || ''
      editingInspirationId = data.id
      document.getElementById('inspSubmitBtn').textContent = 'Update inspiration'
      document.getElementById('inspCancelEditBtn').style.display = 'inline-block'
      window.scrollTo({ top: 0, behavior: 'smooth' })
    })
  })

  document.querySelectorAll('[data-delete-id]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm('Delete this inspiration?')) return
      await supabase.from('inspirations').delete().eq('id', btn.dataset.deleteId)
      loadRecentInspirations()
    })
  })
}

// ---------- Word of the Month ----------
let currentWordId = null

async function loadWordOfMonthIntoForm() {
  const { data, error } = await supabase
    .from('word_of_month')
    .select('*')
    .eq('is_current', true)
    .single()

  if (error || !data) return

  currentWordId = data.id
  document.getElementById('wordMonthInput').value = data.month_label
  document.getElementById('wordTitleInput').value = data.title
  document.getElementById('wordRefInput').value = data.scripture_ref
  document.getElementById('wordBodyInput').value = data.body
}

document.getElementById('wordForm').addEventListener('submit', async function (e) {
  e.preventDefault()
  const note = document.getElementById('wordNote')
  const payload = {
    month_label: document.getElementById('wordMonthInput').value.trim(),
    title: document.getElementById('wordTitleInput').value.trim(),
    scripture_ref: document.getElementById('wordRefInput').value.trim(),
    body: document.getElementById('wordBodyInput').value.trim(),
    is_current: true
  }

  let error
  if (currentWordId) {
    const result = await supabase.from('word_of_month').update(payload).eq('id', currentWordId)
    error = result.error
  } else {
    const result = await supabase.from('word_of_month').insert(payload).select().single()
    error = result.error
    if (!error && result.data) currentWordId = result.data.id
  }

  note.textContent = error ? 'Something went wrong: ' + error.message : 'Saved! It will now show on the website.'

  if (!error) {
    sendNotification('Word of the Month Updated — JML Fellowship', payload.title, '/#word')
  }
})

// ---------- Purpose & Vision / Announcement (shared logic) ----------
async function loadSiteContentIntoForm(key, titleFieldId, bodyFieldId) {
  const { data } = await supabase.from('site_content').select('*').eq('key', key).single()
  if (!data) return
  document.getElementById(titleFieldId).value = data.title || ''
  document.getElementById(bodyFieldId).value = data.body || ''
}

async function saveSiteContent(key, titleFieldId, bodyFieldId, noteId) {
  const note = document.getElementById(noteId)
  const payload = {
    key: key,
    title: document.getElementById(titleFieldId).value.trim(),
    body: document.getElementById(bodyFieldId).value.trim(),
    updated_at: new Date().toISOString()
  }
  const { error } = await supabase.from('site_content').upsert(payload, { onConflict: 'key' })
  note.textContent = error ? 'Something went wrong: ' + error.message : 'Saved! It will now show on the website.'
  return error
}

document.getElementById('purposeForm').addEventListener('submit', async function (e) {
  e.preventDefault()
  await saveSiteContent('purpose_vision', 'purposeTitleInput', 'purposeBodyInput', 'purposeNote')
})

document.getElementById('announcementForm').addEventListener('submit', async function (e) {
  e.preventDefault()
  const error = await saveSiteContent('announcement', 'announcementTitleInput', 'announcementBodyInput', 'announcementNote')
  if (!error) {
    const title = document.getElementById('announcementTitleInput').value.trim() || 'New Announcement'
    sendNotification('Announcement — JML Fellowship', title, '/')
  }
})

// ---------- Trigger push notification ----------
async function sendNotification(title, body, url) {
  try {
    const { data, error } = await supabase.functions.invoke('send-notification', {
      body: { title: title, body: body, url: url || '/' }
    })
    if (error) {
      console.error('Notification send failed:', error)
    } else {
      console.log('Notification result:', data)
    }
  } catch (e) {
    console.error('Notification send failed:', e)
  }
}

// ---------- Member Requests (read-only) ----------
async function loadRequests() {
  const { data, error } = await supabase
    .from('member_requests')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(30)

  const container = document.getElementById('requestsList')
  if (error || !data || data.length === 0) {
    container.innerHTML = '<p class="admin-note">No requests yet.</p>'
    return
  }

  container.innerHTML = data.map(function (r) {
    const name = r.name ? r.name : 'Anonymous'
    const date = new Date(r.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    return '<div class="recent-item">' +
      '<div class="recent-item-text"><strong>' + name + '</strong> &middot; ' + date + '<br>' + r.request + '</div>' +
      '<div class="recent-item-actions"><button data-delete-request-id="' + r.id + '">Delete</button></div>' +
    '</div>'
  }).join('')

  document.querySelectorAll('[data-delete-request-id]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm('Delete this request?')) return
      await supabase.from('member_requests').delete().eq('id', btn.dataset.deleteRequestId)
      loadRequests()
    })
  })
}

// ---------- Sign-ups (read-only) ----------
const MONTH_NAMES = ['', 'January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']

async function loadSignups() {
  const { data, error } = await supabase
    .from('signups')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)

  const container = document.getElementById('signupsList')
  if (error || !data || data.length === 0) {
    container.innerHTML = '<p class="admin-note">No sign-ups yet.</p>'
    return
  }

  container.innerHTML = data.map(function (s) {
    const dob = (s.dob_month && s.dob_day) ? (MONTH_NAMES[s.dob_month] + ' ' + s.dob_day) : 'Not provided'
    const scripture = s.favorite_scripture ? s.favorite_scripture : 'Not provided'
    const email = s.email ? s.email : 'Not provided'
    return '<div class="recent-item">' +
      '<div class="recent-item-text">' +
        '<strong>' + s.full_name + '</strong><br>' +
        'WhatsApp: ' + s.whatsapp_number + '<br>' +
        'Email: ' + email + '<br>' +
        'Birthday: ' + dob + '<br>' +
        'Favourite scripture: ' + scripture +
      '</div>' +
      '<div class="recent-item-actions">' +
        '<button data-delete-signup-id="' + s.id + '">Delete</button>' +
      '</div>' +
    '</div>'
  }).join('')

  document.querySelectorAll('[data-delete-signup-id]').forEach(function (btn) {
    btn.addEventListener('click', async function () {
      if (!confirm('Delete this sign-up?')) return
      const { error } = await supabase.from('signups').delete().eq('id', btn.dataset.deleteSignupId)
      if (error) {
        console.error('Delete failed:', error)
        alert('Could not delete: ' + error.message)
        return
      }
      loadSignups()
    })
  })
}

checkSession()
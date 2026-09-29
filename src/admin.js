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
  loadRecent()
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

document.getElementById('inspirationForm').addEventListener('submit', async function (e) {
  e.preventDefault()
  const message = document.getElementById('inspMessage').value.trim()
  const author = document.getElementById('inspAuthor').value.trim()
  const note = document.getElementById('inspNote')

  const { error } = await supabase.from('inspirations').insert({
    message: message,
    author: author || null
  })

  if (error) {
    note.textContent = 'Something went wrong: ' + error.message
    return
  }
  note.textContent = 'Posted! It will now show on the website.'
  document.getElementById('inspirationForm').reset()
  loadRecent()
})

async function loadRecent() {
  const { data, error } = await supabase
    .from('inspirations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error || !data) return

  document.getElementById('recentList').innerHTML = data.map(function (i) {
    const author = i.author ? ' — ' + i.author : ''
    return '<div class="recent-item"><p>' + i.message + author + '</p></div>'
  }).join('')
}

checkSession()
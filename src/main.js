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

// live word of the month from Supabase
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
  document.getElementById('wordBody').innerHTML = data.body
    .split(/\n\s*\n/)
    .map(function (paragraph) { return '<p>' + paragraph.trim() + '</p>' })
    .join('')
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

// live inspirations from Supabase
async function loadInspirations() {
  const { data, error } = await supabase
    .from('inspirations')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (error || !data || data.length === 0) return

  const container = document.getElementById('inspirationList')
  container.innerHTML = data.map(function (i) {
    const author = i.author ? '<p class="inspiration-author">&mdash; ' + i.author + '</p>' : ''
    return '<div class="inspiration-card"><p class="inspiration-message">&ldquo;' + i.message + '&rdquo;</p>' + author + '</div>'
  }).join('')
}

// Join Fellowship sign-up form
const signupForm = document.getElementById('signupForm')
if (signupForm) {
  signupForm.addEventListener('submit', async function (e) {
    e.preventDefault()
    const name = document.getElementById('signupName').value.trim()
    const whatsapp = document.getElementById('signupWhatsapp').value.trim()

    const { error } = await supabase
      .from('signups')
      .insert({ full_name: name, whatsapp_number: whatsapp })

    if (error) {
      console.error('Signup save failed:', error)
      document.getElementById('signupNote').textContent = "Something went wrong saving your details. Please try again."
      return
    }

    const fellowshipNumber = '2349032592862'
    const message = encodeURIComponent(`Hi! My name is ${name}. I'd like to join JML Fellowship. My WhatsApp number is ${whatsapp}.`)
    window.open(`https://wa.me/${fellowshipNumber}?text=${message}`, '_blank')
    document.getElementById('signupNote').textContent = "Thanks! We've saved your details and opened WhatsApp so you can message us directly."
    signupForm.reset()
  })
}

loadWordOfMonth()
initPrayerArchive()
loadInspirations()
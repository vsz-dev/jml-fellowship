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

// live weekly prayer points from Supabase
async function loadPrayerPoints() {
  const { data, error } = await supabase
    .from('prayer_points')
    .select('*')
    .eq('category', 'week')
    .order('sort_order', { ascending: true })

  if (error || !data || data.length === 0) return

  const container = document.getElementById('week')
  container.innerHTML = data.map(function (p) {
    const ref = p.scripture_ref ? '<span class="scripture">' + p.scripture_ref + '</span>' : ''
    return '<div class="prayer-item"><p>' + p.point + ref + '</p></div>'
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
loadPrayerPoints()
loadInspirations()
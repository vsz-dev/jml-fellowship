import './style.css'
import { supabase } from './supabaseClient.js'

// mobile nav toggle
document.getElementById('navToggle').addEventListener('click', function() {
  document.getElementById('navLinks').classList.toggle('open')
})
document.querySelectorAll('#navLinks a').forEach(function(a) {
  a.addEventListener('click', function() {
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
    .map(function(paragraph) { return '<p>' + paragraph.trim() + '</p>' })
    .join('')
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
  container.innerHTML = data.map(function(p) {
    const ref = p.scripture_ref ? '<span class="scripture">' + p.scripture_ref + '</span>' : ''
    return '<div class="prayer-item"><p>' + p.point + ref + '</p></div>'
  }).join('')
}

loadWordOfMonth()
loadPrayerPoints()
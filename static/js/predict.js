/* ══════════════════════════════════════════════════════════════
   AirPulse — predict.js
   Manual prediction form logic
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────────────────────
//  Slider ↔ Number input sync
// ─────────────────────────────────────────────────────────────
const SLIDER_PAIRS = [
  ['s_pm25', 'n_pm25'], ['s_pm10', 'n_pm10'],
  ['s_no',   'n_no'  ], ['s_no2',  'n_no2' ],
  ['s_nox',  'n_nox' ], ['s_nh3',  'n_nh3' ],
  ['s_co',   'n_co'  ], ['s_so2',  'n_so2' ],
  ['s_o3',   'n_o3'  ], ['s_ben',  'n_ben' ],
  ['s_tol',  'n_tol' ], ['s_xyl',  'n_xyl' ],
];

const DEFAULTS = {
  s_pm25: 30,  s_pm10: 60, s_no: 8,   s_no2: 25,
  s_nox:  33,  s_nh3: 10,  s_co: 0.9, s_so2: 8,
  s_o3:   35,  s_ben: 2,   s_tol: 6,  s_xyl: 1.5,
};

function syncSliderToNumber(sliderId, numId) {
  const slider = document.getElementById(sliderId);
  const num    = document.getElementById(numId);
  if (!slider || !num) return;

  // Update slider fill color via CSS background gradient
  function updateSliderFill() {
    const pct = ((slider.value - slider.min) / (slider.max - slider.min)) * 100;
    slider.style.background =
      `linear-gradient(to right, #0D9488 ${pct}%, rgba(255,255,255,0.10) ${pct}%)`;
  }

  slider.addEventListener('input', () => {
    num.value = slider.value;
    updateSliderFill();
  });

  num.addEventListener('input', () => {
    const v = parseFloat(num.value);
    if (!isNaN(v)) {
      slider.value = Math.min(Math.max(v, parseFloat(slider.min)), parseFloat(slider.max));
      updateSliderFill();
    }
  });

  // Initialise fill on page load
  updateSliderFill();
}

// ─────────────────────────────────────────────────────────────
//  AQI → percent on scale (matches app.js logic)
// ─────────────────────────────────────────────────────────────
function aqiToPercent(aqi) {
  const bp = [0, 50, 100, 200, 300, 400, 500];
  const v  = Math.min(parseFloat(aqi) || 0, 520);
  for (let i = 0; i < bp.length - 1; i++) {
    if (v <= bp[i + 1]) {
      const seg  = 100 / (bp.length - 1);
      const frac = (v - bp[i]) / (bp[i + 1] - bp[i]);
      return Math.min((i + frac) * seg, 99);
    }
  }
  return 99;
}

// ─────────────────────────────────────────────────────────────
//  Count-up animation
// ─────────────────────────────────────────────────────────────
function countUp(el, end, duration = 900) {
  const start   = 0;
  const t0      = performance.now();
  function step(now) {
    const p = Math.min((now - t0) / duration, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (end - start) * e);
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ─────────────────────────────────────────────────────────────
//  Show / hide result
// ─────────────────────────────────────────────────────────────
function showResult(data) {
  const section = document.getElementById('resultSection');
  section.style.display = 'block';

  // AQI box
  const numEl = document.getElementById('resPredNum');
  const box   = document.getElementById('resPredBox');
  numEl.textContent  = '0';
  countUp(numEl, data.predicted_aqi);
  box.style.borderColor = data.color;
  box.style.background  = data.color + '18';

  // Category badge
  const badge = document.getElementById('resCatBadge');
  badge.textContent     = data.category;
  badge.style.background = data.color;

  // Advice
  document.getElementById('resAdvice').textContent = data.health_advice;

  // Recommendations
  const recsEl = document.getElementById('resRecs');
  if (data.recommendations && data.recommendations.length) {
    recsEl.innerHTML = `
      <div class="recommendations-title">Health Recommendations</div>
      <ul class="rec-list">
        ${data.recommendations.map(r => `<li>${r}</li>`).join('')}
      </ul>`;
  }

  // Scale marker
  const marker = document.getElementById('resMarker');
  const pct    = aqiToPercent(data.predicted_aqi);
  marker.style.left    = pct + '%';
  marker.style.display = 'flex';

  // Scroll into view
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ─────────────────────────────────────────────────────────────
//  Build payload from form
// ─────────────────────────────────────────────────────────────
function buildPayload() {
  return {
    'PM2.5':   parseFloat(document.getElementById('n_pm25').value) || 0,
    'PM10':    parseFloat(document.getElementById('n_pm10').value) || 0,
    'NO':      parseFloat(document.getElementById('n_no').value)   || 0,
    'NO2':     parseFloat(document.getElementById('n_no2').value)  || 0,
    'NOx':     parseFloat(document.getElementById('n_nox').value)  || 0,
    'NH3':     parseFloat(document.getElementById('n_nh3').value)  || 0,
    'CO':      parseFloat(document.getElementById('n_co').value)   || 0,
    'SO2':     parseFloat(document.getElementById('n_so2').value)  || 0,
    'O3':      parseFloat(document.getElementById('n_o3').value)   || 0,
    'Benzene': parseFloat(document.getElementById('n_ben').value)  || 0,
    'Toluene': parseFloat(document.getElementById('n_tol').value)  || 0,
    'Xylene':  parseFloat(document.getElementById('n_xyl').value)  || 0,
    'Month':    parseInt(document.getElementById('sel_month').value, 10),
    'DayOfWeek':parseInt(document.getElementById('sel_dow').value,   10),
  };
}

// ─────────────────────────────────────────────────────────────
//  Form submit
// ─────────────────────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();

  const btn     = document.getElementById('predictBtn');
  const inner   = document.getElementById('btnInner');
  const spinner = document.getElementById('btnSpinner');

  btn.disabled       = true;
  inner.style.display  = 'none';
  spinner.style.display = 'flex';

  try {
    const res  = await fetch('/api/predict', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(buildPayload()),
    });
    const data = await res.json();

    if (!data.success) {
      showToast(data.error || 'Prediction failed. Please try again.');
      return;
    }

    showResult(data);

  } catch (err) {
    showToast('Network error — please check your connection.');
    console.error('[predict.js]', err);
  } finally {
    btn.disabled        = false;
    inner.style.display  = 'flex';
    spinner.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────────────
//  Reset to defaults
// ─────────────────────────────────────────────────────────────
function resetForm() {
  SLIDER_PAIRS.forEach(([sid, nid]) => {
    const slider = document.getElementById(sid);
    const num    = document.getElementById(nid);
    if (!slider || !num) return;
    slider.value = DEFAULTS[sid];
    num.value    = DEFAULTS[sid];
    // Re-trigger fill update
    slider.dispatchEvent(new Event('input'));
  });

  // Reset selects to today's values
  const now = new Date();
  document.getElementById('sel_month').value = now.getMonth() + 1;
  document.getElementById('sel_dow').value   = (now.getDay() + 6) % 7; // convert Sun=0 → Mon=0

  // Hide result panel
  const section = document.getElementById('resultSection');
  section.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────
//  Toast helper
// ─────────────────────────────────────────────────────────────
function showToast(msg) {
  const toast   = document.getElementById('errorToast');
  const msgSpan = document.getElementById('errorToastMsg');
  msgSpan.textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 6000);
}

// ─────────────────────────────────────────────────────────────
//  Boot
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Wire all slider↔number pairs
  SLIDER_PAIRS.forEach(([sid, nid]) => syncSliderToNumber(sid, nid));

  // Set temporal selects to today
  const now = new Date();
  document.getElementById('sel_month').value = now.getMonth() + 1;
  document.getElementById('sel_dow').value   = (now.getDay() + 6) % 7;

  // Form submit / reset
  document.getElementById('predictForm').addEventListener('submit', handleSubmit);
  document.getElementById('resetBtn').addEventListener('click', resetForm);

  // Staggered fade-in
  const sections = document.querySelectorAll('.fade-section');
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('visible'); obs.unobserve(e.target); } });
  }, { threshold: 0.06 });
  sections.forEach((s, i) => { s.style.transitionDelay = i * 80 + 'ms'; obs.observe(s); });
});

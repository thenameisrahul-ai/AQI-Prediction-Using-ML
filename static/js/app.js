/* ══════════════════════════════════════════════════════════════
   AQI India — app.js
   City search · AQI fetch/render · Dark mode · DB history
   ══════════════════════════════════════════════════════════════ */

'use strict';

// ─────────────────────────────────────────────────────────────
//  Pollutant Meta
// ─────────────────────────────────────────────────────────────
const POLLUTANT_META = {
  pm25: { label: 'PM₂.₅', htmlLabel: 'PM<sub>2.5</sub>', icon: '🫁', unit: 'μg/m³', max: 300 },
  pm10: { label: 'PM₁₀',  htmlLabel: 'PM<sub>10</sub>',  icon: '💨', unit: 'μg/m³', max: 450 },
  no2:  { label: 'NO₂',   htmlLabel: 'NO<sub>2</sub>',   icon: '🌫️', unit: 'μg/m³', max: 120 },
  so2:  { label: 'SO₂',   htmlLabel: 'SO<sub>2</sub>',   icon: '⚗️', unit: 'μg/m³', max: 80  },
  co:   { label: 'CO',    htmlLabel: 'CO',                icon: '🔥', unit: 'mg/m³', max: 10  },
  o3:   { label: 'O₃',    htmlLabel: 'O<sub>3</sub>',    icon: '☀️', unit: 'μg/m³', max: 200 },
  no:   { label: 'NO',    htmlLabel: 'NO',                icon: '💧', unit: 'μg/m³', max: 80  },
  nox:  { label: 'NOₓ',   htmlLabel: 'NO<sub>x</sub>',   icon: '🌪️', unit: 'μg/m³', max: 200 },
  nh3:  { label: 'NH₃',   htmlLabel: 'NH<sub>3</sub>',   icon: '🧪', unit: 'μg/m³', max: 100 },
};

// AQI color bands
const AQI_COLORS = [
  { max: 50,       color: '#22C55E', bg: 'rgba(34,197,94,0.12)',   border: 'rgba(34,197,94,0.3)'   },
  { max: 100,      color: '#84CC16', bg: 'rgba(132,204,22,0.12)',  border: 'rgba(132,204,22,0.3)'  },
  { max: 200,      color: '#F59E0B', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)'  },
  { max: 300,      color: '#F97316', bg: 'rgba(249,115,22,0.12)',  border: 'rgba(249,115,22,0.3)'  },
  { max: 400,      color: '#EF4444', bg: 'rgba(239,68,68,0.12)',   border: 'rgba(239,68,68,0.3)'   },
  { max: 500,      color: '#991B1B', bg: 'rgba(153,27,27,0.12)',   border: 'rgba(153,27,27,0.3)'   },
  { max: Infinity, color: '#581C87', bg: 'rgba(88,28,135,0.12)',   border: 'rgba(88,28,135,0.3)'   },
];

// Popular cities list (populated from API)
let CITY_LIST = [];

// ─────────────────────────────────────────────────────────────
//  State
// ─────────────────────────────────────────────────────────────
let currentCity      = null;
const counterMap     = new WeakMap(); // per-element RAF tracking
let autocompleteIdx  = -1;
let lastWeatherData  = null;   // cache weather for tab switch
let lastCityName     = null;   // cache city name for weather tab
let activeTab        = 'aqi';  // 'aqi' | 'weather'
let hasAqiData       = false;  // track if we have loaded data

// ─────────────────────────────────────────────────────────────
//  Utilities
// ─────────────────────────────────────────────────────────────
function aqiBand(aqi) {
  const v = parseFloat(aqi) || 0;
  return AQI_COLORS.find(b => v <= b.max) || AQI_COLORS.at(-1);
}

/** Map AQI value to % position on the 6-segment scale bar (0–301+) */
function aqiToPercent(aqi) {
  const v = Math.min(parseFloat(aqi) || 0, 400);
  const seg = 100 / 6; // 6 equal visual segments
  if (v <= 50)  return (v / 50) * seg;
  if (v <= 100) return seg + ((v - 50)  / 50)  * seg;
  if (v <= 150) return 2 * seg + ((v - 100) / 50)  * seg;
  if (v <= 200) return 3 * seg + ((v - 150) / 50)  * seg;
  if (v <= 300) return 4 * seg + ((v - 200) / 100) * seg;
  return Math.min(5 * seg + ((v - 300) / 100) * seg, 98.5);
}

function countUp(el, end, duration = 900, decimals = 0) {
  // Cancel only the animation for THIS element — others run independently
  if (counterMap.has(el)) cancelAnimationFrame(counterMap.get(el));
  const t0 = performance.now();
  function step(now) {
    const p = Math.min((now - t0) / duration, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = decimals
      ? (end * e).toFixed(decimals)
      : Math.round(end * e);
    if (p < 1) {
      counterMap.set(el, requestAnimationFrame(step));
    } else {
      counterMap.delete(el);
    }
  }
  counterMap.set(el, requestAnimationFrame(step));
}

function showToast(msg) {
  const toast = document.getElementById('errorToast');
  document.getElementById('errorToastMsg').textContent = msg;
  toast.classList.add('visible');
  setTimeout(() => toast.classList.remove('visible'), 7000);
}

function hideToast() {
  document.getElementById('errorToast').classList.remove('visible');
}

// ─────────────────────────────────────────────────────────────
//  Theme Toggle
// ─────────────────────────────────────────────────────────────
function initTheme() {
  const saved = localStorage.getItem('aqi-theme') || 'light';
  document.documentElement.setAttribute('data-theme', saved);
}

function toggleTheme() {
  const html    = document.documentElement;
  const current = html.getAttribute('data-theme') || 'light';
  const next    = current === 'light' ? 'dark' : 'light';
  html.setAttribute('data-theme', next);
  localStorage.setItem('aqi-theme', next);
}

// ─────────────────────────────────────────────────────────────
//  Autocomplete
// ─────────────────────────────────────────────────────────────
function filterCities(query) {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return CITY_LIST.filter(c => c.toLowerCase().includes(q)).slice(0, 10);
}

function highlightMatch(text, query) {
  if (!query) return text;
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return text;
  return (
    text.slice(0, idx) +
    '<mark>' + text.slice(idx, idx + query.length) + '</mark>' +
    text.slice(idx + query.length)
  );
}

function openAutocomplete(matches, query) {
  const list = document.getElementById('autocompleteList');
  if (!matches.length) { closeAutocomplete(); return; }

  list.innerHTML = matches.map((city, i) => `
    <li class="autocomplete-item" role="option" data-city="${city}" data-idx="${i}">
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
        <circle cx="12" cy="10" r="3"/>
      </svg>
      ${highlightMatch(city, query)}
    </li>
  `).join('');

  list.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('mousedown', e => {
      e.preventDefault();
      selectCity(item.dataset.city);
    });
  });

  list.classList.add('open');
  document.getElementById('citySearch').setAttribute('aria-expanded', 'true');
  autocompleteIdx = -1;
}

function closeAutocomplete() {
  const list = document.getElementById('autocompleteList');
  list.classList.remove('open');
  list.innerHTML = '';
  document.getElementById('citySearch').setAttribute('aria-expanded', 'false');
  autocompleteIdx = -1;
}

function navigateAutocomplete(direction) {
  const list  = document.getElementById('autocompleteList');
  const items = list.querySelectorAll('.autocomplete-item');
  if (!items.length) return;

  items[autocompleteIdx]?.classList.remove('highlighted');
  autocompleteIdx = (autocompleteIdx + direction + items.length) % items.length;
  items[autocompleteIdx].classList.add('highlighted');
  items[autocompleteIdx].scrollIntoView({ block: 'nearest' });
}

function selectCity(city) {
  const input = document.getElementById('citySearch');
  input.value = city;
  closeAutocomplete();
  fetchAndRender(city);
}

// ─────────────────────────────────────────────────────────────
//  Tab Switching
// ─────────────────────────────────────────────────────────────
function switchTab(tab) {
  activeTab = tab;
  const tabAqi     = document.getElementById('tabAqi');
  const tabWeather = document.getElementById('tabWeather');
  const aqiContent = document.getElementById('aqiDataContent');
  const wxContent  = document.getElementById('weatherTabContent');
  const emptyState = document.getElementById('emptyState');
  const loading    = document.getElementById('loadingState');

  if (tab === 'aqi') {
    tabAqi.classList.add('tab-active');
    tabAqi.setAttribute('aria-selected', 'true');
    tabWeather.classList.remove('tab-active');
    tabWeather.setAttribute('aria-selected', 'false');

    wxContent.style.display  = 'none';
    // Restore correct AQI panel state
    if (loading.style.display === 'flex') return; // still loading
    if (hasAqiData) {
      emptyState.style.display  = 'none';
      aqiContent.style.display  = 'flex';
    } else {
      emptyState.style.display  = 'block';
      aqiContent.style.display  = 'none';
    }
  } else {
    tabWeather.classList.add('tab-active');
    tabWeather.setAttribute('aria-selected', 'true');
    tabAqi.classList.remove('tab-active');
    tabAqi.setAttribute('aria-selected', 'false');

    emptyState.style.display  = 'none';
    aqiContent.style.display  = 'none';
    wxContent.style.display   = 'flex';

    renderWeatherTab();
  }
}

function renderWeatherTab() {
  const emptyWx   = document.getElementById('weatherEmptyState');
  const detailWx  = document.getElementById('weatherDetailContent');
  const unavailWx = document.getElementById('weatherUnavailable');

  emptyWx.style.display   = 'none';
  detailWx.style.display  = 'none';
  unavailWx.style.display = 'none';

  if (!lastWeatherData) {
    emptyWx.style.display = 'block';
    return;
  }

  const { temperature, humidity, wind, wind_gust, uvi, dew, pressure } = lastWeatherData;
  const hasAny = temperature != null || humidity != null || wind != null || uvi != null;

  if (!hasAny) {
    unavailWx.style.display = 'block';
    document.getElementById('weatherUnavailCity').textContent = lastCityName || 'this city';
    return;
  }

  detailWx.style.display = 'flex'; // flex-direction:column is defined in CSS

  // ── Helper: safe rounding ──
  const fmt = (v, d) => v != null ? parseFloat(v).toFixed(d) : null;

  // ── Hero ──
  const tempRaw = temperature != null ? parseFloat(temperature) : null;
  const tempRounded = tempRaw != null ? Math.round(tempRaw) : null;

  document.getElementById('wTabTemp').textContent = tempRounded != null ? tempRounded + '°C' : '—';

  // Feels-like (Heat Index for ≥27°C, else simple formula)
  let feelsLike = null;
  if (tempRaw != null && humidity != null) {
    const t = tempRaw, h = parseFloat(humidity);
    if (t >= 27) {
      const hi = -8.784 + 1.611*t + 2.339*h - 0.146*t*h - 0.0123*t*t
                 - 0.0164*h*h + 0.00221*t*t*h + 0.000725*t*h*h - 0.00000358*t*t*h*h;
      feelsLike = Math.round(hi);
    } else {
      feelsLike = Math.round(t - (0.55 - 0.0055*h) * (t - 14.5));
    }
  }
  const feelsEl = document.getElementById('wTabFeels');
  feelsEl.textContent = feelsLike != null ? `Feels like ${feelsLike}°C` : '';

  // Weather icon
  const iconEl = document.getElementById('wTabIcon');
  if (tempRounded != null) {
    if (tempRounded > 38)      iconEl.textContent = '🔥';
    else if (tempRounded > 33) iconEl.textContent = '🌞';
    else if (tempRounded > 26) iconEl.textContent = '🌤️';
    else if (tempRounded > 18) iconEl.textContent = '⛅';
    else if (tempRounded > 10) iconEl.textContent = '🌥️';
    else                       iconEl.textContent = '🌨️';
  } else if (uvi != null && parseFloat(uvi) > 6) {
    iconEl.textContent = '🌞';
  } else {
    iconEl.textContent = '🌤️';
  }

  // Condition text
  const condEl = document.getElementById('wTabCondition');
  if (humidity != null) {
    const h = parseFloat(humidity);
    if (h > 85)      condEl.textContent = 'Very Humid';
    else if (h > 70) condEl.textContent = 'Humid';
    else if (h > 55) condEl.textContent = 'Partly Cloudy';
    else if (h > 35) condEl.textContent = 'Mostly Clear';
    else             condEl.textContent = 'Clear & Dry';
  } else if (tempRounded != null) {
    condEl.textContent = tempRounded > 30 ? 'Hot & Sunny' : 'Current Conditions';
  } else {
    condEl.textContent = 'Current Conditions';
  }

  document.getElementById('wTabCity').textContent = lastCityName ? `📍 ${lastCityName}` : '—';

  // ── Humidity tile ──
  const wxCardHumidity  = document.getElementById('wxCardHumidity');
  const wxHumidityBar   = document.getElementById('wxHumidityBar');
  const wxHumidityDesc  = document.getElementById('wxHumidityDesc');
  if (humidity != null) {
    const h = parseFloat(humidity);
    document.getElementById('wxHumidity').textContent = Math.round(h) + '%';
    wxHumidityBar.style.width = Math.min(h, 100) + '%';
    if (h > 80)      wxHumidityDesc.textContent = 'Very Humid — feels muggy';
    else if (h > 60) wxHumidityDesc.textContent = 'Moderately Humid';
    else if (h > 40) wxHumidityDesc.textContent = 'Comfortable';
    else             wxHumidityDesc.textContent = 'Dry air';
    wxCardHumidity.classList.remove('unavailable');
  } else {
    document.getElementById('wxHumidity').textContent = '—';
    wxHumidityDesc.textContent = 'Not available';
    wxCardHumidity.classList.add('unavailable');
  }

  // ── Wind tile ──
  const wxCardWind     = document.getElementById('wxCardWind');
  const wxWindDesc     = document.getElementById('wxWindDesc');
  const wxWindGustLine = document.getElementById('wxWindGustLine');
  if (wind != null) {
    const w = parseFloat(wind);
    document.getElementById('wxWind').textContent = parseFloat(w).toFixed(1) + ' km/h';
    if (w < 1)       wxWindDesc.textContent = 'Calm';
    else if (w < 6)  wxWindDesc.textContent = 'Light air';
    else if (w < 12) wxWindDesc.textContent = 'Light breeze';
    else if (w < 20) wxWindDesc.textContent = 'Gentle breeze';
    else if (w < 29) wxWindDesc.textContent = 'Moderate breeze';
    else if (w < 39) wxWindDesc.textContent = 'Fresh breeze';
    else if (w < 50) wxWindDesc.textContent = 'Strong breeze';
    else             wxWindDesc.textContent = 'High wind';
    wxCardWind.classList.remove('unavailable');
    if (wind_gust != null) {
      wxWindGustLine.style.display = 'block';
      document.getElementById('wxWindGustVal').textContent = parseFloat(wind_gust).toFixed(1);
    } else {
      wxWindGustLine.style.display = 'none';
    }
  } else {
    document.getElementById('wxWind').textContent = '—';
    wxWindDesc.textContent = 'Not available';
    wxWindGustLine.style.display = 'none';
    wxCardWind.classList.add('unavailable');
  }

  // ── UV Index tile ──
  const wxCardUVI  = document.getElementById('wxCardUVI');
  const wxUVIBar   = document.getElementById('wxUVIBar');
  const wxUVIDesc  = document.getElementById('wxUVIDesc');
  if (uvi != null) {
    const u = parseFloat(uvi);
    document.getElementById('wxUVI').textContent = parseFloat(u).toFixed(1);
    wxUVIBar.style.width = Math.min((u / 11) * 100, 100) + '%';
    if (u < 3)       wxUVIDesc.textContent = 'Low — No protection needed';
    else if (u < 6)  wxUVIDesc.textContent = 'Moderate — Sunscreen advised';
    else if (u < 8)  wxUVIDesc.textContent = 'High — Cover up & use SPF 30+';
    else if (u < 11) wxUVIDesc.textContent = 'Very High — Limit sun exposure';
    else             wxUVIDesc.textContent = 'Extreme — Avoid going outside';
    wxCardUVI.classList.remove('unavailable');
  } else {
    document.getElementById('wxUVI').textContent = '—';
    wxUVIDesc.textContent = 'Not available';
    wxCardUVI.classList.add('unavailable');
  }

  // ── Dew Point tile ──
  const wxCardDew = document.getElementById('wxCardDew');
  const wxDewDesc = document.getElementById('wxDewDesc');
  if (dew != null) {
    const d = parseFloat(dew);
    document.getElementById('wxDew').textContent = parseFloat(d).toFixed(1) + '°C';
    if (d < 10)      wxDewDesc.textContent = 'Dry air — comfortable';
    else if (d < 16) wxDewDesc.textContent = 'Comfortable level';
    else if (d < 21) wxDewDesc.textContent = 'Somewhat humid';
    else if (d < 24) wxDewDesc.textContent = 'Very humid';
    else             wxDewDesc.textContent = 'Oppressively humid';
    wxCardDew.classList.remove('unavailable');
  } else {
    document.getElementById('wxDew').textContent = '—';
    wxDewDesc.textContent = 'Not available';
    wxCardDew.classList.add('unavailable');
  }

  // ── Pressure extra row ──
  const wxExtraRow = document.getElementById('wxExtraRow');
  if (pressure != null) {
    document.getElementById('wxPressure').textContent = Math.round(parseFloat(pressure)) + ' hPa';
    wxExtraRow.style.display = 'flex';
  } else {
    wxExtraRow.style.display = 'none';
  }

  // ── Comfort Level strip ──
  const wxComfortStrip = document.getElementById('wxComfortStrip');
  if (tempRaw != null && humidity != null) {
    const t = tempRaw, h = parseFloat(humidity);
    let icon, text, badge, bg, color;
    if (t < 10) {
      icon = '🥶'; text = 'Cold — Layer up for outdoor activities';
      badge = 'Cold'; bg = 'rgba(99,102,241,0.1)'; color = '#6366f1';
    } else if (t < 18) {
      icon = '😊'; text = 'Cool & Pleasant — Great for outdoor activities';
      badge = 'Cool'; bg = 'rgba(56,189,248,0.12)'; color = '#0ea5e9';
    } else if (t < 27 && h < 60) {
      icon = '😎'; text = 'Comfortable — Ideal outdoor conditions';
      badge = 'Ideal'; bg = 'rgba(34,197,94,0.12)'; color = '#16a34a';
    } else if (t < 32 && h < 70) {
      icon = '🌡️'; text = 'Warm — Stay hydrated while outdoors';
      badge = 'Warm'; bg = 'rgba(245,158,11,0.12)'; color = '#d97706';
    } else if (h > 75) {
      icon = '🥵'; text = 'Hot & Humid — High heat stress; limit exertion';
      badge = 'Oppressive'; bg = 'rgba(239,68,68,0.1)'; color = '#dc2626';
    } else {
      icon = '🌞'; text = 'Hot & Dry — Avoid peak sun hours';
      badge = 'Hot'; bg = 'rgba(249,115,22,0.1)'; color = '#ea580c';
    }
    document.getElementById('wxComfortIcon').textContent  = icon;
    document.getElementById('wxComfortValue').textContent = text;
    const badgeEl = document.getElementById('wxComfortBadge');
    badgeEl.textContent       = badge;
    badgeEl.style.background  = bg;
    badgeEl.style.color       = color;
    wxComfortStrip.style.display = 'flex';
  } else {
    wxComfortStrip.style.display = 'none';
  }

  // ── Outdoor Activity recommendation ──
  const wxOutdoorRec = document.getElementById('wxOutdoorRec');
  if (tempRaw != null) {
    const t = tempRaw;
    const h = humidity != null ? parseFloat(humidity) : 50;
    const u = uvi     != null ? parseFloat(uvi)      : 0;
    let outIcon, outText;
    if (t < 5) {
      outIcon = '🧤'; outText = 'Very cold — best to stay indoors or layer up heavily.';
    } else if (t < 15) {
      outIcon = '🚶'; outText = 'Cool and pleasant — great for walking and light exercise.';
    } else if (t < 25 && h < 65 && u < 7) {
      outIcon = '🏃'; outText = 'Excellent conditions for outdoor sports and activities.';
    } else if (t < 30 && u < 8) {
      outIcon = '🚴'; outText = 'Good for outdoor activities — carry water and wear sunscreen.';
    } else if (u >= 8) {
      outIcon = '🏖️'; outText = 'High UV — wear SPF 50+, avoid 10 am–4 pm direct sun exposure.';
    } else if (h > 80) {
      outIcon = '💦'; outText = 'High humidity — risk of heat exhaustion; stay well hydrated.';
    } else {
      outIcon = '🏠'; outText = 'Hot conditions — prefer light activities in early morning or evening.';
    }
    document.getElementById('wxOutdoorIcon').textContent = outIcon;
    document.getElementById('wxOutdoorDesc').textContent = outText;
    wxOutdoorRec.style.display = 'flex';
  } else {
    wxOutdoorRec.style.display = 'none';
  }

  // ── Weather Tips ──
  const tips = [];
  if (humidity != null && parseFloat(humidity) > 70)
    tips.push('High humidity makes air pollutants linger closer to ground level — consider limiting outdoor time.');
  if (uvi != null && parseFloat(uvi) >= 6)
    tips.push('Apply broad-spectrum sunscreen (SPF 30+) 15 minutes before going outside.');
  if (wind != null && parseFloat(wind) > 25)
    tips.push('Strong winds may carry dust and allergens — wearing a mask outdoors is advisable.');
  if (dew != null && parseFloat(dew) > 20)
    tips.push('High dew point indicates heavy moisture in the air — risk of dehydration is elevated.');
  if (tempRaw != null && tempRaw > 35)
    tips.push('Stay hydrated — drink at least 2–3 litres of water on hot days.');
  if (pressure != null && parseFloat(pressure) < 1005)
    tips.push('Low atmospheric pressure may signal approaching weather changes or rain.');
  if (!tips.length)
    tips.push('Weather conditions appear normal. Keep an eye on air quality for respiratory health.');
  document.getElementById('wxTipsList').innerHTML = tips.map(t => `<li>${t}</li>`).join('');
}

// ─────────────────────────────────────────────────────────────
//  UI States
// ─────────────────────────────────────────────────────────────
function showEmpty() {
  hasAqiData = false;
  document.getElementById('emptyState').style.display      = 'block';
  document.getElementById('loadingState').style.display    = 'none';
  document.getElementById('aqiDataContent').style.display  = 'none';
  document.getElementById('weatherTabContent').style.display = 'none';
  // Reset to AQI tab on empty
  activeTab = 'aqi';
  document.getElementById('tabAqi').classList.add('tab-active');
  document.getElementById('tabWeather').classList.remove('tab-active');
}

function showLoading() {
  document.getElementById('emptyState').style.display      = 'none';
  document.getElementById('loadingState').style.display    = 'flex';
  document.getElementById('aqiDataContent').style.display  = 'none';
  document.getElementById('weatherTabContent').style.display = 'none';
}

function showData() {
  hasAqiData = true;
  document.getElementById('emptyState').style.display     = 'none';
  document.getElementById('loadingState').style.display   = 'none';
  // Show the currently active tab content
  if (activeTab === 'weather') {
    document.getElementById('aqiDataContent').style.display  = 'none';
    document.getElementById('weatherTabContent').style.display = 'flex';
    renderWeatherTab();
  } else {
    document.getElementById('aqiDataContent').style.display  = 'flex';
    document.getElementById('weatherTabContent').style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────────────
//  Render Functions
// ─────────────────────────────────────────────────────────────
function renderAQI(data) {
  const { current, prediction, city_name, city } = data;
  const { aqi, category, color, health_advice, recommendations,
          dominant_pollutant, pollutants, weather, timestamp } = current;

  // Cache for weather tab
  lastWeatherData = weather || null;
  lastCityName    = city_name || city;

  const band = aqiBand(aqi);

  // City display
  document.getElementById('cityNameText').textContent = city_name || city;

  // Live dot color
  document.getElementById('liveDot').style.background = color;

  // Big AQI number
  const numEl = document.getElementById('aqiBigNumber');
  numEl.style.color = color;
  numEl.textContent = '0';
  setTimeout(() => countUp(numEl, aqi, 1000), 100);

  // Category badge
  const badge = document.getElementById('aqiCategoryBadge');
  badge.textContent    = category;
  badge.style.color    = color;
  badge.style.background = band.bg;
  badge.style.borderColor = band.border;

  // PM values
  const pm25 = pollutants.pm25 ?? 0;
  const pm10 = pollutants.pm10 ?? 0;
  document.getElementById('pm25Display').textContent = pm25.toFixed(1) + ' μg/m³';
  document.getElementById('pm10Display').textContent = pm10.toFixed(1) + ' μg/m³';

  // Scale marker
  const dot = document.getElementById('scaleDot');
  const pct = aqiToPercent(aqi);
  dot.style.display = 'flex';
  dot.querySelector('.scale-dot-inner').style.background = color;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      dot.style.left = pct + '%';
    });
  });

  // Pollutants grid
  renderPollutants(pollutants);

  // Health advisory
  const advisory = document.getElementById('healthAdvisory');
  if (health_advice) {
    advisory.style.display = 'block';
    advisory.style.borderColor = band.border;
    advisory.style.background  = band.bg;
    document.getElementById('advisoryText').textContent = health_advice;
    const recsList = document.getElementById('advisoryRecs');
    recsList.innerHTML = (recommendations || []).map(r => `<li>${r}</li>`).join('');
    // Update advisory header color
    const advHeader = advisory.querySelector('.advisory-header');
    if (advHeader) advHeader.style.color = color;
  } else {
    advisory.style.display = 'none';
  }

  // 2-Day forecast
  const multiDayForecast = document.getElementById('multiDayForecast');
  if (prediction && prediction.tomorrow) {
    multiDayForecast.style.display = 'block';

    // ── Tomorrow ──
    const tmr     = prediction.tomorrow;
    const tmrBand = aqiBand(tmr.aqi);

    document.getElementById('forecastTomorrowDate').textContent = tmr.date || '';

    const tmrBox = document.getElementById('forecastTomorrowBox');
    tmrBox.style.borderColor = tmrBand.color;
    tmrBox.style.background  = tmrBand.bg;

    const tmrNum = document.getElementById('forecastAqiNum');
    tmrNum.textContent = '0';
    setTimeout(() => countUp(tmrNum, tmr.aqi, 900), 200);

    const tmrCat = document.getElementById('forecastCat');
    tmrCat.textContent      = tmr.category;
    tmrCat.style.background = tmr.color;

    document.getElementById('forecastAdvice').textContent = tmr.health_advice || '';

    // ── Day After Tomorrow ──
    const dat     = prediction.day_after_tomorrow;
    const datBand = aqiBand(dat.aqi);

    document.getElementById('forecastDayAfterDate').textContent = dat.date || '';

    const datBox = document.getElementById('forecastDayAfterBox');
    datBox.style.borderColor = datBand.color;
    datBox.style.background  = datBand.bg;

    const datNum = document.getElementById('forecastDayAfterAqiNum');
    datNum.textContent = '0';
    setTimeout(() => countUp(datNum, dat.aqi, 900), 350);

    const datCat = document.getElementById('forecastDayAfterCat');
    datCat.textContent      = dat.category;
    datCat.style.background = dat.color;

    document.getElementById('forecastDayAfterAdvice').textContent = dat.health_advice || '';
  }

  // Weather
  renderWeather(weather);

  // Timestamps
  document.getElementById('lastUpdatedText').textContent =
    'Last Updated: ' + (timestamp || '—') + ' (Local Time)';
  document.getElementById('dominantText').textContent =
    dominant_pollutant ? dominant_pollutant.toUpperCase() : '—';

  showData();
}

function renderPollutants(pollutants) {
  const grid = document.getElementById('pollutantsDetailGrid');
  grid.innerHTML = '';

  Object.entries(POLLUTANT_META).forEach(([key, meta], i) => {
    const raw   = pollutants[key] ?? null;
    if (raw === null) return;
    const value = parseFloat(raw);
    const pct   = Math.min((value / meta.max) * 100, 100);
    const band  = aqiBand((value / meta.max) * 200);

    const card = document.createElement('div');
    card.className = 'pollutant-detail-card';
    card.style.animationDelay = `${i * 50}ms`;
    card.innerHTML = `
      <div class="poll-card-header">
        <div class="poll-emoji">${meta.icon}</div>
        <div class="poll-name">${meta.htmlLabel}</div>
      </div>
      <div class="poll-value-row">
        <span class="poll-value" data-target="${value.toFixed(key === 'co' ? 2 : 1)}">0</span>
        <span class="poll-unit">${meta.unit}</span>
      </div>
      <div class="poll-bar-wrap">
        <div class="poll-bar" style="background:${band.color}; width:0%"></div>
      </div>`;

    grid.appendChild(card);

    requestAnimationFrame(() => {
      const valEl = card.querySelector('.poll-value');
      countUp(valEl, value, 750, key === 'co' ? 2 : 1);
      setTimeout(() => {
        card.querySelector('.poll-bar').style.width = pct + '%';
      }, 80 + i * 50);
    });
  });
}

function renderWeather(weather) {
  if (!weather) return;
  const { temperature, humidity, wind, uvi } = weather;

  const hasAny = temperature != null || humidity != null || wind != null;
  const strip  = document.getElementById('weatherStrip');

  if (!hasAny) { strip.style.display = 'none'; return; }

  strip.style.display = 'flex';

  if (temperature != null) {
    document.getElementById('weatherTemp').textContent = Math.round(parseFloat(temperature)) + '°C';
    // Set weather icon based on temp
    const iconEl = document.getElementById('weatherIcon');
    if (temperature > 35) iconEl.textContent = '🌞';
    else if (temperature > 25) iconEl.textContent = '⛅';
    else if (temperature > 15) iconEl.textContent = '🌤️';
    else iconEl.textContent = '🌥️';
    document.getElementById('weatherDesc').textContent = '';
  } else {
    document.getElementById('weatherTemp').textContent = '—';
  }

  const humidityItem = document.getElementById('humidityItem');
  if (humidity != null) {
    humidityItem.style.display = 'flex';
    document.getElementById('humidityVal').textContent = Math.round(parseFloat(humidity)) + '%';
  } else {
    humidityItem.style.display = 'none';
  }

  const windItem = document.getElementById('windItem');
  if (wind != null) {
    windItem.style.display = 'flex';
    document.getElementById('windVal').textContent = parseFloat(wind).toFixed(1) + ' km/h';
  } else {
    windItem.style.display = 'none';
  }

  const uviItem = document.getElementById('uviItem');
  if (uvi != null) {
    uviItem.style.display = 'flex';
    document.getElementById('uviVal').textContent = uvi;
  } else {
    uviItem.style.display = 'none';
  }
}

// ─────────────────────────────────────────────────────────────
//  History (DB)
// ─────────────────────────────────────────────────────────────
async function loadHistory() {
  try {
    const res  = await fetch('/api/history');
    const data = await res.json();
    if (!data.success || !data.history.length) return;

    const card = document.getElementById('historyCard');
    const list = document.getElementById('historyList');
    card.style.display = 'block';

    list.innerHTML = data.history.map(h => {
      const band  = h.color ? { color: h.color } : { color: '#64748b' };
      const aqiVal = h.aqi != null ? Math.round(h.aqi) : '—';
      return `
        <div class="history-item" data-city="${h.city}" role="button" tabindex="0" title="${h.city}">
          <div>
            <div class="history-city">${h.city}</div>
            <div class="history-cat">${h.category || ''}</div>
          </div>
          <div class="history-aqi" style="color:${band.color}">${aqiVal}</div>
        </div>`;
    }).join('');

    list.querySelectorAll('.history-item').forEach(item => {
      item.addEventListener('click', () => {
        document.getElementById('citySearch').value = item.dataset.city;
        fetchAndRender(item.dataset.city);
      });
      item.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
          document.getElementById('citySearch').value = item.dataset.city;
          fetchAndRender(item.dataset.city);
        }
      });
    });
  } catch (e) {
    console.warn('[history]', e);
  }
}

// ─────────────────────────────────────────────────────────────
//  Fetch & Render Pipeline
// ─────────────────────────────────────────────────────────────
async function fetchAndRender(city) {
  currentCity = city;
  hideToast();
  showLoading();

  // Update city display immediately
  document.getElementById('cityNameText').textContent = city + ', India';

  try {
    const res  = await fetch('/api/aqi?city=' + encodeURIComponent(city));
    const data = await res.json();

    if (!data.success) {
      showEmpty();
      showToast(data.error || 'City not found. Try a different name.');
      return;
    }

    renderAQI(data);

    // Refresh history after new search
    loadHistory();

  } catch (err) {
    showEmpty();
    showToast('Network error — please check your connection and try again.');
    console.error('[AQI]', err);
  }
}

// ─────────────────────────────────────────────────────────────
//  Share
// ─────────────────────────────────────────────────────────────
function initShare() {
  document.getElementById('shareBtn').addEventListener('click', async () => {
    if (!currentCity) return;
    const text = `Check AQI for ${currentCity}: ${window.location.href}`;
    if (navigator.share) {
      try { await navigator.share({ title: 'AQI — ' + currentCity, text, url: window.location.href }); }
      catch {}
    } else if (navigator.clipboard) {
      await navigator.clipboard.writeText(window.location.href);
      showToast('Link copied to clipboard!');
    }
  });
}

// ─────────────────────────────────────────────────────────────
//  Boot
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Theme
  initTheme();
  document.getElementById('themeToggle').addEventListener('click', toggleTheme);

  // Load cities from API
  try {
    const res = await fetch('/api/cities');
    const json = await res.json();
    CITY_LIST = json.cities || [];
  } catch {
    CITY_LIST = ['Delhi', 'Mumbai', 'Bangalore', 'Chennai', 'Kolkata', 'Hyderabad', 'Pune', 'Ahmedabad'];
  }

  // Search input
  const input = document.getElementById('citySearch');

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length >= 1) {
      openAutocomplete(filterCities(q), q);
    } else {
      closeAutocomplete();
    }
  });

  input.addEventListener('keydown', e => {
    const list = document.getElementById('autocompleteList');
    if (!list.classList.contains('open')) {
      if (e.key === 'Enter' && input.value.trim()) {
        fetchAndRender(input.value.trim());
      }
      return;
    }
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); navigateAutocomplete(1);  break;
      case 'ArrowUp':   e.preventDefault(); navigateAutocomplete(-1); break;
      case 'Enter':
        e.preventDefault();
        if (autocompleteIdx >= 0) {
          const highlighted = list.querySelector('.autocomplete-item.highlighted');
          if (highlighted) selectCity(highlighted.dataset.city);
        } else if (input.value.trim()) {
          closeAutocomplete();
          fetchAndRender(input.value.trim());
        }
        break;
      case 'Escape':
        closeAutocomplete();
        break;
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(closeAutocomplete, 200);
  });

  // GPS button
  document.getElementById('gpsBtn').addEventListener('click', () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by your browser.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        const cityQuery = `geo:${latitude};${longitude}`;
        fetchAndRender(cityQuery);
      },
      () => showToast('Unable to detect location. Please allow location access.')
    );
  });

  // Quick city buttons
  document.querySelectorAll('.quick-city-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const city = btn.dataset.city;
      document.getElementById('citySearch').value = city;
      fetchAndRender(city);
    });
  });

  // Tab switching
  document.getElementById('tabAqi').addEventListener('click', () => switchTab('aqi'));
  document.getElementById('tabWeather').addEventListener('click', () => switchTab('weather'));

  // Hamburger menu toggle
  const menuBtn      = document.getElementById('menuBtn');
  const navDropdown  = document.getElementById('navDropdown');
  menuBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = navDropdown.classList.contains('open');
    navDropdown.classList.toggle('open', !isOpen);
    menuBtn.setAttribute('aria-expanded', String(!isOpen));
    navDropdown.setAttribute('aria-hidden',  String(isOpen));
  });
  // Close when clicking outside
  document.addEventListener('click', (e) => {
    if (!menuBtn.contains(e.target) && !navDropdown.contains(e.target)) {
      navDropdown.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
      navDropdown.setAttribute('aria-hidden', 'true');
    }
  });
  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && navDropdown.classList.contains('open')) {
      navDropdown.classList.remove('open');
      menuBtn.setAttribute('aria-expanded', 'false');
      navDropdown.setAttribute('aria-hidden', 'true');
      menuBtn.focus();
    }
  });

  // Share
  initShare();

  // Load history from DB
  loadHistory();

  // Show empty state initially
  showEmpty();
});

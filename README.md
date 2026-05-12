# AQI-Prediction-Using-ML
This project uses the XGBoost Machine Learning algorithm with historical AQI datasets to predict tomorrow’s Air Quality Index, while the WAQI API provides today’s live air quality data for real-time monitoring and analysis.
### Real-time Air Quality Index for Indian Cities — Search, Monitor & Forecast

[![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat-square&logo=python&logoColor=white)](https://python.org)
[![Flask](https://img.shields.io/badge/Flask-3.x-000000?style=flat-square&logo=flask&logoColor=white)](https://flask.palletsprojects.com)
[![XGBoost](https://img.shields.io/badge/XGBoost-3.1.1-FF6600?style=flat-square)](https://xgboost.readthedocs.io)
[![SQLite](https://img.shields.io/badge/SQLite-3-003B57?style=flat-square&logo=sqlite&logoColor=white)](https://sqlite.org)
[![License](https://img.shields.io/badge/License-MIT-22C55E?style=flat-square)](LICENSE)

**AQI India** combines real-time data from the WAQI API with a gradient-boosted ML model
trained on 6 years of Indian city pollution records. Search any city, view live AQI and 9
pollutants, check weather conditions, and see **tomorrow's predicted AQI** — all in a clean,
light-mode-first interface with persistent search history.

[Dashboard](#️-pages) · [API Docs](#-api-reference) · [ML Pipeline](#-ml-pipeline) · [Quick Start](#-quick-start)

</div>

---

## 📑 Table of Contents

1. [Project Overview](#-project-overview)
2. [Features](#-features)
3. [Tech Stack](#️-tech-stack)
4. [Project Structure](#-project-structure)
5. [Dataset](#-dataset)
6. [ML Pipeline](#-ml-pipeline)
7. [Model Performance](#-model-performance)
8. [Quick Start](#-quick-start)
9. [Configuration](#️-configuration)
10. [Pages](#️-pages)
11. [API Reference](#-api-reference)
12. [AQI Reference](#-aqi-reference)
13. [Notebook Walkthrough](#-notebook-walkthrough)
14. [Troubleshooting](#-troubleshooting)

---

## 🔍 Project Overview

AQI India is a full-stack web application for real-time air quality monitoring. The redesigned
interface lets users **search any Indian city by name** (with autocomplete and GPS detection),
then instantly see current AQI, 9 individual pollutants, live weather conditions, a health
advisory, and an XGBoost-powered forecast for tomorrow's AQI.

All searches are **persisted in a local SQLite database** and shown in a Recent Searches sidebar,
so frequently monitored cities are always one click away.

| Mode | How it works |
|------|-------------|
| **City Search** | Type a city name (or use GPS), fetch real-time sensor data from the WAQI API, render AQI + pollutants + weather + forecast |
| **Weather Tab** | Shows temperature, feels-like, humidity, wind speed & gust, UV index with level descriptions, dew point, pressure, comfort level, outdoor recommendations, and contextual tips |
| **Manual Prediction** | Enter custom pollutant readings, run through the same ML pipeline, get a predicted AQI with health advice |

---

## ✨ Features

### Dashboard — AQI Tab
- **City search bar** with autocomplete (60+ Indian cities), keyboard navigation, and GPS detection
- **Live AQI** — animated count-up number, pulsing dot, and colour-coded category badge
- **PM₂.₅ / PM₁₀ summary row** — displayed directly above the gradient scale bar
- **Gradient AQI scale bar** — animated marker dot that slides to the correct position
- **9-pollutant breakdown grid** — PM₂.₅, PM₁₀, NO₂, SO₂, CO, O₃, NO, NOₓ, NH₃ — each with animated count-up value and proportional bar
- **Health Advisory** — category-coloured panel with advice text and bullet recommendations
- **AI Tomorrow Forecast** — XGBoost prediction with category badge, colour, and health advice
- **Weather strip** — compact temperature, humidity, wind, UV below the main AQI data
- **Recent Searches sidebar** — last 8 unique cities from SQLite, clickable to re-fetch
- **AQI Scale reference card** — all 7 India AQI categories with colour dots and ranges
- **Error toast** — graceful error notification with auto-dismiss

### Dashboard — Weather Tab
- **Hero banner** — large weather emoji (auto-selected by temperature), temperature (°C), feels-like, condition text, city label
- **2×2 stat cards**
  - Humidity with animated progress bar and description (Dry / Comfortable / Humid / Very Humid)
  - Wind speed with Beaufort-scale description and gust speed (if available)
  - UV Index with gradient progress bar and level text (Low → Extreme)
  - Dew point with comfort interpretation
- **Pressure tile** — atmospheric pressure (hPa) shown when available from station
- **Comfort Level strip** — emoji, description, and colour-coded badge (Cold / Cool / Ideal / Warm / Hot / Oppressive)
- **Outdoor Activity recommendation** — contextual icon and one-sentence advice
- **Weather Tips** — 1–4 dynamically generated tips based on actual readings

### UI / UX
- **Light mode by default** — clean blue-white-to-cream gradient background; persisted via `localStorage`
- **Dark mode toggle** — sun/moon icon button, instant theme switch, no flash on reload (inline script before paint)
- **Hamburger navigation menu** — dropdown with Home / AI Prediction / About links; animates to × when open; closes on outside click or Escape
- **Smooth count-up animations** — per-element `WeakMap`-based RAF tracking so all 9 pollutant cards and the AQI number animate simultaneously without cancelling each other
- **Staggered card fade-in** via CSS animation delay
- **Autocomplete dropdown** — `<mark>` highlighted matches, arrow-key + Enter navigation
- **Quick city buttons** — Delhi, Mumbai, Bangalore, Chennai, Hyderabad on the empty state
- **Fully responsive** — side panel collapses on mobile

### Manual Prediction Page (`/predict`)
- Synced sliders + number inputs for all 14 model features
- Pre-seeded with realistic city defaults
- Instant result card — predicted AQI, scale marker, category badge, health recommendations
- Reset button

---

## 🛠️ Tech Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Backend** | Flask 3.x | REST API + Jinja2 server-side rendering |
| **ML Model** | XGBoost 3.1.1 | Gradient-boosted regressor (500 trees, next-day AQI) |
| **ML Utils** | scikit-learn | StandardScaler, metrics, train/test split |
| **Data** | pandas + NumPy | Cleaning, imputation, feature engineering |
| **Database** | SQLite (built-in) | Persistent search history via `database.py` |
| **Serialisation** | joblib | Loading `.pkl` model artifacts at startup |
| **External Data** | WAQI API | Real-time pollutant + weather readings |
| **Notebook** | Jupyter + matplotlib + seaborn | EDA, model training, evaluation |
| **Frontend** | Vanilla JS (ES2020) | Zero-dependency — WeakMap animations, RAF, fetch |
| **Styling** | Custom CSS (no Bootstrap) | CSS variables, light/dark theming, grid + flex layout |
| **Fonts** | Google Fonts — Outfit + DM Sans | Headings and body text |

---

## 📁 Project Structure

```
AQI-India/
│
├── app.py                    # Flask application — routes, WAQI fetch, ML inference, API
├── database.py               # SQLite helpers — init_db(), save_search(), get_recent_searches()
├── requirements.txt          # Python dependencies
├── AQI_Prediction.ipynb      # Jupyter Notebook — complete ML training pipeline
│
├── aqi_model.pkl             # Trained XGBoost regressor
├── scaler.pkl                # Fitted StandardScaler
├── feature_names.pkl         # Ordered list of 14 feature names
├── aqi_history.db            # SQLite database (auto-created on first run)
│
├── eda_plots.png             # EDA visualisations (generated by notebook)
├── model_evaluation.png      # Model performance plots (generated by notebook)
│
├── dataset/
│   ├── city_day.csv          # PRIMARY — daily AQI by city (used for training)
│   ├── city_hour.csv         # Hourly granularity
│   ├── station_day.csv       # Station-level daily
│   ├── station_hour.csv      # Station-level hourly
│   └── stations.csv          # Station metadata + coordinates
│
├── templates/
│   ├── index.html            # Main dashboard — search, AQI tab, Weather tab
│   ├── predict.html          # Manual prediction form
│   └── about.html            # Project documentation
│
└── static/
    ├── css/
    │   └── style.css         # Full styling — light/dark CSS variables, all components
    └── js/
        ├── app.js            # Dashboard logic — search, fetch, render, animations, tabs
        └── predict.js        # Prediction form — sliders, submit, result card
```

---

## 🗄️ Dataset

**Source:** [Air Quality Data in India — Kaggle (CPCB)](https://www.kaggle.com/datasets/rohanrao/air-quality-data-in-india)

### Primary File: `city_day.csv`

| Property | Value |
|----------|-------|
| Rows | 29,531 (raw) → 24,824 (after cleaning) |
| Cities | 29 major Indian cities |
| Date Range | January 2015 — July 2020 |
| Frequency | Daily averaged readings |

### Columns

| Column | Type | Unit | Missing % |
|--------|------|------|-----------|
| City | Categorical | — | 0% |
| Date | Date | YYYY-MM-DD | 0% |
| PM2.5 | Pollutant | μg/m³ | 17.9% |
| PM10 | Pollutant | μg/m³ | 37.6% |
| NO | Pollutant | μg/m³ | 19.3% |
| NO2 | Pollutant | μg/m³ | 18.9% |
| NOx | Pollutant | ppb | 19.3% |
| NH3 | Pollutant | μg/m³ | 34.9% |
| CO | Pollutant | mg/m³ | 18.5% |
| SO2 | Pollutant | μg/m³ | 17.1% |
| O3 | Pollutant | μg/m³ | 20.7% |
| Benzene | VOC | μg/m³ | 29.2% |
| Toluene | VOC | μg/m³ | 38.5% |
| Xylene | VOC | μg/m³ | 61.3% |
| **AQI** | Target | 0–500+ | 15.8% |
| AQI_Bucket | Category | Text | 15.8% |

### Data Cleaning Steps

1. **Drop null AQI rows** — removes 4,681 rows
2. **City-level median imputation** — fills missing pollutants using city-specific median
3. **Global median fallback** — remaining NaNs filled with dataset-wide median
4. **Date parsing** — `Date` → `datetime64`, extract `Year`, `Month`, `DayOfWeek`
5. **Target creation** — `AQI_Tomorrow = AQI.shift(-1)` within each city group
6. **Drop boundary rows** — last record per city (no "tomorrow" available)

---

## 🤖 ML Pipeline

```
Raw Data (city_day.csv)
        │
        ▼
┌───────────────────┐
│  Data Cleaning    │  Drop null AQI, city-median imputation
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐
│ Feature Eng.      │  Parse dates → Month, DayOfWeek
│                   │  Shift AQI by -1 → AQI_Tomorrow (target)
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     ┌──────────────────────┐
│ Train/Test Split  │────►│ 80% Train / 20% Test  │
│ (random, seed=42) │     │ 19,859  /  4,965 rows │
└─────────┬─────────┘     └──────────────────────┘
          │
          ▼
┌───────────────────┐
│ StandardScaler    │  Fit on train only → transform both sets
│ (saved to pkl)    │
└─────────┬─────────┘
          │
          ▼
┌───────────────────┐     n_estimators=500, max_depth=6
│  XGBRegressor     │     learning_rate=0.05, subsample=0.8
│  (saved to pkl)   │     colsample_bytree=0.8
│                   │     reg_alpha=0.1, reg_lambda=1.0
└─────────┬─────────┘
          │
          ▼
    Predict AQI_Tomorrow  →  Map to category  →  Health Advice
```

### Feature Vector (14 features, in order)

```python
["PM2.5", "PM10", "NO", "NO2", "NOx", "NH3",
 "CO", "SO2", "O3", "Benzene", "Toluene", "Xylene",
 "Month", "DayOfWeek"]
```

> ⚠️ **Order matters.** The scaler was fit on features in exactly this sequence.

### Inference Pipeline (Live & Manual)

```
Sensor readings (WAQI API / form input)
        │
        ├── Fill missing pollutants with city-level defaults
        ├── Add temporal features: Month, DayOfWeek
        ▼
Build 14-element feature vector (in training order)
        │
        ▼
scaler.transform(vector)     ← loaded from scaler.pkl
        │
        ▼
model.predict(scaled)        ← loaded from aqi_model.pkl
        │
        ▼
Clip to ≥0  →  map to category  →  return JSON
```

---

## 📊 Model Performance

Evaluated on **4,965 held-out test samples** (20% of cleaned dataset):

| Metric | Description |
|--------|-------------|
| **MAE** | Mean Absolute Error (avg AQI points off) |
| **RMSE** | Root Mean Squared Error (penalises large errors) |
| **R²** | Proportion of AQI variance explained |
| **MAPE** | Mean Absolute Percentage Error |

> Run **Cell 7** of `AQI_Prediction.ipynb` to see exact values.

### Feature Importance (approximate ranking)

1. **PM2.5** — strongest predictor of next-day AQI
2. **PM10** — second most important particulate
3. **CO** — carbon monoxide
4. **NO2** — nitrogen dioxide
5. **O3** — ground-level ozone
6. **Month** — captures Indian seasonal patterns (winter peaks)
7. **SO2**, **NOx**, **NO**, **NH3**, **Benzene**, **Toluene**, **Xylene**, **DayOfWeek**

---

## ⚡ Quick Start

### Prerequisites

- Python 3.10 or higher
- pip package manager
- Internet connection (for WAQI API)

### 1. Clone / enter the project directory

```bash
cd "Air-Quality-Index-Prediction-for-Indian-Cities-Realtime-"
```

### 2. Create a virtual environment (recommended)

```bash
python -m venv venv
source venv/bin/activate          # macOS / Linux
# OR
venv\Scripts\activate             # Windows
```

### 3. Install dependencies

```bash
pip install -r requirements.txt
```

### 4. Ensure model artifacts are present

The following files must exist at the project root (generated by the Jupyter Notebook):

```
aqi_model.pkl
scaler.pkl
feature_names.pkl
```

If missing, run all cells in `AQI_Prediction.ipynb` first:

```bash
jupyter notebook AQI_Prediction.ipynb
# Kernel → Restart & Run All
```

### 5. Start the Flask server

```bash
python app.py
```

```
 * Running on http://127.0.0.1:5001
 * [startup] Model loaded. Features: ['PM2.5', 'PM10', ...]
```

The SQLite database (`aqi_history.db`) is created automatically on first run.

### 6. Open in your browser

| Page | URL |
|------|-----|
| Dashboard | http://127.0.0.1:5001/ |
| Manual Prediction | http://127.0.0.1:5001/predict |
| About | http://127.0.0.1:5001/about |

---

## ⚙️ Configuration

All key settings live at the top of `app.py`:

```python
# ── API ─────────────────────────────────────────
WAQI_TOKEN   = "your_token_here"
WAQI_URL     = "https://api.waqi.info/feed/{city}/?token={token}"
DEFAULT_CITY = "Delhi"

# ── Imputation defaults (used when WAQI doesn't report a pollutant)
CITY_DEFAULTS = {
    "PM2.5": 30.0, "PM10": 60.0, "NO": 8.0,
    "NO2": 25.0,   "NOx":  33.0, "NH3": 10.0,
    "CO":   0.9,   "SO2":   8.0, "O3":  35.0,
    "Benzene": 2.0, "Toluene": 6.0, "Xylene": 1.5,
}
```

The SQLite database path is configured in `database.py`:

```python
DB_PATH = os.path.join(os.path.dirname(__file__), "aqi_history.db")
```

---

## 🖥️ Pages

### `/` — Live Dashboard

The main interface. Search any Indian city to see:

| Section | Details |
|---------|---------|
| **AQI Tab** | Live AQI number + animated scale marker, 9-pollutant breakdown grid, health advisory, tomorrow's AI forecast, compact weather strip |
| **Weather Tab** | Hero banner (icon, temp, feels-like, condition), 4 stat cards (humidity + progress bar, wind + gust, UV index + progress bar, dew point), pressure tile, comfort level strip, outdoor activity recommendation, weather tips |
| **Side Panel** | Recent searches from SQLite (last 8 unique cities), India AQI scale reference, data source info |

**Navigation:**
- **Search bar** — autocomplete with 60+ cities, keyboard nav (↑↓ Enter Escape)
- **GPS button** — detects current location via browser geolocation API
- **Theme toggle** — sun/moon icon, persists via `localStorage`
- **Hamburger menu** — dropdown with Home / AI Prediction / About links

---

### `/predict` — Manual Prediction

Enter any combination of pollutant readings to get a next-day AQI prediction.

**Use cases:**
- Testing with your own sensor data
- Offline / API-unavailable scenarios
- Educational exploration of pollutant impact on AQI

**Input groups:**

| Group | Fields |
|-------|--------|
| Particulate Matter | PM₂.₅ (0–500 μg/m³), PM₁₀ (0–600 μg/m³) |
| Nitrogen Compounds | NO, NO₂, NOx (0–150 μg/m³), NH₃ (0–100 μg/m³) |
| Other Gases | CO (0–20 mg/m³), SO₂, O₃, Benzene, Toluene, Xylene |
| Temporal | Month (1–12), Day of Week (Mon–Sun) |

---

### `/about` — Documentation

Full project documentation: ML pipeline, dataset details, model hyperparameters, AQI reference table, and technology stack.

---

## 📡 API Reference

### `GET /api/aqi?city={city_name}`

Fetches real-time AQI + weather from WAQI, runs ML prediction, saves to SQLite, returns combined JSON.

**Parameters:**

| Param | Type | Required | Default | Example |
|-------|------|----------|---------|---------|
| `city` | string | No | `Delhi` | `Mumbai` |

Supports geo-coordinates: `city=geo:12.97;77.59`

**Response:**

```json
{
  "success": true,
  "city": "Mumbai",
  "city_name": "Mumbai, Maharashtra, India",
  "current": {
    "aqi": 134,
    "category": "Moderate",
    "color": "#F59E0B",
    "health_advice": "May cause breathing discomfort...",
    "recommendations": ["Wear a mask outdoors", "..."],
    "dominant_pollutant": "pm25",
    "pollutants": {
      "pm25": 134.0, "pm10": 77.0,
      "co": 0.9, "so2": 5.2,
      "no2": 22.1, "o3": 35.0,
      "no": 8.0, "nox": 33.0, "nh3": 2.9
    },
    "weather": {
      "temperature": 27.5,
      "humidity": 68.0,
      "wind": 12.3,
      "wind_gust": 18.5,
      "uvi": 5.2,
      "dew": 21.0,
      "pressure": 1013.0
    },
    "timestamp": "2026-04-12 10:30:00"
  },
  "prediction": {
    "aqi": 140.5,
    "category": "Moderate",
    "color": "#F59E0B",
    "health_advice": "May cause breathing discomfort...",
    "recommendations": ["..."]
  }
}
```

---

### `GET /api/history`

Returns the 8 most recently searched unique cities from SQLite.

**Response:**

```json
{
  "success": true,
  "history": [
    {
      "city": "Somajiguda, Hyderabad, India",
      "aqi": 107,
      "category": "Moderate",
      "color": "#F59E0B"
    },
    { "city": "Delhi", "aqi": 189, "category": "Moderate", "color": "#F59E0B" }
  ]
}
```

---

### `POST /api/predict`

Runs the ML model on manually provided pollutant values.

**Request body (JSON):**

```json
{
  "PM2.5": 85.4, "PM10": 142.7,
  "NO": 8.3,     "NO2": 32.1,   "NOx": 40.6,  "NH3": 15.2,
  "CO": 1.1,     "SO2": 12.5,   "O3": 38.9,
  "Benzene": 2.4, "Toluene": 8.7, "Xylene": 1.9,
  "Month": 11,   "DayOfWeek": 2
}
```

> All fields optional — missing fields fall back to `CITY_DEFAULTS`.

**Response:**

```json
{
  "success": true,
  "predicted_aqi": 187.3,
  "category": "Moderate",
  "color": "#F59E0B",
  "health_advice": "May cause breathing discomfort...",
  "recommendations": ["..."],
  "inputs": { "PM2.5": 85.4, "PM10": 142.7, "..." : "..." }
}
```

---

### `GET /api/cities`

Returns the list of 60+ supported Indian cities for autocomplete.

**Response:**

```json
{
  "cities": ["Bangalore", "Delhi", "Mumbai", "Chennai", "Kolkata",
             "Hyderabad", "Pune", "Ahmedabad", "..."]
}
```

---

## 🌈 AQI Reference

| Category | AQI Range | Color | Health Impact |
|----------|-----------|-------|---------------|
| **Good** | 0 – 50 | 🟢 `#22C55E` | Minimal or no impact |
| **Satisfactory** | 51 – 100 | 🟡 `#84CC16` | Minor breathing discomfort to sensitive people |
| **Moderate** | 101 – 200 | 🟠 `#F59E0B` | Discomfort to people with lung/heart disease |
| **Poor** | 201 – 300 | 🔶 `#F97316` | Respiratory discomfort on prolonged exposure |
| **Very Poor** | 301 – 400 | 🔴 `#EF4444` | Respiratory illness on prolonged exposure |
| **Severe** | 401 – 500 | 🟤 `#991B1B` | Serious health effects for everyone |
| **Hazardous** | 500+ | 🟣 `#581C87` | Health emergency — all populations affected |

---

## 📓 Notebook Walkthrough

`AQI_Prediction.ipynb` contains 10 cells forming the complete ML pipeline:

| Cell | Title | What It Does |
|------|-------|-------------|
| **1** | Imports & Setup | Loads all libraries, sets matplotlib style |
| **2** | Data Loading & Exploration | Loads `city_day.csv`, prints shape/info/describe, missing value table |
| **3** | Data Cleaning | Drops null AQI rows → city-median imputation → date parsing → creates `AQI_Tomorrow` target |
| **4** | Exploratory Data Analysis | Generates 5-panel EDA figure → saves `eda_plots.png` |
| **5** | Feature Engineering & Split | Defines 14 features, 80/20 split, fits StandardScaler → saves `scaler.pkl` + `feature_names.pkl` |
| **6** | Model Training | Trains XGBRegressor (500 trees), prints training time |
| **7** | Evaluation & Visualisations | Prints MAE/RMSE/R²/MAPE, generates 4-panel evaluation figure → saves `model_evaluation.png` |
| **8** | AQI Category Function | Defines `get_aqi_category(aqi_value)` → returns category, color, advice |
| **9** | Save Model & Artifacts | Saves `aqi_model.pkl`, prints file sizes |
| **10** | Test Prediction Pipeline | Loads artifacts, runs end-to-end inference, shows result badge |

```bash
pip install jupyter
jupyter notebook AQI_Prediction.ipynb
# Kernel → Restart & Run All
```

> Must be run from the project root so relative paths resolve correctly.

---

## 🔧 Troubleshooting

### `FileNotFoundError: aqi_model.pkl`
Run all cells in `AQI_Prediction.ipynb` to generate the model artifacts.

### `WAQI fetch failed: HTTPSConnectionPool...`
No internet connection or WAQI API is temporarily down. The app falls back gracefully — predicted AQI is estimated as 105% of the current AQI.

### `City not found or API error`
City name not recognised by WAQI. Check spelling or try a nearby major city. You can also paste coordinates: `geo:12.97;77.59`.

### All pollutant cards show 0
This was a known animation bug (global RAF counter cancelled all animations). Fixed in `app.js` by replacing the shared `activeCounters` array with a per-element `WeakMap`. If you see 0s, ensure you are using the latest `app.js`.

### Weather tab shows "Weather data unavailable"
The WAQI monitoring station for that city does not report weather data. Try a larger city like Delhi or Mumbai which have more complete station instrumentation.

### Port 5001 already in use
```bash
lsof -i :5001        # find PID
kill -9 <PID>
python app.py
```

### `ModuleNotFoundError`
Activate your virtual environment before installing:
```bash
source venv/bin/activate
pip install -r requirements.txt
```

---

## 📌 Key Design Decisions

| Decision | Rationale |
|----------|-----------|
| **City text search instead of dropdown** | Supports 60+ cities; autocomplete is faster and more discoverable than a long `<select>` |
| **SQLite for search history** | Zero-config, file-based, built into Python — no external database required for local deployment |
| **Light mode default** | Matches modern web conventions and is more readable in daylight; dark mode available via toggle |
| **WeakMap per-element RAF tracking** | Previous global `activeCounters` array caused all animations to cancel each other; WeakMap makes animations fully independent |
| **Feels-like via Heat Index formula** | Standard Steadman formula (c1…c9 coefficients) for ≥27°C; simplified AT formula for cooler conditions |
| **`AQI_Tomorrow = shift(-1)` within city groups** | Prevents data leakage across cities |
| **StandardScaler over MinMaxScaler** | Handles outliers better for this dataset; XGBoost is scale-insensitive either way |
| **City-level median imputation** | Preserves local pollution patterns; global median fallback only when city has 100% NaN for a pollutant |
| **Graceful degradation without model** | If `.pkl` files are missing, API returns `AQI × 1.05` rather than crashing |

---

## 📄 License

Released under the **MIT License**.
Dataset courtesy of the **Central Pollution Control Board (CPCB)** via [Kaggle](https://www.kaggle.com/datasets/rohanrao/air-quality-data-in-india).
Real-time data powered by the **[World Air Quality Index (WAQI)](https://waqi.info)** project.

---

<div align="center">

**AQI India** — Built with Flask · XGBoost · SQLite · Vanilla JS

*Predictions are estimates based on historical patterns.
Always follow official CPCB and local government advisories.*

</div>

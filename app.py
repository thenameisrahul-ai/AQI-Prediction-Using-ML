"""
AirPulse — Flask backend for AQI monitoring & next-day prediction.
"""

import os
import joblib
import requests
import numpy as np
from datetime import datetime, timedelta
from flask import Flask, jsonify, render_template, request
import database

# ─────────────────────────────────────────────
#  App init
# ─────────────────────────────────────────────
app = Flask(__name__)

WAQI_TOKEN   = "97926bde88d74ac8e9c433dc0381a9ccad65aa73"
WAQI_URL     = "https://api.waqi.info/feed/{city}/?token={token}"
DEFAULT_CITY = "Delhi"

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Init SQLite DB
database.init_db()

# ─────────────────────────────────────────────
#  Load ML artifacts at startup
# ─────────────────────────────────────────────
try:
    model         = joblib.load(os.path.join(BASE_DIR, "aqi_model.pkl"))
    scaler        = joblib.load(os.path.join(BASE_DIR, "scaler.pkl"))
    feature_names = joblib.load(os.path.join(BASE_DIR, "feature_names.pkl"))
    print(f"[startup] Model loaded. Features: {feature_names}")
except FileNotFoundError as e:
    print(f"[WARNING] Could not load model artifacts: {e}")
    model = scaler = feature_names = None

# ─────────────────────────────────────────────
#  Constants
# ─────────────────────────────────────────────
POPULAR_CITIES = [
    "Bangalore", "Delhi", "Mumbai", "Chennai", "Kolkata",
    "Hyderabad", "Pune", "Ahmedabad",
    "Visakhapatnam", "Vijayawada", "Tirupati", "Guntur",
    "Guwahati", "Dibrugarh",
    "Patna", "Gaya", "Muzaffarpur",
    "Raipur", "Bilaspur",
    "Noida", "Gurugram", "Faridabad", "Ghaziabad",
    "Surat", "Vadodara", "Rajkot", "Gandhinagar",
    "Ambala", "Hisar",
    "Ranchi", "Jamshedpur", "Dhanbad",
    "Mysuru", "Mangaluru", "Hubli", "Belgaum",
    "Kochi", "Thiruvananthapuram", "Kozhikode", "Thrissur", "Kannur", "Kollam",
    "Bhopal", "Indore", "Gwalior", "Jabalpur", "Ujjain",
    "Nagpur", "Nashik", "Aurangabad", "Solapur", "Kolhapur", "Navi Mumbai",
    "Bhubaneswar", "Cuttack", "Rourkela",
    "Ludhiana", "Amritsar", "Jalandhar", "Chandigarh", "Patiala",
    "Jaipur", "Jodhpur", "Udaipur", "Kota", "Ajmer", "Bikaner",
    "Coimbatore", "Madurai", "Tiruchirappalli", "Salem", "Tirunelveli",
    "Warangal", "Nizamabad",
    "Lucknow", "Kanpur", "Agra", "Varanasi", "Prayagraj",
    "Meerut", "Mathura", "Bareilly",
    "Dehradun", "Haridwar",
    "Howrah", "Durgapur", "Asansol",
    "Srinagar", "Jammu", "Shimla",
]

FEATURE_ORDER = [
    "PM2.5", "PM10", "NO", "NO2", "NOx", "NH3",
    "CO", "SO2", "O3", "Benzene", "Toluene", "Xylene",
    "Month", "DayOfWeek",
]

CITY_DEFAULTS = {
    "PM2.5":   30.0,
    "PM10":    60.0,
    "NO":       8.0,
    "NO2":     25.0,
    "NOx":     33.0,
    "NH3":     10.0,
    "CO":       0.9,
    "SO2":      8.0,
    "O3":      35.0,
    "Benzene":  2.0,
    "Toluene":  6.0,
    "Xylene":   1.5,
}

AQI_CATEGORIES = [
    {
        "min": 0,   "max": 50,
        "category": "Good",
        "color":    "#22C55E",
        "advice":   "Air quality is considered satisfactory. Enjoy outdoor activities.",
        "recommendations": [
            "Great day for outdoor exercise",
            "Air quality poses little or no risk",
            "Ideal conditions — open windows for fresh air",
        ],
    },
    {
        "min": 51,  "max": 100,
        "category": "Satisfactory",
        "color":    "#84CC16",
        "advice":   "Air quality is acceptable. Sensitive people should limit prolonged outdoor exertion.",
        "recommendations": [
            "Sensitive groups should limit prolonged outdoor exertion",
            "Keep windows closed during peak traffic hours",
            "Consider using an air purifier indoors",
        ],
    },
    {
        "min": 101, "max": 200,
        "category": "Moderate",
        "color":    "#F59E0B",
        "advice":   "May cause breathing discomfort to people with lung disease, asthma, and heart disease.",
        "recommendations": [
            "People with respiratory conditions should avoid strenuous outdoor activity",
            "Wear a mask if spending extended time outdoors",
            "Keep indoor air clean with purifiers and ventilation filters",
        ],
    },
    {
        "min": 201, "max": 300,
        "category": "Poor",
        "color":    "#F97316",
        "advice":   "May cause breathing discomfort on prolonged exposure. Avoid outdoor activities.",
        "recommendations": [
            "Avoid all prolonged outdoor exertion",
            "Wear an N95 mask when outdoors",
            "Keep windows and doors closed",
            "Run air purifier on medium-high setting",
        ],
    },
    {
        "min": 301, "max": 400,
        "category": "Very Poor",
        "color":    "#EF4444",
        "advice":   "May cause respiratory illness on prolonged exposure. Avoid outdoor activities.",
        "recommendations": [
            "Avoid all outdoor activity",
            "N95 masks mandatory if going outdoors",
            "Children and elderly should remain indoors",
            "Seal gaps in doors and windows",
            "Run air purifiers at high setting",
        ],
    },
    {
        "min": 401, "max": 500,
        "category": "Severe",
        "color":    "#991B1B",
        "advice":   "Serious health effects. Everyone should avoid outdoor exposure.",
        "recommendations": [
            "Do not go outdoors under any circumstances",
            "Seal windows with tape/wet cloth",
            "Run air purifiers at maximum capacity",
            "Seek medical help if experiencing symptoms",
        ],
    },
    {
        "min": 501, "max": float("inf"),
        "category": "Hazardous",
        "color":    "#581C87",
        "advice":   "Health emergency. Do not go outside. Seal windows. Run air purifiers at maximum.",
        "recommendations": [
            "HEALTH EMERGENCY — remain indoors",
            "Seal all windows and doors immediately",
            "Air purifiers at maximum — change filters",
            "Call emergency services if feeling unwell",
        ],
    },
]


def get_aqi_info(aqi_value: float) -> dict:
    aqi = max(0.0, float(aqi_value))
    for band in AQI_CATEGORIES:
        if band["min"] <= aqi <= band["max"]:
            return {
                "category":        band["category"],
                "color":           band["color"],
                "health_advice":   band["advice"],
                "recommendations": band["recommendations"],
            }
    return {
        "category":        "Unknown",
        "color":           "#64748B",
        "health_advice":   "Data unavailable.",
        "recommendations": [],
    }


def safe_float(value, default=0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


# ─────────────────────────────────────────────
#  Routes
# ─────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html", default_city=DEFAULT_CITY)


@app.route("/predict")
def predict_page():
    return render_template("predict.html")


@app.route("/about")
def about_page():
    return render_template("about.html")


@app.route("/api/cities")
def api_cities():
    return jsonify({"cities": POPULAR_CITIES})


@app.route("/api/history")
def api_history():
    """Return recent city searches from SQLite."""
    try:
        searches = database.get_recent_searches(limit=8)
        return jsonify({"success": True, "history": searches})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


@app.route("/api/predict", methods=["POST"])
def api_predict():
    body = request.get_json(force=True, silent=True) or {}

    pollutant_map = {
        "PM2.5":   safe_float(body.get("PM2.5"),   CITY_DEFAULTS["PM2.5"]),
        "PM10":    safe_float(body.get("PM10"),    CITY_DEFAULTS["PM10"]),
        "NO":      safe_float(body.get("NO"),      CITY_DEFAULTS["NO"]),
        "NO2":     safe_float(body.get("NO2"),     CITY_DEFAULTS["NO2"]),
        "NOx":     safe_float(body.get("NOx"),     CITY_DEFAULTS["NOx"]),
        "NH3":     safe_float(body.get("NH3"),     CITY_DEFAULTS["NH3"]),
        "CO":      safe_float(body.get("CO"),      CITY_DEFAULTS["CO"]),
        "SO2":     safe_float(body.get("SO2"),     CITY_DEFAULTS["SO2"]),
        "O3":      safe_float(body.get("O3"),      CITY_DEFAULTS["O3"]),
        "Benzene": safe_float(body.get("Benzene"), CITY_DEFAULTS["Benzene"]),
        "Toluene": safe_float(body.get("Toluene"), CITY_DEFAULTS["Toluene"]),
        "Xylene":  safe_float(body.get("Xylene"),  CITY_DEFAULTS["Xylene"]),
    }

    now = datetime.now()
    month       = int(safe_float(body.get("Month"),     now.month))
    day_of_week = int(safe_float(body.get("DayOfWeek"), now.weekday()))
    month       = max(1,  min(12, month))
    day_of_week = max(0,  min(6,  day_of_week))

    feature_vector = [
        pollutant_map.get(f, CITY_DEFAULTS.get(f, 0.0))
        if f not in ("Month", "DayOfWeek")
        else (month if f == "Month" else day_of_week)
        for f in FEATURE_ORDER
    ]

    pm25          = pollutant_map["PM2.5"]
    estimated_aqi = round(min(pm25 * 2.5, 500), 1)

    if model is not None and scaler is not None:
        try:
            arr           = np.array(feature_vector, dtype=float).reshape(1, -1)
            scaled        = scaler.transform(arr)
            raw           = float(model.predict(scaled)[0])
            predicted_aqi = max(0.0, round(raw, 1))
        except Exception as exc:
            return jsonify({"success": False, "error": str(exc)}), 500
    else:
        predicted_aqi = round(estimated_aqi * 1.05, 1)

    info = get_aqi_info(predicted_aqi)

    return jsonify({
        "success":         True,
        "predicted_aqi":   predicted_aqi,
        "category":        info["category"],
        "color":           info["color"],
        "health_advice":   info["health_advice"],
        "recommendations": info["recommendations"],
        "inputs":          {k: round(v, 3) for k, v in pollutant_map.items()},
    })


@app.route("/api/aqi")
def api_aqi():
    city = request.args.get("city", DEFAULT_CITY).strip()

    # ── 1. Fetch from WAQI ────────────────────────────────────
    try:
        resp = requests.get(
            WAQI_URL.format(city=city, token=WAQI_TOKEN),
            timeout=8,
        )
        resp.raise_for_status()
        data = resp.json()
    except requests.RequestException as exc:
        return jsonify({"success": False, "error": f"WAQI fetch failed: {exc}"}), 502

    if data.get("status") != "ok":
        return jsonify({
            "success": False,
            "error":   data.get("data", "City not found or API error"),
        }), 404

    waqi_data = data["data"]
    iaqi      = waqi_data.get("iaqi", {})

    # ── 2. Extract pollutants ─────────────────────────────────
    current_aqi        = safe_float(waqi_data.get("aqi"))
    dominant_pollutant = waqi_data.get("dominentpol", "pm25")

    pollutant_map = {
        "PM2.5": safe_float(iaqi.get("pm25", {}).get("v"), CITY_DEFAULTS["PM2.5"]),
        "PM10":  safe_float(iaqi.get("pm10", {}).get("v"), CITY_DEFAULTS["PM10"]),
        "NO":    safe_float(iaqi.get("no",   {}).get("v"), CITY_DEFAULTS["NO"]),
        "NO2":   safe_float(iaqi.get("no2",  {}).get("v"), CITY_DEFAULTS["NO2"]),
        "NOx":   safe_float(iaqi.get("nox",  {}).get("v"), CITY_DEFAULTS["NOx"]),
        "NH3":   safe_float(iaqi.get("nh3",  {}).get("v"), CITY_DEFAULTS["NH3"]),
        "CO":    safe_float(iaqi.get("co",   {}).get("v"), CITY_DEFAULTS["CO"]),
        "SO2":   safe_float(iaqi.get("so2",  {}).get("v"), CITY_DEFAULTS["SO2"]),
        "O3":    safe_float(iaqi.get("o3",   {}).get("v"), CITY_DEFAULTS["O3"]),
        "Benzene": CITY_DEFAULTS["Benzene"],
        "Toluene": CITY_DEFAULTS["Toluene"],
        "Xylene":  CITY_DEFAULTS["Xylene"],
    }

    # ── 3. Extract weather data ───────────────────────────────
    weather = {
        "temperature": iaqi.get("t",   {}).get("v"),
        "humidity":    iaqi.get("h",   {}).get("v"),
        "wind":        iaqi.get("w",   {}).get("v"),
        "wind_gust":   iaqi.get("wg",  {}).get("v"),
        "uvi":         iaqi.get("uvi", {}).get("v"),
        "dew":         iaqi.get("d",   {}).get("v"),
        "pressure":    iaqi.get("p",   {}).get("v"),
    }

    # ── 4. Temporal features ──────────────────────────────────
    now        = datetime.now()
    tomorrow   = now + timedelta(days=1)
    day_after  = now + timedelta(days=2)

    def make_feature_vector(month, dow):
        return [
            pollutant_map.get(f, CITY_DEFAULTS.get(f, 0.0))
            if f not in ("Month", "DayOfWeek")
            else (month if f == "Month" else dow)
            for f in FEATURE_ORDER
        ]

    fv_tomorrow  = make_feature_vector(tomorrow.month,  tomorrow.weekday())
    fv_day_after = make_feature_vector(day_after.month, day_after.weekday())

    # ── 5. Predict tomorrow & day-after-tomorrow AQI ──────────
    def predict_aqi(feature_vector, fallback):
        if model is not None and scaler is not None:
            try:
                arr    = np.array(feature_vector, dtype=float).reshape(1, -1)
                scaled = scaler.transform(arr)
                raw    = float(model.predict(scaled)[0])
                return max(0.0, round(raw, 1))
            except Exception:
                pass
        return round(fallback, 1)

    predicted_tomorrow  = predict_aqi(fv_tomorrow,  current_aqi * 1.05)
    predicted_day_after = predict_aqi(fv_day_after, current_aqi * 1.08)

    tmr_info = get_aqi_info(predicted_tomorrow)
    dat_info = get_aqi_info(predicted_day_after)

    # Keep legacy references for db save (tomorrow value)
    predicted_aqi = predicted_tomorrow
    pred_info     = tmr_info

    # ── 6. Current AQI info ───────────────────────────────────
    current_info = get_aqi_info(current_aqi)

    # All pollutants for display
    pollutants_display = {
        "pm25": pollutant_map["PM2.5"],
        "pm10": pollutant_map["PM10"],
        "co":   pollutant_map["CO"],
        "so2":  pollutant_map["SO2"],
        "no2":  pollutant_map["NO2"],
        "o3":   pollutant_map["O3"],
        "no":   pollutant_map["NO"],
        "nox":  pollutant_map["NOx"],
        "nh3":  pollutant_map["NH3"],
    }

    # Timestamp
    try:
        ts_raw = waqi_data.get("time", {}).get("s", "")
        ts     = ts_raw if ts_raw else now.strftime("%Y-%m-%d %H:%M:%S")
    except Exception:
        ts = now.strftime("%Y-%m-%d %H:%M:%S")

    # City display name from WAQI
    city_name = waqi_data.get("city", {}).get("name", city)

    result = {
        "success":   True,
        "city":      city,
        "city_name": city_name,
        "current": {
            "aqi":                current_aqi,
            "category":           current_info["category"],
            "color":              current_info["color"],
            "health_advice":      current_info["health_advice"],
            "recommendations":    current_info["recommendations"],
            "dominant_pollutant": dominant_pollutant,
            "pollutants":         pollutants_display,
            "weather":            weather,
            "timestamp":          ts,
        },
        "prediction": {
            "tomorrow": {
                "aqi":             predicted_tomorrow,
                "category":        tmr_info.get("category", "N/A"),
                "color":           tmr_info.get("color", "#64748B"),
                "health_advice":   tmr_info.get("health_advice", ""),
                "recommendations": tmr_info.get("recommendations", []),
                "date":            tomorrow.strftime("%a, %d %b"),
                "label":           "Tomorrow",
            },
            "day_after_tomorrow": {
                "aqi":             predicted_day_after,
                "category":        dat_info.get("category", "N/A"),
                "color":           dat_info.get("color", "#64748B"),
                "health_advice":   dat_info.get("health_advice", ""),
                "recommendations": dat_info.get("recommendations", []),
                "date":            day_after.strftime("%a, %d %b"),
                "label":           "Day After Tomorrow",
            },
        },
    }

    # ── 7. Save to SQLite ─────────────────────────────────────
    try:
        # Use the proper city name from WAQI (not raw geo coordinates)
        save_key = city_name if city_name and city_name != city else city
        database.save_search(save_key, result)
    except Exception as db_err:
        print(f"[DB] Save failed: {db_err}")

    return jsonify(result)


if __name__ == "__main__":
    app.run(debug=True, port=5001)

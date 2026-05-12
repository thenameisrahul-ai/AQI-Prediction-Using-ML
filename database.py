"""
SQLite database module for AQI search history.
"""

import sqlite3
import os

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'aqi_history.db')


def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            CREATE TABLE IF NOT EXISTS aqi_searches (
                id               INTEGER PRIMARY KEY AUTOINCREMENT,
                city             TEXT NOT NULL,
                aqi              REAL,
                category         TEXT,
                color            TEXT,
                pm25             REAL,
                pm10             REAL,
                no2              REAL,
                so2              REAL,
                co               REAL,
                o3               REAL,
                no               REAL,
                nox              REAL,
                nh3              REAL,
                dominant_pollutant TEXT,
                data_timestamp   TEXT,
                searched_at      DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        conn.commit()


def save_search(city, data):
    current    = data.get('current', {})
    pollutants = current.get('pollutants', {})
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute('''
            INSERT INTO aqi_searches
            (city, aqi, category, color, pm25, pm10, no2, so2, co, o3,
             no, nox, nh3, dominant_pollutant, data_timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            city,
            current.get('aqi'),
            current.get('category'),
            current.get('color'),
            pollutants.get('pm25'),
            pollutants.get('pm10'),
            pollutants.get('no2'),
            pollutants.get('so2'),
            pollutants.get('co'),
            pollutants.get('o3'),
            pollutants.get('no'),
            pollutants.get('nox'),
            pollutants.get('nh3'),
            current.get('dominant_pollutant'),
            current.get('timestamp'),
        ))


def get_recent_searches(limit=8):
    with sqlite3.connect(DB_PATH) as conn:
        conn.row_factory = sqlite3.Row
        rows = conn.execute('''
            SELECT city, aqi, category, color, MAX(searched_at) AS last_searched
            FROM aqi_searches
            GROUP BY city
            ORDER BY last_searched DESC
            LIMIT ?
        ''', (limit,)).fetchall()
    return [dict(row) for row in rows]

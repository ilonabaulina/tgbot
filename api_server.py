from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)
DB_PATH = 'bot_database.db'

# Настройка CORS
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS", "DELETE"],
    "allow_headers": ["Content-Type", "ngrok-skip-browser-warning"]
}})


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.executescript('''
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        last_seen TEXT,
        calendar_theme TEXT DEFAULT 'light',
        user_status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS categories (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        name TEXT NOT NULL,
        color TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        task_text TEXT NOT NULL,
        notify_at TEXT,
        is_done INTEGER DEFAULT 0,
        is_important INTEGER DEFAULT 0,
        category_id TEXT,
        date TEXT,
        time TEXT
    );

    CREATE TABLE IF NOT EXISTS schedule (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        day_of_week INTEGER,
        lesson_name TEXT,
        start_time TEXT,
        end_time TEXT,
        room TEXT,
        lesson_type TEXT,
        week_numbers TEXT,
        is_custom INTEGER DEFAULT 0
    );
    ''')
    conn.commit()
    conn.close()
    print("База данных готова")


@app.route('/get_tasks', methods=['GET'])
def get_tasks():
    user_id = request.args.get('user_id')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT 
                id, 
                task_text as text, 
                notify_at, 
                is_done as completed, 
                is_important,
                category_id,
                date,
                time
            FROM tasks 
            WHERE user_id = ?
        """, (user_id,))
        rows = cursor.fetchall()
        conn.close()

        result = []
        for row in rows:
            d = dict(row)
            full_dt = d.get('notify_at', '')
            if full_dt and ' ' in full_dt:
                d['date'], d['time'] = full_dt.split(' ')
            else:
                d['date'] = d.get('date', '')
                d['time'] = d.get('time', '09:00')
            result.append(d)

        return jsonify(result)
    except Exception as e:
        print(f"Ошибка БД (get_tasks): {e}")
        return jsonify([])


@app.route('/add_task', methods=['POST'])
def add_task():
    try:
        data = request.json
        user_id = data.get('user_id')
        text = data.get('text')
        date_val = data.get('date')
        time_val = data.get('time', '09:00')
        is_important = data.get('is_important', 0)
        category_id = data.get('category_id')

        if not user_id or not text or not date_val:
            return jsonify({"error": "missing data"}), 400

        full_datetime = f"{date_val} {time_val}:00"

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tasks (user_id, task_text, notify_at, is_done, is_important, category_id, date, time) 
            VALUES (?, ?, ?, 0, ?, ?, ?, ?)
        """, (user_id, text, full_datetime, is_important, category_id, date_val, time_val))

        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        print(f"Ошибка: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/update_task_status', methods=['POST', 'OPTIONS'])
def update_task_status():
    if request.method == 'OPTIONS':
        return make_response()
    try:
        data = request.json
        task_id = data.get('id')
        is_done_value = 1 if data.get('completed') else 0

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("UPDATE tasks SET is_done = ? WHERE id = ?", (is_done_value, task_id))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        print(f"Ошибка: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/delete_task', methods=['POST', 'OPTIONS'])
def delete_task():
    if request.method == 'OPTIONS':
        return make_response()
    try:
        data = request.json
        task_id = data.get('id')

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        print(f"Ошибка: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/get_categories', methods=['GET', 'OPTIONS'])
def get_categories():
    if request.method == 'OPTIONS':
        return make_response()
    user_id = request.args.get('user_id')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT id, name, color FROM categories WHERE user_id = ?", (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        print(f"Ошибка: {e}")
        return jsonify([])


@app.route('/add_category', methods=['POST', 'OPTIONS'])
def add_category():
    if request.method == 'OPTIONS':
        return make_response()
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)",
                       (data['user_id'], data['name'], data['color']))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return jsonify({"id": new_id, "name": data['name'], "color": data['color']})
    except Exception as e:
        print(f"Ошибка: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/delete_category', methods=['POST', 'OPTIONS'])
def delete_category():
    if request.method == 'OPTIONS':
        return make_response()
    try:
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM categories WHERE id = ? AND user_id = ?", 
                       (data['category_id'], data['user_id']))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        print(f"Ошибка: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/bot/user_tasks', methods=['GET'])
def bot_get_user_tasks():
    try:
        user_id = request.args.get('user_id')
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, task_text as text, date, time, is_done as completed, is_important, category_id 
            FROM tasks WHERE user_id = ?
            ORDER BY date ASC, time ASC
        """, (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])
    except Exception as e:
        print(f"Ошибка: {e}")
        return jsonify([])


if __name__ == '__main__':
    init_db()
    app.run(host='0.0.0.0', port=5000, debug=True)

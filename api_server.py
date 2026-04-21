from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)

DB_PATH = 'bot_database.db'

# 1. Настройка CORS
CORS(app, resources={r"/*": {
    "origins": "*",
    "methods": ["GET", "POST", "OPTIONS"],
    "allow_headers": ["Content-Type", "ngrok-skip-browser-warning"]
}})


# 2. Работа с базой данных
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
        calendar_theme TEXT DEFAULT 'light'
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
        notify_at DATETIME,
        is_done INTEGER DEFAULT 0,
        is_important INTEGER DEFAULT 0,
        category_id TEXT
    );
    ''')
    # Добавим дефолтные категории для нового пользователя, если их нет
    conn.commit()
    conn.close()
    print("База данных проверена и готова к работе.")


# --- ЭНДПОИНТЫ ---

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
                notify_at,  -- Берем сырую строку "2026-04-20 09:00:00"
                is_done as completed,
                is_important,
                category_id
            FROM tasks 
            WHERE user_id = ?
        """, (user_id,))
        rows = cursor.fetchall()
        conn.close()

        result = []
        for row in rows:
            d = dict(row)
            # Разбиваем "2026-04-20 09:00:00" на дату и время вручную для надежности
            full_dt = d.get('notify_at', '')
            if full_dt and ' ' in full_dt:
                d['date'], d['time'] = full_dt.split(' ')
            else:
                d['date'] = full_dt
                d['time'] = "00:00"
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

        # защита от None
        if not user_id or not text or not date_val:
            return jsonify({"error": "missing data"}), 400

        full_datetime = f"{date_val} {time_val}:00"

        conn = get_db_connection()
        cursor = conn.cursor()

        cursor.execute("""
            INSERT INTO tasks (
                user_id, 
                task_text, 
                notify_at, 
                is_done, 
                is_important, 
                category_id
            ) 
            VALUES (?, ?, ?, 0, ?, ?)
        """, (user_id, text, full_datetime, is_important, category_id))

        conn.commit()
        conn.close()

        return jsonify({"success": True})

    except Exception as e:
        print("Ошибка при добавлении:", e)
        return jsonify({"error": str(e)}), 500


@app.route('/update_task_status', methods=['POST', 'OPTIONS'])
def update_task_status():
    if request.method == 'OPTIONS':
        return make_response()

    try:
        data = request.json
        task_id = data.get('id')
        # В твоей базе колонка называется is_done. Используем 1 или 0.
        is_done_value = 1 if data.get('completed') else 0

        conn = get_db_connection()
        cursor = conn.cursor()
        # ИСПРАВЛЕНО: Меняем is_done вместо completed
        cursor.execute("UPDATE tasks SET is_done = ? WHERE id = ?", (is_done_value, task_id))
        conn.commit()
        conn.close()

        return jsonify({"success": True})
    except Exception as e:
        print(f"Ошибка в БД (update_status): {e}")
        return jsonify({"error": str(e)}), 500

@app.route('/get_categories', methods=['GET', 'OPTIONS'])
def get_categories():
        if request.method == 'OPTIONS': return make_response()
        user_id = request.args.get('user_id')
        conn = get_db_connection()
        rows = conn.execute("SELECT id, name, color FROM categories WHERE user_id = ?", (user_id,)).fetchall()
        conn.close()
        return jsonify([dict(r) for r in rows])

@app.route('/add_category', methods=['POST', 'OPTIONS'])
def add_category():
        if request.method == 'OPTIONS': return make_response()
        data = request.json
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)",
                       (data['user_id'], data['name'], data['color']))
        new_id = cursor.lastrowid
        conn.commit()
        conn.close()
        return jsonify({"id": new_id, "name": data['name'], "color": data['color']})

@app.route('/delete_category', methods=['POST', 'OPTIONS'])
def delete_category():
        if request.method == 'OPTIONS': return make_response()
        data = request.json
        conn = get_db_connection()
        conn.execute("DELETE FROM categories WHERE id = ? AND user_id = ?", (data['category_id'], data['user_id']))
        conn.commit()
        conn.close()
        return jsonify({"success": True})


if __name__ == '__main__':
    init_db()  # Создаем таблицы перед запуском сервера
    app.run(host='0.0.0.0', port=5000, debug=True)

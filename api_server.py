from flask import Flask, jsonify, request, make_response
from flask_cors import CORS
import sqlite3
import os

app = Flask(__name__)

DB_PATH = 'bot_database.db'

# 1. Настройка CORS
CORS(app, resources={r"/*": {"origins": "*"}}, supports_credentials=True)


@app.after_request
def add_cors_headers(response):
    response.headers['Access-Control-Allow-Origin'] = '*'
    response.headers['Access-Control-Allow-Methods'] = 'GET, POST, OPTIONS'
    response.headers['Access-Control-Allow-Headers'] = 'Content-Type, ngrok-skip-browser-warning'
    return response


# 2. Работа с базой данных
def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db():
    """Создание таблиц при запуске, если их нет"""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.executescript('''
    CREATE TABLE IF NOT EXISTS users (
        user_id INTEGER PRIMARY KEY,
        username TEXT,
        calendar_theme TEXT DEFAULT 'light',
        group_number TEXT,
        subgroup INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS tasks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        task_text TEXT NOT NULL,
        notify_at DATETIME,
        is_done INTEGER DEFAULT 0,
        FOREIGN KEY (user_id) REFERENCES users (user_id)
    );
    ''')
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
        # Выбираем все поля, чтобы фронтенд знал ID и статус задачи
        cursor.execute("""
            SELECT id, task_text as text, 
            DATE(notify_at) as date, 
            TIME(notify_at) as time, 
            is_done as completed 
            FROM tasks WHERE user_id = ?
        """, (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        print(f"Ошибка БД (get_tasks): {e}")
        return jsonify([])


@app.route('/add_task', methods=['POST'])
def add_task():
    data = request.json
    try:
        user_id = data.get('user_id')
        text = data.get('text')
        date_val = data.get('date')  # ГГГГ-ММ-ДД
        time_val = data.get('time', '09:00')

        full_datetime = f"{date_val} {time_val}:00"

        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO tasks (user_id, task_text, notify_at, is_done) 
            VALUES (?, ?, ?, 0)
        """, (user_id, text, full_datetime))
        conn.commit()
        conn.close()
        return jsonify({"success": True})
    except Exception as e:
        print(f"Ошибка при добавлении: {e}")
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


if __name__ == '__main__':
    init_db()  # Создаем таблицы перед запуском сервера
    app.run(host='0.0.0.0', port=5000, debug=True)
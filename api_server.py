from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
from datetime import datetime

app = Flask(__name__)
# CORS важен, чтобы Telegram разрешил приложению стучаться к твоему серверу
CORS(app, resources={r"/*": {"origins": "*"}})

DB_PATH = 'bot_database.db'


def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # Это позволит возвращать данные как словари
    return conn


# Замени в app.py эндпоинты на эти:

@app.route('/add_task', methods=['POST'])
def add_task():
    data = request.json
    user_id = data.get('user_id')
    text = data.get('text')
    # Ожидаем дату в формате YYYY-MM-DD и время HH:MM
    date_str = data.get('date')
    time_str = data.get('time', "09:00")

    try:
        from db_functions import save_task_from_webapp
        # Используем твою функцию из db_functions
        success = save_task_from_webapp(user_id, text, date_str)
        if success:
            return jsonify({"success": True})
        return jsonify({"error": "DB error"}), 500
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_calendar_tasks/<int:user_id>', methods=['GET'])
def get_calendar_tasks(user_id):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Вытягиваем задачи и из расписания, и из обычных тасков
        cursor.execute("""
            SELECT lesson_name as title, start_time as time, day_of_week 
            FROM university_schedule WHERE user_id = ?
        """, (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/get_tasks')
def get_tasks():
    user_id = request.args.get('user_id')
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        # Мы используем DATE(), чтобы отсечь время и оставить только ГГГГ-ММ-ДД
        cursor.execute("SELECT task_text as text, DATE(notify_at) as date FROM tasks WHERE user_id = ?", (user_id,))
        rows = cursor.fetchall()
        conn.close()
        return jsonify([dict(row) for row in rows])
    except Exception as e:
        print(f"Ошибка БД: {e}")
        return jsonify([])# Возвращаем пустой список, если что-то не так

if __name__ == '__main__':
    # Запускаем на порту 5000.
    # В PyCharm в консоли увидишь ссылку http://127.0.0.1:5000
    app.run(host='0.0.0.0', port=5000, debug=True)
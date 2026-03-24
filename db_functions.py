import sqlite3
import dateparser
import re
from datetime import datetime, timedelta

DB_PATH = 'bot_database.db'


def get_connection():
    """Создает соединение с таймаутом, чтобы база не блокировалась."""
    return sqlite3.connect(DB_PATH, timeout=10)


def register_user(user_id, username):
    """Регистрация через контекстный менеджер with."""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT OR IGNORE INTO users (user_id, username) VALUES (?, ?)",
                (user_id, username)
            )
            conn.commit()
    except Exception as e:
        print(f"Ошибка при регистрации: {e}")


def save_initial_task(user_id, message_text):
    now = datetime.now()

    # --- ШАГ 1: УМНЫЙ ПОИСК ДАТЫ (dateparser) ---
    # Настройки: ищем только в будущем, язык русский
    settings = {'PREFER_DATES_FROM': 'future', 'RELATIVE_BASE': now}
    parsed_date = dateparser.parse(message_text, languages=['ru'], settings=settings)

    # --- ШАГ 2: ЗАПАСНОЙ ВАРИАНТ (твой Regex) ---
    # Если dateparser не понял фразу, ищем время типа 12:30
    time_match = re.search(r'(\d{1,2})[:.](\d{2})', message_text)

    if not parsed_date:
        if not time_match:
            return None

        hours = int(time_match.group(1))
        minutes = int(time_match.group(2))
        parsed_date = now.replace(hour=hours, minute=minutes, second=0, microsecond=0)

        if parsed_date < now:
            parsed_date += timedelta(days=1)

    # --- ШАГ 3: ОЧИСТКА ТЕКСТА ---
    task_text = message_text
    if time_match:
        task_text = task_text.replace(time_match.group(0), "")

    # Список слов-паразитов для удаления
    for word in ["сегодня", "завтра", " в ", " В "]:
        task_text = task_text.lower().replace(word, "")
    task_text = task_text.strip().capitalize()

    # --- ШАГ 4: СОХРАНЕНИЕ С WITH ---
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute(
                "INSERT INTO tasks (user_id, task_text, notify_at, is_done) VALUES (?, ?, ?, 0)",
                (user_id, task_text, parsed_date.strftime('%Y-%m-%d %H:%M'))
            )
            task_id = cursor.lastrowid
            conn.commit()
            return task_id, parsed_date, task_text
    except Exception as e:
        print(f"Ошибка сохранения задачи: {e}")
        return None


def update_reminder_time(task_id, event_time, minutes_before):
    new_time = event_time - timedelta(minutes=minutes_before)
    str_time = new_time.strftime('%Y-%m-%d %H:%M')
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE tasks SET notify_at = ? WHERE id = ?", (str_time, task_id))
        conn.commit()
    return str_time


def get_tasks_to_notify(current_time):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id, user_id, task_text FROM tasks WHERE notify_at <= ? AND is_done = 0", (current_time,))
        return cursor.fetchall()


def mark_as_done(task_id):
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("UPDATE tasks SET is_done = 1 WHERE id = ?", (task_id,))
        conn.commit()
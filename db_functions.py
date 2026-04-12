import sqlite3
import re
import requests
import xml.etree.ElementTree as ET
import os
from datetime import datetime, timedelta

DB_PATH = 'bot_database.db'


def get_connection():
    return sqlite3.connect(DB_PATH, timeout=10)


def register_user(user_id, username):
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("""
                INSERT INTO users (user_id, username, last_seen) 
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET last_seen = excluded.last_seen
            """, (user_id, username, datetime.now().date().isoformat()))
            conn.commit()
    except Exception as e:
        print(f"Ошибка регистрации: {e}")


def should_greet(user_id):
    today = datetime.now().date().isoformat()
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT last_seen FROM users WHERE user_id = ?", (user_id,))
            result = cursor.fetchone()
            if not result or result[0] != today:
                cursor.execute("UPDATE users SET last_seen = ? WHERE user_id = ?", (today, user_id))
                conn.commit()
                return True
            return False
    except:
        return True


def save_initial_task(user_id, text):
    now = datetime.now()
    time_match = re.search(r'(\d{1,2})[:.](\d{2})', text)
    simple_match = re.search(r'(?<!\d)(\d{1,2})(?!\d)', text) if not time_match else None

    if time_match:
        hours, minutes = int(time_match.group(1)), int(time_match.group(2))
        found_raw = time_match.group(0)
    elif simple_match:
        hours, minutes = int(simple_match.group(1)), 0
        found_raw = simple_match.group(0)
    else:
        return None

    event_time = now.replace(hour=hours, minute=minutes, second=0, microsecond=0)
    if event_time < now:
        event_time += timedelta(days=1)

    notify_at = event_time - timedelta(minutes=15)
    task_text = text.replace(found_raw, "").strip().capitalize()
    if not task_text: task_text = "Напоминание"

    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            formatted_time = notify_at.strftime('%Y-%m-%d %H:%M')
            # Сохраняем для бота
            cursor.execute(
                "INSERT INTO tasks (user_id, task_text, notify_at, is_done) VALUES (?, ?, ?, 0)",
                (user_id, task_text, formatted_time)
            )
            task_id = cursor.lastrowid

            # ВОТ ЭТА СТРОЧКА ДЛЯ МИНИ АППА (чтобы данные там появились)
            display_time = event_time.strftime('%H:%M')
            cursor.execute("""
                INSERT INTO university_schedule (user_id, lesson_name, start_time, room, day_of_week) 
                VALUES (?, ?, ?, ?, ?)
            """, (user_id, task_text, display_time, "Личное", now.weekday()))

            conn.commit()
            return task_id, event_time, task_text
    except Exception as e:
        print(f"Ошибка сохранения: {e}")
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


def sync_bsuir_schedule(user_id, group_number):
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        file_path = os.path.join(current_dir, 'schedule.xml')
        if not os.path.exists(file_path):
            return False

        tree = ET.parse(file_path)
        root = tree.getroot()
        with get_connection() as conn:
            cursor = conn.cursor()
            # Очищаем старое, кроме личных заметок
            cursor.execute("DELETE FROM university_schedule WHERE user_id = ? AND room != 'Личное'", (user_id,))

            days_map = {'Понедельник': 0, 'Вторник': 1, 'Среда': 2, 'Четверг': 3, 'Пятница': 4, 'Суббота': 5,
                        'Воскресенье': 6}
            for day_name, day_idx in days_map.items():
                day_node = root.find(f".//{day_name}")
                if day_node is None: continue
                for item in day_node.findall('item'):
                    subject = item.findtext('subject', 'Пара')
                    start = item.findtext('startLessonTime', '??:??')
                    cursor.execute(
                        "INSERT INTO university_schedule (user_id, day_of_week, lesson_name, start_time, room) VALUES (?, ?, ?, ?, ?)",
                        (user_id, day_idx, subject, start, "БГУИР"))
            conn.commit()
        return True
    except Exception as e:
        print(f"Ошибка XML: {e}")
        return False


def save_task_from_webapp(user_id, task_text, task_date):
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            # Важно: task_date должен быть 'YYYY-MM-DD'
            notify_time = f"{task_date} 09:00"

            # В таблицу для уведомлений бота
            cursor.execute(
                "INSERT INTO tasks (user_id, task_text, notify_at, is_done) VALUES (?, ?, ?, 0)",
                (user_id, task_text, notify_time)
            )

            # В таблицу для отображения в Mini App
            date_obj = datetime.strptime(task_date, '%Y-%m-%d')
            cursor.execute("""
                INSERT INTO university_schedule (user_id, day_of_week, lesson_name, start_time, room) 
                VALUES (?, ?, ?, ?, ?)
            """, (user_id, date_obj.weekday(), task_text, "09:00", "Mini App"))

            conn.commit()
            return True
    except Exception as e:
        print(f"Ошибка: {e}")
        return False


# ФУНКЦИЯ ДЛЯ СТАТУСА (чтобы script1.py не выдавал ошибку)
def update_user_status(user_id, status):
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("UPDATE users SET user_status = ? WHERE user_id = ?", (status, user_id))
        except:
            pass
        conn.commit()
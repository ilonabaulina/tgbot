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
    if not task_text:
        task_text = "Напоминание"

    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            formatted_time = notify_at.strftime('%Y-%m-%d %H:%M')
            date_str = event_time.strftime('%Y-%m-%d')
            time_str = event_time.strftime('%H:%M')
            
            cursor.execute("""
                INSERT INTO tasks (user_id, task_text, notify_at, is_done, date, time) 
                VALUES (?, ?, ?, 0, ?, ?)
            """, (user_id, task_text, formatted_time, date_str, time_str))
            
            task_id = cursor.lastrowid
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
            cursor.execute("DELETE FROM schedule WHERE user_id = ? AND room != 'Личное'", (user_id,))

            days_map = {'Понедельник': 0, 'Вторник': 1, 'Среда': 2, 'Четверг': 3, 'Пятница': 4, 'Суббота': 5, 'Воскресенье': 6}
            for day_name, day_idx in days_map.items():
                day_node = root.find(f".//{day_name}")
                if day_node is None:
                    continue
                for item in day_node.findall('item'):
                    subject = item.findtext('subject', 'Пара')
                    start = item.findtext('startLessonTime', '??:??')
                    cursor.execute("""
                        INSERT INTO schedule (user_id, day_of_week, lesson_name, start_time, room) 
                        VALUES (?, ?, ?, ?, ?)
                    """, (user_id, day_idx, subject, start, "БГУИР"))
            conn.commit()
        return True
    except Exception as e:
        print(f"Ошибка XML: {e}")
        return False


def update_user_status(user_id, status):
    with get_connection() as conn:
        cursor = conn.cursor()
        try:
            cursor.execute("UPDATE users SET user_status = ? WHERE user_id = ?", (status, user_id))
            conn.commit()
        except:
            pass


def get_user_categories(user_id):
    """Получает категории пользователя"""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, name, color FROM categories WHERE user_id = ?", (user_id,))
            rows = cursor.fetchall()
            if rows:
                return rows
            # Создаем дефолтные категории
            default_cats = [
                (user_id, 'Общее', '#ff453a'),
                (user_id, 'Учеба', '#af52de'),
                (user_id, 'Работа', '#34c759'),
                (user_id, 'Личное', '#ff9f0a')
            ]
            for cat in default_cats:
                cursor.execute("INSERT INTO categories (user_id, name, color) VALUES (?, ?, ?)", cat)
            conn.commit()
            cursor.execute("SELECT id, name, color FROM categories WHERE user_id = ?", (user_id,))
            return cursor.fetchall()
    except Exception as e:
        print(f"Ошибка: {e}")
        return [(1, 'Общее', '#ff453a'), (2, 'Учеба', '#af52de'), (3, 'Работа', '#34c759')]


def update_task_category(task_id, category_id):
    """Обновляет категорию задачи"""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("UPDATE tasks SET category_id = ? WHERE id = ?", (str(category_id), task_id))
            conn.commit()
            return True
    except Exception as e:
        print(f"Ошибка: {e}")
        return False


def save_task_from_webapp(user_id, task_text, task_date, task_time="09:00", category_id=None):
    """Сохраняет задачу из Mini App"""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            notify_time = f"{task_date} {task_time}:00"
            cursor.execute("""
                INSERT INTO tasks (user_id, task_text, notify_at, is_done, date, time, category_id) 
                VALUES (?, ?, ?, 0, ?, ?, ?)
            """, (user_id, task_text, notify_time, task_date, task_time, category_id))
            conn.commit()
            return cursor.lastrowid
    except Exception as e:
        print(f"Ошибка: {e}")
        return None


def get_task_by_id(task_id):
    """Получает задачу по ID"""
    try:
        with get_connection() as conn:
            cursor = conn.cursor()
            cursor.execute("SELECT id, user_id, task_text, notify_at, is_done, category_id FROM tasks WHERE id = ?", (task_id,))
            return cursor.fetchone()
    except Exception as e:
        print(f"Ошибка: {e}")
        return None

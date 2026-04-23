import sqlite3

conn = sqlite3.connect('bot_database.db')
cursor = conn.cursor()

cursor.executescript('''
-- 1. Таблица пользователей
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,
    username TEXT NOT NULL,
    last_seen TEXT,
    calendar_theme TEXT DEFAULT 'light',
    group_number TEXT,
    subgroup INTEGER DEFAULT 0,
    user_status TEXT DEFAULT 'active',
    status_until DATETIME
);

-- 2. Таблица задач (напоминалки)
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    task_text TEXT NOT NULL,
    notify_at DATETIME,
    is_done INTEGER DEFAULT 0,
    is_important INTEGER DEFAULT 0,
    category_id TEXT,
    date TEXT,
    time TEXT
);

-- 3. Таблица категорий
CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    name TEXT NOT NULL,
    color TEXT NOT NULL
);

-- 4. Таблица расписания пар
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

-- 5. Таблица дневника (эмоции)
CREATE TABLE IF NOT EXISTS diary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    entry_date DATE DEFAULT (DATE('now')),
    content TEXT,
    emotion TEXT
);
''')

# Добавляем колонки в таблицу пользователей (если их нет)
try:
    cursor.execute("ALTER TABLE users ADD COLUMN group_number TEXT")
    cursor.execute("ALTER TABLE users ADD COLUMN subgroup INTEGER DEFAULT 0")
    cursor.execute("ALTER TABLE users ADD COLUMN user_status TEXT DEFAULT 'active'")
    cursor.execute("ALTER TABLE users ADD COLUMN status_until DATETIME")
    print("Таблица users обновлена")
except sqlite3.OperationalError:
    print("Колонки в users уже существуют")

# Добавляем колонки в таблицу расписания
try:
    cursor.execute("ALTER TABLE schedule ADD COLUMN end_time TEXT")
    cursor.execute("ALTER TABLE schedule ADD COLUMN lesson_type TEXT")
    cursor.execute("ALTER TABLE schedule ADD COLUMN week_numbers TEXT")
    cursor.execute("ALTER TABLE schedule ADD COLUMN is_custom INTEGER DEFAULT 0")
    print("Таблица schedule обновлена")
except sqlite3.OperationalError:
    print("Колонки в schedule уже существуют")

# Добавляем колонки в tasks
try:
    cursor.execute("ALTER TABLE tasks ADD COLUMN date TEXT")
    cursor.execute("ALTER TABLE tasks ADD COLUMN time TEXT")
    cursor.execute("ALTER TABLE tasks ADD COLUMN is_important INTEGER DEFAULT 0")
    cursor.execute("ALTER TABLE tasks ADD COLUMN category_id TEXT")
    print("Таблица tasks обновлена")
except sqlite3.OperationalError:
    print("Колонки в tasks уже существуют")

conn.commit()
conn.close()
print("✅ База данных создана и обновлена!")

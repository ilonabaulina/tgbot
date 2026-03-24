import sqlite3

conn = sqlite3.connect('bot_database.db')
cursor = conn.cursor()

# Создаем таблицу по правилам: уникальный ID и обязательные поля
cursor.executescript('''
-- 1. Таблица пользователей (добавили колонку для темы календаря)
CREATE TABLE IF NOT EXISTS users (
    user_id INTEGER PRIMARY KEY,    -- ID из Telegram
    username TEXT NOT NULL,
    calendar_theme TEXT DEFAULT 'light' 
);

-- 2. Таблица задач (напоминалки)
CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    task_text TEXT NOT NULL,
    notify_at DATETIME,             -- Когда напомнить
    is_done INTEGER DEFAULT 0,      -- 0 = не сделано, 1 = сделано
    FOREIGN KEY (user_id) REFERENCES users (user_id)
);

-- 3. Таблица расписания пар
CREATE TABLE IF NOT EXISTS schedule (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    day_of_week INTEGER,            -- 0 (Пн) ... 6 (Вс)
    lesson_name TEXT,
    start_time TEXT,                -- Например, "09:00"
    room TEXT,                      -- Аудитория
    FOREIGN KEY (user_id) REFERENCES users (user_id)
);

-- 4. Таблица дневника (эмоции)
CREATE TABLE IF NOT EXISTS diary (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    entry_date DATE DEFAULT (DATE('now')),
    content TEXT,
    emotion TEXT,                   -- Смайлик или текст
    FOREIGN KEY (user_id) REFERENCES users (user_id)
);
''')

conn.commit()
conn.close()
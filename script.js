// 1. Глобальные переменные (проверь их наличие в самом начале файла)
let currentViewDate = new Date(); // Текущий месяц в календаре
let selectedFullDate = new Date(); // День, выбранный в сайдбаре
const API_URL = "https://jumble-seismic-silenced.ngrok-free.dev -> http://localhost:5000"; // Твой сервер
const USER_ID = 12345; // Твой ID (или из Telegram WebApp)

// Массив месяцев для заголовка (если его нет внутри функции)
const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];
async function init() {
    await renderMonth();
    setupTasks();
    applySavedAccent();
}

// --- 1. ЗАГРУЗКА И ОТРИСОВКА КАЛЕНДАРЯ ---
async function fetchTasks() {
    try {
        const res = await fetch(`${API_URL}/get_tasks?user_id=${USER_ID}`);
        return await res.json();
    } catch (e) {
        return []; // Если сервер спит, возвращаем пустой список
    }
}

async function renderMonth() {
    const grid = document.getElementById('days-grid');
    if (!grid) return;
    grid.innerHTML = '';

    // Берем текущие значения из глобальной переменной даты
    const y = currentViewDate.getFullYear();
    const m = currentViewDate.getMonth();

    // Месяцы для заголовка
    const monthNames = [
        "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
        "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
    ];

    // Обновляем заголовки в календаре
    if (document.getElementById('m-title')) document.getElementById('m-title').innerText = monthNames[m];
    if (document.getElementById('y-title')) document.getElementById('y-title').innerText = y;

    // Расчет пустых ячеек (чтобы месяц начинался с правильного дня недели)
    let firstDay = new Date(y, m, 1).getDay();
    let shift = (firstDay === 0) ? 6 : firstDay - 1; // Пн - 0, Вс - 6
    let daysInMonth = new Date(y, m + 1, 0).getDate();

    // Получаем задачи из БД
    let tasks = [];
    try {
        tasks = await fetchTasks();
    } catch (e) {
        console.error("Ошибка при получении задач:", e);
    }

    // 1. Отрисовка пустых ячеек
    for (let i = 0; i < shift; i++) {
        const div = document.createElement('div');
        div.className = 'day empty';
        grid.appendChild(div);
    }

    // 2. Отрисовка самих дней месяца
    for (let d = 1; d <= daysInMonth; d++) {
        // Проверка: сегодня ли этот день
        const now = new Date();
        const isToday = (d === now.getDate() && m === now.getMonth() && y === now.getFullYear());

        // Формируем строку даты текущего дня (ГГГГ-ММ-ДД) для сравнения с БД
        const currentDayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        // Ищем, есть ли хоть одна задача на эту конкретную дату
        const hasTask = tasks.some(t => t.date === currentDayStr);

        const dayNode = document.createElement('div');
        dayNode.className = `day ${isToday ? 'today' : ''}`;

        // Если выбран этот день в сайдбаре — подсвечиваем (selectedFullDate должен быть объявлен глобально)
        if (typeof selectedFullDate !== 'undefined' &&
            d === selectedFullDate.getDate() &&
            m === selectedFullDate.getMonth() &&
            y === selectedFullDate.getFullYear()) {
            dayNode.classList.add('selected');
        }

        dayNode.innerText = d;

        // Рисуем плашку (бадж), если есть задачи
        if (hasTask) {
            dayNode.classList.add('has-tasks');
            const badge = document.createElement('div');
            badge.className = 'task-badge';
            dayNode.appendChild(badge);
        }

        // Клик по дню
        dayNode.onclick = () => {
            // Снимаем выделение со всех
            document.querySelectorAll('.day').forEach(el => el.classList.remove('selected'));
            // Выделяем текущий
            dayNode.classList.add('selected');

            // Обновляем глобальную дату
            selectedFullDate = new Date(y, m, d);

            // Если есть функции обновления интерфейса — вызываем
            if (typeof updateDateDisplay === 'function') updateDateDisplay();
            if (typeof openDayDetail === 'function') openDayDetail(d);
        };

        grid.appendChild(dayNode);
    }
}
// --- 2. УМНЫЙ ВВОД (ШАШЛЫКИ 15) ---

function setupTasks() {
    const input = document.getElementById('new-task-input');
    const timePicker = document.getElementById('task-time-picker');
    const addBtn = document.getElementById('add-task-btn');

    const submitTask = async () => {
        let rawText = input.value.trim();
        if (!rawText) return;

        // Приоритет 1: Время из текста (Шашлыки 15)
        let hour = "09", minute = "00";
        const timeMatch = rawText.match(/(\d{1,2})[:.](\d{2})/) || rawText.match(/(?<!\d)(\d{1,2})(?!\d)$/);

        if (timeMatch) {
            if (timeMatch[2]) {
                hour = timeMatch[1].padStart(2, '0');
                minute = timeMatch[2];
            } else {
                hour = timeMatch[1].padStart(2, '0');
                minute = "00";
            }
            rawText = rawText.replace(timeMatch[0], "").trim();
        } else {
            // Приоритет 2: Время из тумблера (input type="time")
            [hour, minute] = timePicker.value.split(':');
        }

        const finalTime = `${hour}:${minute}`;
        const selectedDay = document.querySelector('.day.selected')?.innerText || new Date().getDate();
        const dateStr = `${currentViewDate.getFullYear()}-${String(currentViewDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;

        try {
            const response = await fetch(`${API_URL}/add_task`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: USER_ID,
                    text: rawText || "Напоминание",
                    date: dateStr,
                    time: finalTime
                })
            });

            if (response.ok) {
                renderMonth(); // Обновит плашки в календаре
                input.value = '';
                // Добавляем плашку визуально в сайдбар
                const div = document.createElement('div');
                div.className = 'task-item';
                div.style.borderLeft = `3px solid var(--accent)`;
                div.innerHTML = `<span>${rawText}</span> <b style="color:var(--accent)">${finalTime}</b>`;
                document.getElementById('task-list').prepend(div);
            }
        } catch (err) { console.error(err); }
    };

    input.onkeypress = (e) => { if (e.key === 'Enter') submitTask(); };
    addBtn.onclick = submitTask;
}

// --- 3. НАВИГАЦИЯ (ГОД, НАСТРОЙКИ, ДЕТАЛИ) ---
function showYearPicker() {
    const container = document.getElementById('months-container');
    container.innerHTML = '';
    const year = currentViewDate.getFullYear();
    document.getElementById('picker-year-title').innerText = year;

    months.forEach((name, mIdx) => {
        let mDiv = document.createElement('div');
        mDiv.className = 'mini-month';
        let days = new Date(year, mIdx + 1, 0).getDate();

        let gridHtml = `<div class="mini-month-title">${name}</div><div class="mini-grid">`;
        for(let d=1; d<=days; d++) gridHtml += `<div class="mini-day">${d}</div>`;
        gridHtml += `</div>`;

        mDiv.innerHTML = gridHtml;
        mDiv.onclick = () => {
            currentViewDate.setMonth(mIdx);
            hideYearPicker();
        };
        container.appendChild(mDiv);
    });

    document.getElementById('month-view').classList.add('hidden');
    document.getElementById('year-picker').classList.remove('hidden');
}

function hideYearPicker() {
    document.getElementById('year-picker').classList.add('hidden');
    document.getElementById('month-view').classList.remove('hidden');
    renderMonth();
}

function changeYear(d) {
    currentViewDate.setFullYear(currentViewDate.getFullYear() + d);
    showYearPicker();
}

function toggleSettings() {
    document.getElementById('settings-menu').classList.toggle('hidden');
}

function openDayDetail(day) {
    document.getElementById('detail-date-title').innerText = `${day} ${months[currentViewDate.getMonth()]}`;
    const hGrid = document.getElementById('hourly-grid');
    hGrid.innerHTML = '';
    for (let h = 0; h < 24; h++) {
        hGrid.innerHTML += `<div class="hour-row">
            <div class="time-label">${h}:00</div>
            <div class="hour-content" contenteditable="true"></div>
        </div>`;
    }
    document.getElementById('month-view').classList.add('hidden');
    document.getElementById('day-detail-view').classList.remove('hidden');
}

function closeDayDetail() {
    document.getElementById('day-detail-view').classList.add('hidden');
    document.getElementById('month-view').classList.remove('hidden');
}

// --- 4. ЦВЕТА ---
function changeAccent(color) {
    document.documentElement.style.setProperty('--accent', color);
    localStorage.setItem('user-accent', color);
}

function applySavedAccent() {
    const savedColor = localStorage.getItem('user-accent');
    if (savedColor) {
        document.documentElement.style.setProperty('--accent', savedColor);
        const picker = document.getElementById('accent-color-picker');
        if (picker) picker.value = savedColor;
    }
}

function changeMonth(d) { currentViewDate.setMonth(currentViewDate.getMonth() + d); renderMonth(); }
function goToday() { currentViewDate = new Date(); renderMonth(); }

// 1. Переключение выбранного дня стрелочками в сайдбаре
function changeSelectedDay(offset) {
    const selected = document.querySelector('.day.selected');
    let targetDay;

    if (selected) {
        // Находим следующий/предыдущий элемент в сетке календаря
        const allDays = Array.from(document.querySelectorAll('.day:not(.empty)'));
        const index = allDays.indexOf(selected);
        if (allDays[index + offset]) {
            allDays[index + offset].click(); // Симулируем клик по дню
        }
    } else {
        // Если ничего не выбрано, выбираем сегодня
        document.querySelector('.day.today')?.click();
    }
}

function updateDateDisplay() {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    document.getElementById('selected-date-text').innerText = selectedFullDate.toLocaleDateString('ru-RU', options);

    // Подсвечиваем этот день в основной сетке календаря
    highlightDayInGrid(selectedFullDate.getDate());
}

function changeSelectedDay(offset) {
    selectedFullDate.setDate(selectedFullDate.getDate() + offset);
    updateDateDisplay();
}

function highlightDayInGrid(dayNumber) {
    document.querySelectorAll('.day').forEach(el => {
        el.classList.remove('selected');
        if (el.innerText == dayNumber && !el.classList.contains('empty')) {
            el.classList.add('selected');
        }
    });
}

// Модифицируем saveTask, чтобы она брала именно выбранную стрелочками дату
async function saveTask() {
    const input = document.getElementById('new-task-input');
    let text = input.value.trim();
    if (!text) return;

    // Формируем дату для отправки на сервер (ГГГГ-ММ-ДД)
    const dateStr = selectedFullDate.toISOString().split('T')[0];

    // ... тут твой код парсинга времени из прошлого сообщения ...

    // После успешного добавления (res.ok):
    // 1. Очищаем инпут
    input.value = '';
    // 2. Добавляем в список С ГАЛОЧКОЙ (как ты просила)
    const taskList = document.getElementById('task-list');
    const div = document.createElement('div');
    div.className = 'task-item';
    div.innerHTML = `
        <input type="checkbox" class="task-check">
        <span class="task-text">${text}</span>
    `;
    taskList.prepend(div);

    // 3. Перерисовываем календарь, чтобы появилась плашка на этот день
    renderMonth();
}

function openMiniCalendar() {
    // Вызываем нативный календарь
    document.getElementById('hidden-date-picker').showPicker();
}

function handleMiniCalChange(dateString) {
    if (!dateString) return;
    // Обновляем нашу глобальную переменную даты
    selectedFullDate = new Date(dateString);
    // Обновляем текст в сайдбаре и выделение в большой сетке
    updateDateDisplay();
    // Если у тебя есть функция отрисовки задач на день — вызываем её
    loadTasksForDay(selectedFullDate);
}

function createTaskElement(task) {
    const div = document.createElement('div');
    div.className = `task-item ${task.completed ? 'completed' : ''}`;
    div.dataset.id = task.id; // сохраняем ID для API

    div.innerHTML = `
        <input type="checkbox" class="task-check" ${task.completed ? 'checked' : ''}
               onchange="toggleTaskStatus('${task.id}', this.checked)">
        <div class="task-info">
            <span class="task-text">${task.text}</span>
            <span class="task-time">${task.time}</span>
        </div>
    `;
    return div;
}

// Функция для отправки статуса на сервер
async function toggleTaskStatus(taskId, isCompleted) {
    try {
        await fetch(`${API_URL}/update_task_status`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ id: taskId, completed: isCompleted })
        });
    } catch (e) { console.error("Ошибка обновления статуса:", e); }
}
init();
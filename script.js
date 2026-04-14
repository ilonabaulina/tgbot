
// 1. Глобальные переменные (проверь их наличие в самом начале файла)
let currentViewDate = new Date(); // Текущий месяц в календаре
let selectedFullDate = new Date(); // День, выбранный в сайдбаре
const API_URL = "https://jumble-seismic-silenced.ngrok-free.dev"; // Твой сервер
const USER_ID = 12345; // Твой ID (или из Telegram WebApp)

const COMMON_HEADERS = {
    'ngrok-skip-browser-warning': '69420',
    'Content-Type': 'application/json'
};

// Массив месяцев для заголовка (если его нет внутри функции)
const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];
async function init() {
    await renderMonth();
    setupTasks(); // <--- Она должна быть тут
    applySavedAccent();
    updateDateDisplay();
    await refreshTasks(); // <--- И это тоже
}

// --- 1. ЗАГРУЗКА И ОТРИСОВКА КАЛЕНДАРЯ ---
async function fetchTasks() {
    try {
        const res = await fetch(`${API_URL}/get_tasks?user_id=${USER_ID}`, {
            method: 'GET',
            headers: COMMON_HEADERS // <--- Здесь теперь порядок
        });
        if (!res.ok) throw new Error('Ошибка сети');
        return await res.json();
    } catch (e) {
        console.error("Сервер недоступен:", e);
        return [];
    }
}

async function renderMonth() {
    const grid = document.getElementById('days-grid');
    if (!grid) return;

    grid.innerHTML = '';
    const y = currentViewDate.getFullYear();
    const m = currentViewDate.getMonth();

    if (document.getElementById('m-title')) document.getElementById('m-title').innerText = months[m];
    if (document.getElementById('y-title')) document.getElementById('y-title').innerText = y;

    // Расчет пустых ячеек (Пн-Вс)
    let firstDay = new Date(y, m, 1).getDay();
    let shift = (firstDay === 0) ? 6 : firstDay - 1;
    let daysInMonth = new Date(y, m + 1, 0).getDate();

    const tasks = await fetchTasks();

    // 2. Рисуем пустые ячейки до начала месяца
    for (let i = 0; i < shift; i++) {
        const div = document.createElement('div');
        div.className = 'day empty';
        grid.appendChild(div);
    }

    // 3. Рисуем дни месяца
    for (let d = 1; d <= daysInMonth; d++) {
        const now = new Date();
        const isToday = (d === now.getDate() && m === now.getMonth() && y === now.getFullYear());

        // Форматируем дату текущего дня для сравнения с БД (ГГГГ-ММ-ДД)
        const currentDayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;       // Проверяем наличие ТОЛЬКО НЕВЫПОЛНЕННЫХ задач на этот день
// ЛОГИКА: Плашка (badge) рисуется только если есть НЕВЫПОЛНЕННЫЕ задачи
        const hasActiveTasks = tasks.some(t =>
            t.date && t.date.startsWith(currentDayStr) && t.completed == 0
        );

        const dayNode = document.createElement('div');
        dayNode.className = `day ${isToday ? 'today' : ''}`;

        if (d === selectedFullDate.getDate() &&
            m === selectedFullDate.getMonth() &&
            y === selectedFullDate.getFullYear()) {
            dayNode.classList.add('selected');
        }

        dayNode.innerText = d;

        if (hasActiveTasks) {
            dayNode.classList.add('has-tasks');
            const badge = document.createElement('div');
            badge.className = 'task-badge';
            dayNode.appendChild(badge);
        }

        dayNode.onclick = async () => {
            selectedFullDate = new Date(y, m, d);
            updateDateDisplay();
            await renderMonth();
            openDayDetail(d);
            await refreshTasks();
        };

        grid.appendChild(dayNode);
    }
}
// --- 2. УМНЫЙ ВВОД ---
function setupTasks() {
    const taskInput = document.getElementById('new-task-input');
    const addBtn = document.getElementById('add-task-btn');

    if (!taskInput || !addBtn) {
        console.error("Критическая ошибка: элементы ввода не найдены!");
        return;
    }

    const performSubmit = async (e) => {
        // Останавливаем любое стандартное поведение браузера
        if (e) {
            e.preventDefault();
            e.stopPropagation();
        }

        let rawText = taskInput.value.trim();
        console.log("Попытка отправить задачу:", rawText); // Проверка в консоли

        if (!rawText) return;

        const dateStr = `${selectedFullDate.getFullYear()}-${String(selectedFullDate.getMonth() + 1).padStart(2, '0')}-${String(selectedFullDate.getDate()).padStart(2, '0')}`;

        let hour = "09", minute = "00";
        const timeMatch = rawText.match(/(\d{1,2})[:.](\d{2})/) || rawText.match(/(?<!\d)(\d{1,2})(?!\d)$/);

        if (timeMatch) {
            hour = timeMatch[1].padStart(2, '0');
            minute = (timeMatch[2] || "00").padStart(2, '0');
            rawText = rawText.replace(timeMatch[0], "").trim();
        }

        try {
            const response = await fetch(`${API_URL}/add_task`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'ngrok-skip-browser-warning': '69420'
                },
                body: JSON.stringify({
                    user_id: USER_ID,
                    text: rawText || "Напоминание",
                    date: dateStr,
                    time: `${hour}:${minute}`
                })
            });

            if (response.ok) {
                console.log("Задача успешно добавлена!");
                taskInput.value = '';
                await renderMonth();
                if (typeof refreshTasks === 'function') await refreshTasks();
            } else {
                console.error("Ошибка сервера:", response.status);
            }
        } catch (err) {
            console.error("Ошибка сети:", err);
        }
    };

    // Вешаем событие на кнопку ПРЯМЫМ способом
    addBtn.onclick = performSubmit;

    // Вешаем событие на Enter
    taskInput.onkeydown = (e) => {
        if (e.key === 'Enter') {
            performSubmit(e);
            }
        };
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

async function openDayDetail(day) {
    document.getElementById('detail-date-title').innerText = `${day} ${months[currentViewDate.getMonth()]}`;
    const hGrid = document.getElementById('hourly-grid');
    hGrid.innerHTML = '';

    const y = currentViewDate.getFullYear();
    const m = String(currentViewDate.getMonth() + 1).padStart(2, '0');
    const d = String(day).padStart(2, '0');
    const fullDateStr = `${y}-${m}-${d}`;

    const tasks = await fetchTasks();

    for (let h = 0; h < 24; h++) {
        const hourStr = String(h).padStart(2, '0');
        const tasksInThisHour = tasks.filter(t => {
            const taskDate = t.date ? t.date.split(' ')[0] : "";
            const taskHour = t.time ? t.time.split(':')[0] : "";
            return taskDate === fullDateStr && taskHour === hourStr;
        });

        // Формируем HTML для каждой задачи в этом часе с чекбоксом
const taskHtml = tasksInThisHour.map(t => `
    <div class="task-item-mini ${t.completed ? 'completed' : ''}"
         style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
        <input type="checkbox" class="task-check"
               ${t.completed ? 'checked' : ''}
               onchange="updateTaskUI('${t.id}', this)">
        <span class="task-text" style="${t.completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}">
            ${t.text}
        </span>
    </div>
`).join('');

        hGrid.innerHTML += `
            <div class="hour-row" style="min-height: 45px; border-bottom: 1px solid var(--border); display: flex;">
                <div class="time-label" style="width: 50px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-right: 1px solid var(--border);">
                    ${h}:00
                </div>
                <div class="hour-content ${tasksInThisHour.length > 0 ? 'has-data' : ''}"
                     data-hour="${h}"
                     style="flex: 1; padding: 5px 10px; display: flex; flex-direction: column; justify-content: center;">
                    ${taskHtml || '<span style="opacity: 0.2; font-size: 0.7rem;">Свободно</span>'}
                </div>
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
    const display = document.getElementById('selected-date-text');

    if (display) {
        display.innerText = selectedFullDate.toLocaleDateString('ru-RU', options);
    }
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
   // loadTasksForDay(selectedFullDate);
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

async function toggleTaskStatus(taskId, isCompleted) {
    try {
        const response = await fetch(`${API_URL}/update_task_status`, {
            method: 'POST',
            headers: COMMON_HEADERS,
            body: JSON.stringify({ id: taskId, completed: isCompleted })
        });
        return response.ok;
    } catch (e) {
        console.error("Ошибка обновления статуса:", e);
        return false;
    }
}

// Сохранение отредактированного текста
async function saveTaskEdit(taskId, element) {
    const newText = element.innerText.trim();
    try {
        await fetch(`${API_URL}/update_task_text`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'ngrok-skip-browser-warning': 'true'
            },
            body: JSON.stringify({ id: taskId, text: newText })
        });
        console.log("Сохранено:", newText);
    } catch (e) {
        console.error("Ошибка сохранения текста:", e);
    }
}

// Логика перетаскивания задач в списке
function initDragAndDrop() {
    const container = document.getElementById('task-list');
    container.addEventListener('dragover', e => {
        e.preventDefault();
        const afterElement = getDragAfterElement(container, e.clientY);
        const dragging = document.querySelector('.dragging');
        if (afterElement == null) {
            container.appendChild(dragging);
        } else {
            container.insertBefore(dragging, afterElement);
        }
    });
}

function getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.task-item:not(.dragging)')];
    return draggableElements.reduce((closest, child) => {
        const box = child.getBoundingClientRect();
        const offset = y - box.top - box.height / 2;
        if (offset < 0 && offset > closest.offset) {
            return { offset: offset, element: child };
        } else {
            return closest;
        }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
}
//init();
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
document.addEventListener('DOMContentLoaded', () => {
    setupTasks(); // Еще раз принудительно привязываем кнопку после загрузки страницы
});

async function refreshTasks() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;

    const tasks = await fetchTasks();
    taskList.innerHTML = '';

    // 1. Оставляем только активные задачи
    const activeTasks = tasks.filter(t => !t.completed || t.completed === 0);

    if (activeTasks.length === 0) {
        taskList.innerHTML = '<div class="hint">Активных задач нет</div>';
        return;
    }

    // 2. Сортируем
    activeTasks.sort((a, b) => (a.time || "").localeCompare(b.time || ""));

    activeTasks.forEach(task => {
        const div = document.createElement('div');
        div.className = 'task-item';

        // 3. Убираем секунды (из "09:00:00" делаем "09:00")
        const shortTime = task.time ? task.time.substring(0, 5) : "00:00";

        // 4. Красиво форматируем дату (из "2026-04-14" в "14.04")
        let formattedDate = "";
        if (task.date) {
            const dateParts = task.date.split('-');
            if (dateParts.length === 3) {
                formattedDate = `${dateParts[2]}.${dateParts[1]}`;
            }
        }

        // 5. Новая верстка: текст сверху, время и дата снизу
        div.innerHTML = `
           div.innerHTML = `
    <input type="checkbox" class="task-check" 
           ${task.completed ? 'checked' : ''} 
           onclick="updateTaskUI('${task.id}', this)">
    <div class="task-info">
        <div class="task-text">${task.text}</div>
        <div class="task-time">${shortTime} | ${formattedDate}</div>
    </div>
`;
            <div class="task-info">
                <div class="task-text">${task.text}</div>
                <div class="task-time" style="font-size: 0.75rem; color: rgba(255, 255, 255, 0.4); margin-top: 4px;">
                    ${shortTime} | ${formattedDate}
                </div>
            </div>
        `;
        taskList.appendChild(div);
    });
}
init();
// --- ТВОЙ НОВЫЙ ВТОРОЙ ПУНКТ (ГЛАВНЫЙ ДИСПЕТЧЕР ГАЛОЧЕК) ---
window.updateTaskUI = async (taskId, checkbox) => {
    const isDone = checkbox.checked;
    // Находим родительский контейнер задачи (хоть в списке, хоть в сетке)
    const taskItem = checkbox.closest('.task-item') || checkbox.closest('.task-item-mini');

    if (isDone) {
        // 1. Сразу зачеркиваем визуально для скорости
        if (taskItem) taskItem.classList.add('completed');

        // 2. Отправляем запрос на сервер
        const success = await toggleTaskStatus(taskId, true);

        if (success) {
            // 3. Если всё ок, обновляем боковой список (задача исчезнет из-за фильтра)
            await refreshTasks();

            // 4. Обновляем точки на календаре, но только если окно деталей закрыто
            const detailView = document.getElementById('day-detail-view');
            if (detailView && detailView.classList.contains('hidden')) {
                await renderMonth();
            }
        } else {
            // Если сервер выдал ошибку (как на твоем скрине) — возвращаем галочку назад
            checkbox.checked = false;
            if (taskItem) taskItem.classList.remove('completed');
        }
    }
};

// Слушатель для автосохранения при выходе из ячейки часа
document.addEventListener('blur', async (e) => {
    if (e.target.classList.contains('hour-content')) {
        const newText = e.target.innerText.trim();
        const hour = e.target.getAttribute('data-hour');

        if (!newText || !hour) return;

        const y = currentViewDate.getFullYear();
        const m = String(currentViewDate.getMonth() + 1).padStart(2, '0');
        const d = String(selectedFullDate.getDate()).padStart(2, '0');
        const dateStr = `${y}-${m}-${d}`;

        try {
            const response = await fetch(`${API_URL}/add_task`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    user_id: USER_ID,
                    text: newText,
                    date: dateStr,
                    time: `${hour.padStart(2, '0')}:00`
                })
            });
            if (response.ok) {
                await renderMonth(); // чтобы появилась точка на календаре
                await refreshTasks(); // чтобы обновился список сбоку
            }
        } catch (err) {
            console.error("Ошибка сохранения из сетки:", err);
        }
    }
}, true);

let currentViewDate = new Date(); // Текущий месяц в календаре
let selectedFullDate = new Date(); // День, выбранный в сайдбаре
let tasks = [];
const API_URL = "https://jumble-seismic-silenced.ngrok-free.dev"; // Твой сервер
const USER_ID = 12345; // Твой ID (или из Telegram WebApp)

const COMMON_HEADERS = {
    'ngrok-skip-browser-warning': '69420',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

// Массив месяцев для заголовка
const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

// Начальный набор категорий
let categories = JSON.parse(localStorage.getItem('user-categories')) || [
    { id: 'cat1', name: 'Общее', color: '#ff453a' },
    { id: 'cat2', name: 'Учеба', color: '#af52de' },
    { id: 'cat3', name: 'Работа', color: '#34c759' }
];

let selectedCategoryId = 'cat1'; // Какая категория выбрана сейчас при создании

async function init() {
    await fetchCategories();
    await renderMonth();
    setupTasks();
    applySavedAccent();
    updateDateDisplay();
    await refreshTasks();
    renderCategorySelector();
}

function renderCategorySelector() {
    const container = document.getElementById('category-selector');
    if (!container) return;

    container.innerHTML = categories.map(cat => {
        const isActive = String(selectedCategoryId) === String(cat.id);
        // Если выбрана — добавляем тень в цвет категории
        const style = isActive 
            ? `background: ${cat.color}; color: white; box-shadow: 0 0 10px ${cat.color};` 
            : `border: 1px solid ${cat.color}; color: ${cat.color};`;

        return `
            <div class="cat-chip ${isActive ? 'active' : ''}"
                 style="${style}"
                 onclick="selectCategory('${cat.id}')">
                ${cat.name}
            </div>
        `;
    }).join('');
}

window.editCategoryName = function(id) {
    const cat = categories.find(c => c.id === id || String(c.id) === String(id));
    if (!cat) {
        console.error("Категория не найдена:", id);
        return;
    }
    const newName = prompt("Изменить название категории:", cat.name);
    if (newName && newName.trim() !== "") {
        cat.name = newName.trim();
        localStorage.setItem('user-categories', JSON.stringify(categories));
        if (typeof renderCategorySelector === 'function') renderCategorySelector();
    }
};

function selectCategory(id) {
    selectedCategoryId = id;
    renderCategorySelector();
    // Также обновляем цвет кнопки времени/флажка в поле ввода для наглядности
    const timeBtn = document.querySelector('.time-display'); 
    if(timeBtn) timeBtn.style.color = getCategoryById(id).color;
}

async function fetchTasks() {
    try {
        const res = await fetch(`${API_URL}/get_tasks?user_id=${USER_ID}`, {
            method: 'GET',
            headers: COMMON_HEADERS
        });

        if (!res.ok) {
            console.warn("Сервер недоступен, показываю пустой планнер");
            return [];
        }

        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (e) {
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

    let firstDay = new Date(y, m, 1).getDay();
    let shift = (firstDay === 0) ? 6 : firstDay - 1;
    let daysInMonth = new Date(y, m + 1, 0).getDate();

    const allTasks = await fetchTasks();

    for (let i = 0; i < shift; i++) {
        const div = document.createElement('div');
        div.className = 'day empty';
        grid.appendChild(div);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const now = new Date();
        const isToday = (d === now.getDate() && m === now.getMonth() && y === now.getFullYear());
        const currentDayStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

        const dayNode = document.createElement('div');
        dayNode.className = `day ${isToday ? 'today' : ''}`;

        if (d === selectedFullDate.getDate() && m === selectedFullDate.getMonth() && y === selectedFullDate.getFullYear()) {
            dayNode.classList.add('selected');
        }

        dayNode.innerHTML = `<span>${d}</span>`;

        // ЛОГИКА ПЛАШЕК В РЯД (Исправлено)
        const dayTasks = allTasks.filter(t => t.date && t.date.startsWith(currentDayStr) && t.completed == 0);

        if (dayTasks.length > 0) {
            const badgeContainer = document.createElement('div');
            // Стилизуем контейнер для плашек прямо здесь для надежности
            badgeContainer.style.cssText = `
                position: absolute; 
                bottom: 4px; 
                left: 0; 
                right: 0; 
                display: flex; 
                justify-content: center; 
                gap: 2px; 
                padding: 0 4px;
                pointer-events: none;
            `;

            const uniqueColors = [...new Set(dayTasks.map(t => {
                const cat = getCategoryById(t.category_id);
                return cat ? cat.color : '#ff453a';
            }))];

            uniqueColors.forEach(color => {
                const line = document.createElement('div');
                line.style.cssText = `
                    width: 10px; 
                    height: 3px; 
                    background: ${color}; 
                    border-radius: 2px;
                `;
                badgeContainer.appendChild(line);
            });
            dayNode.appendChild(badgeContainer);
        }

        dayNode.onclick = async () => {
            selectedFullDate = new Date(y, m, d);
            updateDateDisplay();
            await renderMonth();
            if (typeof openDayDetail === 'function') openDayDetail(d);
            await refreshTasks();
        };

        grid.appendChild(dayNode);
    }
}

function setupTasks() {
    const taskInput = document.getElementById('new-task-input');
    const addBtn = document.getElementById('add-task-btn');
    const importantCheckbox = document.getElementById('is-important-checkbox');
    const timePicker = document.getElementById('task-time-picker');
    // Ищем кнопку флажка (🚩) по тегу svg или иконке внутри
    const flagBtn = document.querySelector('.icon-btn:has(svg), #flag-icon-trigger'); 

    if (!taskInput || !addBtn) return;

    // Логика визуального переключения флажка
    if (flagBtn && importantCheckbox) {
        flagBtn.onclick = (e) => {
            e.preventDefault();
            importantCheckbox.checked = !importantCheckbox.checked;
            // Красим в красный если включено, в белый если выключено
            flagBtn.style.color = importantCheckbox.checked ? '#ff453a' : 'white';
            flagBtn.style.filter = importantCheckbox.checked ? 'drop-shadow(0 0 5px #ff453a)' : 'none';
        };
    }

    const performSubmit = async (e) => {
        if (e) { e.preventDefault(); e.stopPropagation(); }

        let text = taskInput.value.trim();
        if (!text) return;

        const dateStr = selectedFullDate.toISOString().split('T')[0];
        const isImportant = (importantCheckbox && importantCheckbox.checked) ? 1 : 0;
        let taskTime = timePicker ? timePicker.value : "09:00";

const timeMatch = text.match(/(\d{1,2})[:.](\d{2})/);
if (timeMatch) {
    taskTime = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2].padStart(2, '0')}`;
    // Оставляем текст задачи чистым, без цифр времени
    text = text.replace(timeMatch[0], "").trim();
}

        try {
            const response = await fetch(`${API_URL}/add_task`, {
                method: 'POST',
                headers: COMMON_HEADERS,
                body: JSON.stringify({
                    user_id: USER_ID,
                    text: text,
                    date: dateStr,
                    time: taskTime,
                    category_id: selectedCategoryId,
                    is_important: isImportant
                })
            });

            if (response.ok) {
                taskInput.value = '';
                if (importantCheckbox) {
                    importantCheckbox.checked = false;
                    if (flagBtn) {
                        flagBtn.style.color = 'white';
                        flagBtn.style.filter = 'none';
                    }
                }
                await renderMonth();
                await refreshTasks();
            }
        } catch (err) {
            console.error("Ошибка при отправке:", err);
        }
    };

    addBtn.addEventListener('click', performSubmit);
    taskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSubmit(e); });
}

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
    if (!hGrid) return;
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

        const taskHtml = tasksInThisHour.map(t => {
            // ИСПОЛЬЗУЕМ НАШУ НОВУЮ ФУНКЦИЮ ДЛЯ ЦВЕТА
            const cat = getCategoryById(t.category_id);
            return `
                <div class="task-item-mini ${t.completed ? 'completed' : ''}" 
                     style="--task-color: ${cat.color}; border-left: 4px solid var(--task-color); margin-bottom: 4px;">
                    <input type="checkbox" class="task-check" 
                           ${t.completed ? 'checked' : ''} 
                           onchange="updateTaskUI('${t.id}', this)">
                    <span class="task-text" style="${t.completed ? 'text-decoration: line-through; opacity: 0.5;' : ''}">
                        ${t.is_important == 1 ? '🚩 ' : ''}${t.text}
                    </span>
                </div>
            `;
        }).join('');

        hGrid.innerHTML += `
            <div class="hour-row" style="min-height: 45px; border-bottom: 1px solid rgba(255,255,255,0.1); display: flex;">
                <div class="time-label" style="width: 50px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; border-right: 1px solid rgba(255,255,255,0.1); font-size: 0.7rem; color: #8e8e93;">
                    ${h}:00
                </div>
                <div class="hour-wrapper" style="flex: 1; padding: 5px 10px; display: flex; flex-direction: column;">
                    <div class="hour-tasks-list">${taskHtml}</div>
                    <div class="hour-input-area" 
                         data-hour="${h}" 
                         contenteditable="true" 
                         placeholder="Введите задачу..."
                         style="outline: none; min-height: 20px; font-size: 0.8rem; color: ${getCategoryById(selectedCategoryId).color}; opacity: 0.6; transition: 0.2s;"></div>
                </div>
            </div>`;
    }

    document.getElementById('month-view').classList.add('hidden');
    document.getElementById('day-detail-view').classList.remove('hidden');
}

document.addEventListener('focusin', (e) => {
    if (e.target.classList.contains('hour-input-area')) {
        if (e.target.innerText.trim() === '') {
            e.target.innerText = '';
        }
        e.target.style.opacity = '1';
    }
});

document.addEventListener('focusout', (e) => {
    if (e.target.classList.contains('hour-input-area')) {
        if (e.target.innerText.trim() === '') {
            e.target.innerText = '';
            e.target.style.opacity = '0.4';
        }
    }
});

document.addEventListener('mousedown', (e) => {
    const settingsMenu = document.getElementById('settings-menu');
    const categoryPopup = document.getElementById('category-manager-popup');
    const settingsBtn = document.querySelector('.icon-btn');

    if (settingsMenu && !settingsMenu.classList.contains('hidden')) {
        if (!settingsMenu.contains(e.target) && !settingsBtn.contains(e.target)) {
            settingsMenu.classList.add('hidden');
        }
    }

    if (categoryPopup && !categoryPopup.classList.contains('hidden')) {
        if (!categoryPopup.contains(e.target)) {
            categoryPopup.classList.add('hidden');
        }
    }
});

document.addEventListener('keydown', async (e) => {
    if (e.target.classList.contains('hour-input-area') && e.key === 'Enter') {
        e.preventDefault(); 

        const taskText = e.target.innerText.trim();
        const hour = e.target.getAttribute('data-hour');
        
        const importantCheckbox = document.getElementById('is-important-checkbox');
        const isImportant = (importantCheckbox && importantCheckbox.checked) ? 1 : 0;

        if (!taskText) return;

        const dateStr = selectedFullDate.toISOString().split('T')[0];

        // МЕХАНИКА: Берем текущую выбранную категорию из сайдбара
        const response = await fetch(`${API_URL}/add_task`, {
            method: 'POST',
            headers: COMMON_HEADERS,
            body: JSON.stringify({
                user_id: USER_ID,
                text: taskText,
                date: dateStr,
                time: `${hour.padStart(2, '0')}:00`,
                category_id: selectedCategoryId, // Применяем ту, что выбрана наверху
                is_important: isImportant
            })
        });

        if (response.ok) {
            e.target.innerText = ''; 
            await openDayDetail(selectedFullDate.getDate());
            await renderMonth();
            await refreshTasks();
        }
    }
});
function closeDayDetail() {
    document.getElementById('day-detail-view').classList.add('hidden');
    document.getElementById('month-view').classList.remove('hidden');
}

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

function changeMonth(d) {
    currentViewDate.setMonth(currentViewDate.getMonth() + d);
    renderMonth();
}

function goToday() {
    currentViewDate = new Date();
    renderMonth();
}

function changeSelectedDay(offset) {
    const selected = document.querySelector('.day.selected');
    let targetDay;

    if (selected) {
        const allDays = Array.from(document.querySelectorAll('.day:not(.empty)'));
        const index = allDays.indexOf(selected);
        if (allDays[index + offset]) {
            allDays[index + offset].click();
        }
    } else {
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

function openMiniCalendar() {
    document.getElementById('hidden-date-picker').showPicker();
}

function handleMiniCalChange(dateString) {
    if (!dateString) return;
    selectedFullDate = new Date(dateString);
    updateDateDisplay();
}

async function toggleTaskStatus(taskId, isCompleted) {
    try {
        const response = await fetch(`${API_URL}/update_task_status`, {
            method: 'POST',
            headers: COMMON_HEADERS,
            body: JSON.stringify({ id: taskId, completed: isCompleted ? 1 : 0 })
        });
        return response.ok;
    } catch (e) {
        return false;
    }
}

window.updateTaskUI = async (taskId, checkbox) => {
    const isDone = checkbox.checked;
    const taskItem = checkbox.closest('.task-item') || checkbox.closest('.task-item-mini');

    if (taskItem) {
        taskItem.classList.toggle('completed', isDone);
    }

    const success = await toggleTaskStatus(taskId, isDone);

    if (success) {
        await refreshTasks();
    } else {
        checkbox.checked = !isDone;
    }
};

async function refreshTasks() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;

    const allTasks = await fetchTasks();
    taskList.innerHTML = '';

    const currentDayStr = selectedFullDate.toISOString().split('T')[0];
    const dayTasks = allTasks.filter(t => t.date && t.date.startsWith(currentDayStr));

    if (dayTasks.length === 0) {
        taskList.innerHTML = '<div class="hint" style="text-align:center; opacity:0.5; margin-top:20px;">Задач на этот день нет</div>';
        return;
    }

    dayTasks.sort((a, b) => (a.time || "00:00").localeCompare(b.time || "00:00"));

    dayTasks.forEach(task => {
        const cat = getCategoryById(task.category_id);
        const isDone = task.completed == 1;
        
        const div = document.createElement('div');
        div.className = `task-item ${isDone ? 'completed' : ''}`;
        div.style.cssText = `
            border-left: 4px solid ${cat.color};
            background: rgba(255, 255, 255, 0.03);
            margin-bottom: 8px;
            padding: 12px;
            border-radius: 10px;
            display: flex;
            align-items: center;
            gap: 12px;
        `;

        div.innerHTML = `
            <input type="checkbox" ${isDone ? 'checked' : ''} 
                   onchange="updateTaskUI('${task.id}', this)"
                   style="accent-color: ${cat.color}; width: 18px; height: 18px;">
            <div style="flex:1">
                <div style="color: white; font-size: 0.95rem; ${isDone ? 'text-decoration:line-through; opacity:0.5' : ''}">
                    ${task.is_important ? '<span style="color:#ff453a">🚩</span> ' : ''}${task.text}
                </div>
                <div style="color: ${cat.color}; font-size: 0.75rem; font-weight: bold; margin-top: 2px;">
                    ${task.time || "00:00"}
                </div>
            </div>
        `;
        taskList.appendChild(div);
    });
}
function syncCategories() {
    localStorage.setItem('user-categories', JSON.stringify(categories));
    renderCategorySelector();
    if (!document.getElementById('category-manager-popup').classList.contains('hidden')) {
        renderCategoryManagerList();
    }
}

function syncCategoriesUI() {
    localStorage.setItem('user-categories', JSON.stringify(categories));
    renderCategorySelector();
    const popup = document.getElementById('category-manager-popup');
    if (popup && !popup.classList.contains('hidden')) {
        renderCategoryManagerList();
    }
}

async function addNewCategory() {
    const nameInput = document.getElementById('new-cat-name');
    const colorInput = document.getElementById('new-cat-color');
    const name = nameInput.value.trim();

    if (!name) return;

    const newCat = {
        user_id: USER_ID,
        name: name,
        color: colorInput.value
    };

    try {
        const res = await fetch(`${API_URL}/add_category`, {
            method: 'POST',
            headers: COMMON_HEADERS,
            body: JSON.stringify(newCat)
        });

        if (res.ok) {
            const savedCat = await res.json();
            categories.push(savedCat);
            nameInput.value = '';
            syncCategoriesUI();
        }
    } catch (e) {
        console.error("Не удалось сохранить категорию на сервере", e);
    }
}

window.editCat = function(id) {
    const cat = categories.find(c => c.id === id);
    if (!cat) return;
    const newName = prompt("Изменить название:", cat.name);
    if (newName && newName.trim() !== "") {
        cat.name = newName.trim();
        localStorage.setItem('user-categories', JSON.stringify(categories));
        renderCategorySelector();
    }
};

function toggleCategoryManager() {
    const popup = document.getElementById('category-manager-popup');
    popup.classList.toggle('hidden');
    if (!popup.classList.contains('hidden')) {
        renderCategoryManagerList();
    }
}

async function fetchCategories() {
    try {
        const res = await fetch(`${API_URL}/get_categories?user_id=${USER_ID}`, {
            method: 'GET',
            headers: COMMON_HEADERS
        });
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                categories = data;
                localStorage.setItem('user-categories', JSON.stringify(categories));
            }
        }
    } catch (e) {
        console.error("Ошибка загрузки категорий, использую локальные", e);
    }
}

function renderCategoryManagerList() {
    const listContainer = document.getElementById('categories-list');
    if (!listContainer) return;

    listContainer.innerHTML = categories.map(cat => `
        <div class="category-manage-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 5px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${cat.color};"></div>
                <span style="font-size: 1rem;">${cat.name}</span>
            </div>
            <div style="display: flex; gap: 4px;">
                <button onclick="editCategoryFull('${cat.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 1 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                </button>
                <button onclick="deleteCategoryFull('${cat.id}')">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                </button>
            </div>
        </div>
    `).join('');
}

window.deleteCategoryFull = async function(id) {
    if (!confirm("Удалить категорию?")) return;

    try {
        const res = await fetch(`${API_URL}/delete_category`, {
            method: 'POST',
            headers: COMMON_HEADERS,
            body: JSON.stringify({ user_id: USER_ID, category_id: id })
        });

        if (res.ok) {
            await fetchCategories();
            renderCategorySelector();
            renderCategoryManagerList();
        }
    } catch (e) {
        console.error("Ошибка удаления", e);
    }
};
// Находит категорию по ID (нужно для цвета флажка)
function getCategoryById(id) {
    const category = categories.find(c => String(c.id) === String(id));
    return category || categories[0]; // Если не нашли, вернем "Общее"
}

// Создает карточку задачи с учетом цвета её категории
function createTaskElement(task) {
    const category = getCategoryById(task.categoryId);
    const taskEl = document.createElement('div');
    taskEl.className = 'task-card';
    
    // Применяем цвет категории к левой границе
    taskEl.style.borderLeft = `4px solid ${category.color}`;
    
    taskEl.innerHTML = `
        <div class="task-info">
            <span class="task-time">${task.time}</span>
            <span class="task-name">${task.name}</span>
        </div>
        ${task.isImportant ? '<span class="important-flag">🚩</span>' : ''}
    `;
    return taskEl;
}

function renderDayView(selectedDate) {
    // 1. Исправленный ID: ищем именно тот контейнер, который есть в index.html
    const container = document.getElementById('hourly-grid');
    if (!container) {
        console.error("Контейнер hourly-grid не найден!");
        return;
    }
    container.innerHTML = ''; 

    // Проверяем, что глобальный массив задач существует
    const allTasks = (typeof tasks !== 'undefined') ? tasks : [];

    // 2. Берем задачи на выбранную дату и сортируем (11:00, 11:15, 11:45...)
    const dayTasks = allTasks
        .filter(t => t.date === selectedDate)
        .sort((a, b) => a.time.localeCompare(b.time));

    // 3. Рисуем сетку 24 часа
    for (let hour = 0; hour < 24; hour++) {
        const hourStr = `${hour.toString().padStart(2, '0')}:00`;
        
        // Создаем заголовок часа
        const hourRow = document.createElement('div');
        hourRow.className = 'hour-row';
        hourRow.innerHTML = `<span class="time-label">${hourStr}</span><div class="hour-line"></div>`;
        container.appendChild(hourRow);

        // Ищем задачи, которые попадают в этот час (например, 11:15 -> час 11)
        const tasksInThisHour = dayTasks.filter(t => {
            if (!t.time) return false;
            const h = parseInt(t.time.split(':')[0]);
            return h === hour;
        });

        // Вставляем карточки задач СРАЗУ под линией часа
        tasksInThisHour.forEach(task => {
            container.appendChild(createTaskElement(task));
        });
    }
}
window.editCategoryFull = async function(id) {
    const cat = categories.find(c => c.id == id);
    const newName = prompt("Новое название категории:", cat.name);

    if (newName && newName.trim() !== "") {
        cat.name = newName.trim();
        syncCategoriesUI();
    }
};

init();

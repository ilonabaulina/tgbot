let currentViewDate = new Date();
let selectedFullDate = new Date();
let tasks = [];
const API_URL = "https://jumble-seismic-silenced.ngrok-free.dev";

// ========== ПОЛУЧАЕМ USER_ID ИЗ TELEGRAM ==========
let USER_ID = 12345;

if (window.Telegram && Telegram.WebApp) {
    const tgUser = Telegram.WebApp.initDataUnsafe?.user;
    if (tgUser && tgUser.id) {
        USER_ID = tgUser.id;
        console.log('Telegram user ID:', USER_ID);
    }
}

const savedUserId = localStorage.getItem('telegram_user_id');
if (!USER_ID && savedUserId) {
    USER_ID = parseInt(savedUserId);
}

console.log('USER_ID:', USER_ID);

const COMMON_HEADERS = {
    'ngrok-skip-browser-warning': '69420',
    'Content-Type': 'application/json',
    'Accept': 'application/json'
};

const months = [
    "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
    "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"
];

let categories = JSON.parse(localStorage.getItem('user-categories')) || [
    { id: 'cat1', name: 'Общее', color: '#ff453a' },
    { id: 'cat2', name: 'Учеба', color: '#af52de' },
    { id: 'cat3', name: 'Работа', color: '#34c759' },
    { id: 'cat4', name: 'Личное', color: '#ff9f0a' }
];

let selectedCategoryId = 'cat1';

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getCategoryById(id) {
    const category = categories.find(c => String(c.id) === String(id));
    return category || categories[0];
}

// ========== РАБОТА С СЕРВЕРОМ ==========
async function fetchTasks() {
    try {
        const res = await fetch(`${API_URL}/get_tasks?user_id=${USER_ID}`, {
            method: 'GET',
            headers: COMMON_HEADERS
        });
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
    } catch (e) {
        return [];
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
        console.error("Ошибка загрузки категорий", e);
    }
}

// ========== КАТЕГОРИИ ==========
function renderCategorySelector() {
    const container = document.getElementById('category-selector');
    if (!container) return;

    container.innerHTML = categories.map(cat => {
        const isActive = String(selectedCategoryId) === String(cat.id);
        const style = isActive 
            ? `background: ${cat.color}; color: white; border: 1px solid ${cat.color}; opacity: 1; font-weight: bold;` 
            : `background: transparent; color: ${cat.color}; border: 1px solid ${cat.color}; opacity: 0.6;`;
        return `<div class="cat-chip" style="${style}" onclick="selectCategory('${cat.id}')">${cat.name}</div>`;
    }).join('');
}

function selectCategory(id) {
    selectedCategoryId = id;
    renderCategorySelector();
    
    const cat = getCategoryById(id);
    const flagBtn = document.getElementById('flag-icon-trigger');
    const importantCheckbox = document.getElementById('is-important-checkbox');
    
    if (flagBtn && cat) {
        if (importantCheckbox && importantCheckbox.checked) {
            flagBtn.style.color = cat.color;
            flagBtn.style.opacity = "1";
        } else {
            flagBtn.style.color = cat.color;
            flagBtn.style.opacity = "0.6";
        }
    }
}

function toggleCategoryManager() {
    const popup = document.getElementById('category-manager-popup');
    popup.classList.toggle('hidden');
    if (!popup.classList.contains('hidden')) {
        renderCategoryManagerList();
    }
}

function renderCategoryManagerList() {
    const listContainer = document.getElementById('categories-list');
    if (!listContainer) return;

    listContainer.innerHTML = categories.map(cat => `
        <div class="category-manage-item" style="display: flex; align-items: center; justify-content: space-between; padding: 12px 5px; border-bottom: 1px solid rgba(255,255,255,0.05);">
            <div style="display: flex; align-items: center; gap: 12px;">
                <div style="width: 12px; height: 12px; border-radius: 50%; background: ${cat.color};"></div>
                <span>${cat.name}</span>
            </div>
            <div style="display: flex; gap: 4px;">
                <button onclick="editCategoryFull('${cat.id}')">✏️</button>
                <button onclick="deleteCategoryFull('${cat.id}')">🗑️</button>
            </div>
        </div>
    `).join('');
}

async function addNewCategory() {
    const nameInput = document.getElementById('new-cat-name');
    const colorInput = document.getElementById('new-cat-color');
    const name = nameInput.value.trim();
    if (!name) return;

    try {
        const res = await fetch(`${API_URL}/add_category`, {
            method: 'POST',
            headers: COMMON_HEADERS,
            body: JSON.stringify({ user_id: USER_ID, name: name, color: colorInput.value })
        });
        if (res.ok) {
            const savedCat = await res.json();
            categories.push(savedCat);
            nameInput.value = '';
            renderCategorySelector();
            renderCategoryManagerList();
        }
    } catch (e) {
        console.error("Ошибка", e);
    }
}

window.editCategoryFull = async function(id) {
    const cat = categories.find(c => c.id == id);
    const newName = prompt("Новое название категории:", cat.name);
    if (newName && newName.trim() !== "") {
        cat.name = newName.trim();
        localStorage.setItem('user-categories', JSON.stringify(categories));
        renderCategorySelector();
        renderCategoryManagerList();
    }
};

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
        console.error("Ошибка", e);
    }
};

// ========== КАЛЕНДАРЬ ==========
async function renderMonth() {
    const grid = document.getElementById('days-grid');
    if (!grid) return;
    grid.innerHTML = '';
    
    const y = currentViewDate.getFullYear();
    const m = currentViewDate.getMonth();

    document.getElementById('m-title').innerText = months[m];
    document.getElementById('y-title').innerText = y;

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

        // ТОЛЬКО НЕВЫПОЛНЕННЫЕ ЗАДАЧИ ДЛЯ ПЛАШЕК
        const dayTasks = allTasks.filter(t => t.date && t.date === currentDayStr && t.completed == 0);
        if (dayTasks.length > 0) {
            const badgeContainer = document.createElement('div');
            badgeContainer.style.cssText = `position: absolute; bottom: 4px; left: 0; right: 0; display: flex; justify-content: center; gap: 2px; padding: 0 4px; pointer-events: none;`;
            const uniqueColors = [...new Set(dayTasks.map(t => {
                const cat = getCategoryById(t.category_id);
                return cat ? cat.color : '#ff453a';
            }))];
            uniqueColors.forEach(color => {
                const line = document.createElement('div');
                line.style.cssText = `width: 10px; height: 3px; background: ${color}; border-radius: 2px;`;
                badgeContainer.appendChild(line);
            });
            dayNode.appendChild(badgeContainer);
        }

        dayNode.onclick = async () => {
            selectedFullDate = new Date(y, m, d);
            updateDateDisplay();
            await renderMonth();
            await refreshTasks();
            openDayDetail(d);
        };
        grid.appendChild(dayNode);
    }
}

function changeMonth(d) {
    currentViewDate.setMonth(currentViewDate.getMonth() + d);
    renderMonth();
}

function goToday() {
    currentViewDate = new Date();
    selectedFullDate = new Date();
    updateDateDisplay();
    renderMonth();
    refreshTasks();
}

function showYearPicker() {
    const container = document.getElementById('months-container');
    if (!container) return;
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
        mDiv.onclick = () => { currentViewDate.setMonth(mIdx); hideYearPicker(); };
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

// ========== ДЕТАЛЬНЫЙ ВИД ДНЯ ==========
function openDayDetail(day) {
    const y = currentViewDate.getFullYear();
    const m = currentViewDate.getMonth();
    const selectedDate = new Date(y, m, day);
    
    if (isNaN(selectedDate.getTime())) {
        console.error("Invalid date:", y, m, day);
        return;
    }
    
    document.getElementById('month-view').classList.add('hidden');
    document.getElementById('day-detail-view').classList.remove('hidden');
    
    const dateStr = selectedDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' });
    document.getElementById('detail-date-title').innerText = dateStr;
    
    renderHourlyTasksForDate(selectedDate);
}

async function renderHourlyTasksForDate(date) {
    const container = document.getElementById('hourly-grid');
    if (!container) return;
    
    container.innerHTML = '';
    const dateStr = date.toISOString().split('T')[0];
    const allTasks = await fetchTasks();
    
    // ПОКАЗЫВАЕМ ВСЕ ЗАДАЧИ НА ДЕНЬ (И ВЫПОЛНЕННЫЕ, И НЕТ)
    const dayTasks = allTasks.filter(t => t.date === dateStr);
    
    console.log(`Задачи на ${dateStr}:`, dayTasks.length);
    
    if (dayTasks.length === 0) {
        container.innerHTML = '<div style="text-align:center; padding: 40px; opacity:0.5;">📭 Нет задач на этот день</div>';
        return;
    }
    
    // Группируем по часам
    const tasksByHour = {};
    dayTasks.forEach(task => {
        const hour = task.time ? task.time.split(':')[0] : '09';
        if (!tasksByHour[hour]) tasksByHour[hour] = [];
        tasksByHour[hour].push(task);
    });
    
    // Сортируем часы
    const hours = Object.keys(tasksByHour).sort((a,b) => parseInt(a) - parseInt(b));
    
    for (const hour of hours) {
        const hourTasks = tasksByHour[hour];
        
        const hourDiv = document.createElement('div');
        hourDiv.style.cssText = 'border-bottom: 1px solid rgba(255,255,255,0.1); padding: 10px 0; margin-bottom: 10px;';
        hourDiv.innerHTML = `
            <div style="display: flex; align-items: center; margin-bottom: 8px;">
                <div style="width: 60px; color: var(--accent); font-weight: bold;">${hour}:00</div>
                <div style="flex: 1; height: 1px; background: rgba(255,255,255,0.1);"></div>
            </div>
            <div style="margin-left: 60px;">
                ${hourTasks.map(task => {
                    const cat = getCategoryById(task.category_id);
                    const isCompleted = task.completed == 1;
                    return `
                        <div style="background: rgba(255,255,255,0.05); border-left: 3px solid ${cat.color}; padding: 10px; margin-bottom: 8px; border-radius: 8px; display: flex; align-items: center; gap: 10px; opacity: ${isCompleted ? 0.5 : 1};">
                            <input type="checkbox" ${isCompleted ? 'checked' : ''} onchange="completeTask('${task.id}', this)" style="accent-color: ${cat.color}; width: 20px; height: 20px;">
                            <div style="flex:1;">
                                <span style="${isCompleted ? 'text-decoration: line-through;' : ''}">${task.is_important == 1 ? '🚩 ' : ''}${escapeHtml(task.text)}</span>
                                <div style="color: ${cat.color}; font-size: 0.7rem; margin-top: 3px;">${task.time || '09:00'}</div>
                            </div>
                            <button onclick="deleteTask('${task.id}')" style="background: none; border: none; color: #8e8e93; cursor: pointer;">🗑️</button>
                        </div>
                    `;
                }).join('')}
                <div contenteditable="true" class="quick-add-task" data-hour="${hour}" data-date="${dateStr}" style="color: #8e8e93; font-size: 0.8rem; padding: 8px; outline: none; cursor: text; border-radius: 8px; background: rgba(255,255,255,0.03);">+ Добавить задачу</div>
            </div>
        `;
        container.appendChild(hourDiv);
    }
}

function closeDayDetail() {
    document.getElementById('day-detail-view').classList.add('hidden');
    document.getElementById('month-view').classList.remove('hidden');
}

// ========== ЗАДАЧИ ==========
function setupTasks() {
    const taskInput = document.getElementById('new-task-input');
    const addBtn = document.getElementById('add-task-btn');
    const importantCheckbox = document.getElementById('is-important-checkbox');
    const timePicker = document.getElementById('task-time-picker');
    const flagBtn = document.getElementById('flag-icon-trigger');

    if (!taskInput || !addBtn) return;

    if (flagBtn) {
        const startCat = getCategoryById(selectedCategoryId);
        flagBtn.style.color = startCat.color;
        flagBtn.style.opacity = "0.6";
        
        flagBtn.onclick = (e) => {
            e.preventDefault();
            e.stopPropagation();
            const currentIndex = categories.findIndex(c => String(c.id) === String(selectedCategoryId));
            const nextIndex = (currentIndex + 1) % categories.length;
            const nextCategory = categories[nextIndex];
            selectedCategoryId = nextCategory.id;
            renderCategorySelector();
            if (importantCheckbox && importantCheckbox.checked) {
                flagBtn.style.color = nextCategory.color;
                flagBtn.style.opacity = "1";
            } else {
                flagBtn.style.color = nextCategory.color;
                flagBtn.style.opacity = "0.6";
            }
            flagBtn.style.transform = 'scale(0.9)';
            setTimeout(() => { flagBtn.style.transform = 'scale(1)'; }, 150);
        };
    }

    if (importantCheckbox && flagBtn) {
        importantCheckbox.onchange = () => {
            const cat = getCategoryById(selectedCategoryId);
            if (importantCheckbox.checked) {
                flagBtn.style.color = cat.color;
                flagBtn.style.opacity = "1";
            } else {
                flagBtn.style.color = cat.color;
                flagBtn.style.opacity = "0.6";
            }
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
                    const cat = getCategoryById(selectedCategoryId);
                    if (flagBtn) {
                        flagBtn.style.color = cat.color;
                        flagBtn.style.opacity = "0.6";
                    }
                }
                await renderMonth();
                await refreshTasks();
                
                if (window.Telegram && Telegram.WebApp) {
                    Telegram.WebApp.sendData(JSON.stringify({
                        text: text,
                        date: dateStr,
                        time: taskTime,
                        category_id: selectedCategoryId
                    }));
                }
            }
        } catch (err) {
            console.error("Ошибка:", err);
        }
    };

    addBtn.addEventListener('click', performSubmit);
    taskInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') performSubmit(e); });
}

async function refreshTasks() {
    const taskList = document.getElementById('task-list');
    if (!taskList) return;

    const allTasks = await fetchTasks();
    // ТОЛЬКО НЕВЫПОЛНЕННЫЕ ЗАДАЧИ ДЛЯ САЙДБАРА
    const incompleteTasks = allTasks.filter(t => t.completed == 0);
    
    console.log("Активных задач в сайдбаре:", incompleteTasks.length);
    
    if (incompleteTasks.length === 0) {
        taskList.innerHTML = '<div class="hint" style="text-align:center; opacity:0.5; margin-top:20px;">✅ Все задачи выполнены!</div>';
        return;
    }

    incompleteTasks.sort((a, b) => {
        const dateA = new Date(`${a.date}T${a.time || '00:00'}`);
        const dateB = new Date(`${b.date}T${b.time || '00:00'}`);
        return dateA - dateB;
    });

    taskList.innerHTML = '';
    incompleteTasks.forEach(task => {
        const cat = getCategoryById(task.category_id);
        const taskDate = new Date(task.date);
        const dateFormatted = taskDate.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' });
        const timeFormatted = task.time ? task.time.substring(0, 5) : "09:00";
        
        const div = document.createElement('div');
        div.className = 'task-item';
        div.style.cssText = `border-left: 4px solid ${cat.color}; background: rgba(255, 255, 255, 0.05); margin-bottom: 8px; padding: 14px; border-radius: 12px; display: flex; align-items: center; gap: 12px;`;
        div.innerHTML = `
            <input type="checkbox" onchange="completeTask('${task.id}', this)" style="accent-color: ${cat.color}; width: 22px; height: 22px; cursor: pointer;">
            <div style="flex:1">
                <div style="color: white; font-size: 1rem;">
                    ${task.is_important == 1 ? '🚩 ' : ''}${escapeHtml(task.text)}
                </div>
                <div style="color: ${cat.color}; font-size: 0.75rem; margin-top: 4px;">
                    ${dateFormatted} • ${timeFormatted}
                </div>
            </div>
            <button onclick="deleteTask('${task.id}')" style="background: none; border: none; color: #8e8e93; cursor: pointer;">🗑️</button>
        `;
        taskList.appendChild(div);
    });
}

async function completeTask(taskId, checkbox) {
    try {
        const response = await fetch(`${API_URL}/update_task_status`, {
            method: 'POST',
            headers: COMMON_HEADERS,
            body: JSON.stringify({ id: taskId, completed: 1 })
        });
        if (response.ok) {
            await refreshTasks();
            await renderMonth();
            if (document.getElementById('day-detail-view') && !document.getElementById('day-detail-view').classList.contains('hidden')) {
                await renderHourlyTasksForDate(selectedFullDate);
            }
        } else {
            checkbox.checked = false;
        }
    } catch (e) {
        checkbox.checked = false;
    }
}

async function deleteTask(taskId) {
    if (!confirm('Удалить задачу?')) return;
    try {
        const response = await fetch(`${API_URL}/delete_task`, {
            method: 'POST',
            headers: COMMON_HEADERS,
            body: JSON.stringify({ id: taskId })
        });
        if (response.ok) {
            await refreshTasks();
            await renderMonth();
            if (document.getElementById('day-detail-view') && !document.getElementById('day-detail-view').classList.contains('hidden')) {
                await renderHourlyTasksForDate(selectedFullDate);
            }
        }
    } catch (e) {
        console.error("Ошибка:", e);
    }
}

// ========== НАСТРОЙКИ ==========
function toggleSettings() {
    const menu = document.getElementById('settings-menu');
    if (menu) menu.classList.toggle('hidden');
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

function changeFontSize(size) {
    document.documentElement.style.setProperty('--app-font-size', size);
    localStorage.setItem('user-font-size', size);
}

function setTheme(theme) {
    document.body.classList.remove('dark-theme', 'light-theme');
    document.body.classList.add(theme + '-theme');
    localStorage.setItem('user-theme', theme);
}

async function clearDayTasks() {
    const dateStr = selectedFullDate.toISOString().split('T')[0];
    if (!confirm(`Удалить все задачи на ${dateStr}?`)) return;
    try {
        const allTasks = await fetchTasks();
        const dayTasks = allTasks.filter(t => t.date === dateStr);
        for (const task of dayTasks) {
            await fetch(`${API_URL}/delete_task`, {
                method: 'POST',
                headers: COMMON_HEADERS,
                body: JSON.stringify({ id: task.id })
            });
        }
        await refreshTasks();
        await renderMonth();
    } catch (e) {
        console.error("Ошибка:", e);
    }
}

async function clearAllData() {
    if (!confirm('Удалить все задачи и категории?')) return;
    try {
        const allTasks = await fetchTasks();
        for (const task of allTasks) {
            await fetch(`${API_URL}/delete_task`, {
                method: 'POST',
                headers: COMMON_HEADERS,
                body: JSON.stringify({ id: task.id })
            });
        }
        categories = [
            { id: 'cat1', name: 'Общее', color: '#ff453a' },
            { id: 'cat2', name: 'Учеба', color: '#af52de' },
            { id: 'cat3', name: 'Работа', color: '#34c759' },
            { id: 'cat4', name: 'Личное', color: '#ff9f0a' }
        ];
        localStorage.setItem('user-categories', JSON.stringify(categories));
        selectedCategoryId = 'cat1';
        await renderMonth();
        await refreshTasks();
        renderCategorySelector();
        alert('Все данные сброшены');
    } catch (e) {
        console.error('Ошибка:', e);
        alert('Ошибка сброса');
    }
}

// ========== ВСПОМОГАТЕЛЬНЫЕ ==========
function updateDateDisplay() {
    const display = document.getElementById('selected-date-text');
    if (display && selectedFullDate) {
        if (isNaN(selectedFullDate.getTime())) {
            selectedFullDate = new Date();
        }
        display.innerText = selectedFullDate.toLocaleDateString('ru-RU', { 
            day: 'numeric', 
            month: 'long', 
            year: 'numeric' 
        });
    }
}

function openMiniCalendar() {
    const picker = document.getElementById('hidden-date-picker');
    if (picker) picker.showPicker();
}

function handleMiniCalChange(dateString) {
    if (dateString) {
        selectedFullDate = new Date(dateString);
        updateDateDisplay();
        refreshTasks();
        renderMonth();
    }
}

function changeSelectedDay(offset) {
    const newDate = new Date(selectedFullDate);
    newDate.setDate(selectedFullDate.getDate() + offset);
    selectedFullDate = newDate;
    updateDateDisplay();
    refreshTasks();
    renderMonth();
}

// ========== ОБРАБОТЧИКИ ==========
document.addEventListener('keydown', async (e) => {
    if (e.target.classList && e.target.classList.contains('quick-add-task') && e.key === 'Enter') {
        e.preventDefault();
        const text = e.target.innerText.trim();
        const hour = e.target.getAttribute('data-hour');
        const date = e.target.getAttribute('data-date');
        
        if (!text || text === '+ Добавить задачу') return;
        
        try {
            await fetch(`${API_URL}/add_task`, {
                method: 'POST',
                headers: COMMON_HEADERS,
                body: JSON.stringify({
                    user_id: USER_ID,
                    text: text,
                    date: date,
                    time: `${hour}:00`,
                    category_id: selectedCategoryId,
                    is_important: 0
                })
            });
            
            e.target.innerHTML = '+ Добавить задачу';
            const currentDate = new Date(date);
            await renderHourlyTasksForDate(currentDate);
            await refreshTasks();
            await renderMonth();
        } catch (err) {
            console.error("Ошибка:", err);
        }
    }
});

document.addEventListener('click', (e) => {
    const settingsMenu = document.getElementById('settings-menu');
    const categoryPopup = document.getElementById('category-manager-popup');
    const settingsBtn = document.querySelector('.setting-trigger');
    
    if (settingsMenu && !settingsMenu.classList.contains('hidden')) {
        if (!settingsMenu.contains(e.target) && !settingsBtn?.contains(e.target)) {
            settingsMenu.classList.add('hidden');
        }
    }
    
    if (categoryPopup && !categoryPopup.classList.contains('hidden')) {
        if (!categoryPopup.contains(e.target)) {
            categoryPopup.classList.add('hidden');
        }
    }
});

let isSyncing = false;

async function syncTasksFromBot() {
    if (isSyncing) {
        console.log("Синхронизация уже выполняется...");
        return;
    }
    
    isSyncing = true;
    
    try {
        console.log("Синхронизация с ботом...");
        
        const response = await fetch(`${API_URL}/bot/user_tasks?user_id=${USER_ID}`, {
            method: 'GET',
            headers: COMMON_HEADERS,
            cache: 'no-store'
        });
        
        if (!response.ok) return;
        
        const botTasks = await response.json();
        const currentTasks = await fetchTasks();
        
        const existingMap = new Map();
        currentTasks.forEach(task => {
            const key = `${task.text.toLowerCase().trim()}_${task.date}_${task.time || '09:00'}`;
            existingMap.set(key, true);
        });
        
        let addedCount = 0;
        
        for (const botTask of botTasks) {
            if (botTask.completed == 1) continue;
            
            const taskKey = `${botTask.text.toLowerCase().trim()}_${botTask.date}_${botTask.time || '09:00'}`;
            
            if (existingMap.has(taskKey)) {
                console.log("Дубликат пропущен:", botTask.text);
                continue;
            }
            
            await fetch(`${API_URL}/add_task`, {
                method: 'POST',
                headers: COMMON_HEADERS,
                body: JSON.stringify({
                    user_id: USER_ID,
                    text: botTask.text,
                    date: botTask.date,
                    time: botTask.time || '09:00',
                    category_id: botTask.category_id || selectedCategoryId,
                    is_important: botTask.is_important || 0
                })
            });
            addedCount++;
        }
        
        console.log(`Добавлено ${addedCount} новых задач`);
        
        if (addedCount > 0) {
            await refreshTasks();
            await renderMonth();
        }
        
    } catch (error) {
        console.error("Ошибка:", error);
    } finally {
        isSyncing = false;
    }
}

// ========== ИНИЦИАЛИЗАЦИЯ ==========
async function init() {
    await fetchCategories();
    await renderMonth();
    setupTasks();
    applySavedAccent();
    updateDateDisplay();
    await refreshTasks();
    renderCategorySelector();
}

init();

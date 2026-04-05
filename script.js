let currentViewDate = new Date();
const months = ["Январь", "Февраль", "Март", "Апрель", "Май", "Июнь", "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь"];

function init() {
    renderMonth();
    setupTasks();
}

function renderMonth() {
    const grid = document.getElementById('days-grid');
    grid.innerHTML = '';
    const y = currentViewDate.getFullYear(), m = currentViewDate.getMonth();

    document.getElementById('m-title').innerText = months[m];
    document.getElementById('y-title').innerText = y;

    let firstDay = new Date(y, m, 1).getDay();
    let shift = (firstDay === 0) ? 6 : firstDay - 1;
    let daysInMonth = new Date(y, m + 1, 0).getDate();

    for (let i = 0; i < shift; i++) {
        const div = document.createElement('div');
        div.className = 'day empty';
        grid.appendChild(div);
    }

    for (let d = 1; d <= daysInMonth; d++) {
        const isToday = (d === new Date().getDate() && m === new Date().getMonth() && y === new Date().getFullYear());
        const dayNode = document.createElement('div');
        dayNode.className = `day ${isToday ? 'today' : ''}`;
        dayNode.innerText = d;
        dayNode.onclick = () => {
            document.querySelectorAll('.day').forEach(el => el.classList.remove('selected'));
            dayNode.classList.add('selected');
            openDayDetail(d);
        };
        grid.appendChild(dayNode);
    }
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
    window.history.pushState({view: 'detail'}, "");
}

function closeDayDetail() {
    document.getElementById('day-detail-view').classList.add('hidden');
    document.getElementById('month-view').classList.remove('hidden');
}

function showYearPicker() {
    const container = document.getElementById('months-container');
    container.innerHTML = ''; // Очищаем старое
    const year = currentViewDate.getFullYear();
    document.getElementById('picker-year-title').innerText = year;

    months.forEach((name, mIdx) => {
        let mDiv = document.createElement('div');
        mDiv.className = 'mini-month';

        // Математика для маленькой сетки
        let firstDay = new Date(year, mIdx, 1).getDay();
        let shift = (firstDay === 0) ? 6 : firstDay - 1;
        let days = new Date(year, mIdx + 1, 0).getDate();

        let gridHtml = `<div class="mini-month-title">${name}</div><div class="mini-grid">`;

        // Рисуем пустые клеточки
        for(let i=0; i<shift; i++) gridHtml += `<div></div>`;
        // Рисуем числа
        for(let d=1; d<=days; d++) gridHtml += `<div class="mini-day">${d}</div>`;

        gridHtml += `</div>`;
        mDiv.innerHTML = gridHtml;

        // При клике на маленький календарь — переходим в этот месяц
        mDiv.onclick = () => {
            currentViewDate.setMonth(mIdx);
            hideYearPicker();
        };
        container.appendChild(mDiv);
    });

    document.getElementById('month-view').classList.add('hidden');
    document.getElementById('year-picker').classList.remove('hidden');
    window.history.pushState({view: 'year'}, "");
}

function hideYearPicker() {
    document.getElementById('year-picker').classList.add('hidden');
    document.getElementById('month-view').classList.remove('hidden');
    renderMonth();
}

function setupTasks() {
    const input = document.getElementById('new-task-input');
    input.onkeypress = (e) => {
        if (e.key === 'Enter' && input.value.trim()) {
            const div = document.createElement('div');
            div.className = 'task-item';
            div.innerHTML = `<input type="checkbox"> <span>${input.value}</span>`;
            document.getElementById('task-list').prepend(div);
            input.value = '';
        }
    };
}

function changeMonth(d) { currentViewDate.setMonth(currentViewDate.getMonth() + d); renderMonth(); }
function changeYear(d) { currentViewDate.setFullYear(currentViewDate.getFullYear() + d); showYearPicker(); }
function goToday() { currentViewDate = new Date(); renderMonth(); }
function toggleSettings() {
    document.getElementById('settings-menu').classList.toggle('hidden');
}

function changeAccent(color) {
    // Меняем переменную CSS в реальном времени
    document.documentElement.style.setProperty('--accent', color);
    // Сохраняем выбор, чтобы он не пропал при перезагрузке
    localStorage.setItem('user-accent', color);
}

// При загрузке страницы проверяем, был ли сохранен цвет
window.onload = () => {
    const savedColor = localStorage.getItem('user-accent');
    if (savedColor) {
        document.documentElement.style.setProperty('--accent', savedColor);
    }
}

window.onpopstate = () => { closeDayDetail(); hideYearPicker(); };

init();
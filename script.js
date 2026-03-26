let tg = window.Telegram.WebApp;
tg.expand();

let currentDate = new Date();

function renderCalendar() {
    const grid = document.getElementById('daysGrid');
    const monthYear = document.getElementById('monthDisplay');
    grid.innerHTML = '';

    monthYear.innerText = currentDate.toLocaleString('ru', { month: 'long', year: 'numeric' });

    // Логика отрисовки дней (упрощенно для примера)
    for (let i = 1; i <= 31; i++) {
        let dayDiv = document.createElement('div');
        dayDiv.className = 'day';
        dayDiv.innerText = i;
        dayDiv.onclick = () => openDay(i);
        grid.appendChild(dayDiv);
    }
}

function openDay(day) {
    document.getElementById('dayView').classList.remove('hidden');
    document.getElementById('selectedDateText').innerText = day + " " + currentDate.toLocaleString('ru', { month: 'long' });

    const schedule = document.getElementById('hourlySchedule');
    schedule.innerHTML = '';
    for (let h = 0; h < 24; h++) {
        schedule.innerHTML += `
            <div class="hour-row">
                <div class="hour-time">${h}:00</div>
                <input type="text" class="task-input" placeholder="Заметка или таск...">
            </div>`;
    }
}

function closeDay() {
    document.getElementById('dayView').classList.add('hidden');
}

document.getElementById('prevMonth').onclick = () => { currentDate.setMonth(currentDate.getMonth() - 1); renderCalendar(); };
document.getElementById('nextMonth').onclick = () => { currentDate.setMonth(currentDate.getMonth() + 1); renderCalendar(); };

renderCalendar();
// Функция переключения между календарем и выбором месяца
document.getElementById('monthDisplay').onclick = () => {
    const yearView = document.getElementById('yearView');
    const daysGrid = document.getElementById('daysGrid');
    const weekGrid = document.querySelector('.weekdays-grid');

    yearView.classList.toggle('hidden');
    daysGrid.classList.toggle('hidden');
    weekGrid.classList.toggle('hidden');
};

function selectMonth(m) {
    currentDate.setMonth(m);
    // Скрываем сетку месяцев и показываем дни
    document.getElementById('yearView').classList.add('hidden');
    document.getElementById('daysGrid').classList.remove('hidden');
    document.querySelector('.weekdays-grid').classList.remove('hidden');
    renderCalendar();
}
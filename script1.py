import telebot
from telebot import types
import threading #многозадачность
import time
from datetime import datetime
from db_functions import (
    register_user, save_initial_task, update_reminder_time,
    get_tasks_to_notify, mark_as_done
)

bot = telebot.TeleBot('8702280476:AAFUnL-y3aL7Qx3BRMYI1JFxdAZQOQBd4BE')
user_drafts = {}

# --- БУДИЛЬНИК ---
def check_reminders():
    while True:
        try:
            now = datetime.now().strftime('%Y-%m-%d %H:%M')
            tasks = get_tasks_to_notify(now)
            for task in tasks:
                t_id, u_id, text = task
                bot.send_message(u_id, f"⏰ Напоминание:\n{text}")
                mark_as_done(t_id)
        except Exception as e:
            print(f"Ошибка будильника: {e}")
        time.sleep(30)

threading.Thread(target=check_reminders, daemon=True).start() #Твоя работа — крутить этот бесконечный цикл с будильником

welcome_text = (
    "👋 Привет! Я твой личный помощник Flow 🌊\n\n"
    "Я помогу тебе не забыть о важных делах. 🔔\n\n"
    "Как мне к тебе обращаться?"
)

@bot.message_handler(commands=['start'])
def start_command(message):
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True, one_time_keyboard=True)
    markup.add('По нику из ТГ', 'Хочу ввести свое имя')
    msg = bot.send_message(message.chat.id, welcome_text, reply_markup=markup)
    bot.register_next_step_handler(msg, check_choice)

def check_choice(message):
    if message.text == 'По нику из ТГ':
        user_id = message.from_user.id
        username = message.from_user.username or "Приятель"
        register_user(user_id, username)
        bot.send_message(message.chat.id, f"Принято! Теперь просто пиши задачи, например: 'завтра в 15:00 чай'", reply_markup=types.ReplyKeyboardRemove())
    elif message.text == 'Хочу ввести свое имя':
        msg = bot.send_message(message.chat.id, "Напиши своё имя:")
        bot.register_next_step_handler(msg, save_custom_name)
    else:
        # Если юзер написал фигню вместо нажатия кнопки
        start_command(message)

def save_custom_name(message):
    register_user(message.from_user.id, message.text)
    bot.send_message(message.chat.id, f"Приятно познакомиться, {message.text}! Жду твои задачи.", reply_markup=types.ReplyKeyboardRemove())

# ---  КНОПКИ ВРЕМЕНИ ---
@bot.callback_query_handler(func=lambda call: call.data.startswith('min_'))
def handle_callback(call):
    user_id = call.from_user.id
    if user_id not in user_drafts:
        bot.answer_callback_query(call.id, "Ошибка: задача не найдена. Напиши её еще раз.")
        return

    if call.data == "min_custom":
        msg = bot.send_message(call.message.chat.id, "Напиши числом, за сколько минут напомнить (например, 15):")
        bot.register_next_step_handler(msg, save_custom_reminder_minutes)
    else:
        minutes = int(call.data.split('_')[1])
        finish_task_setting(call.message, user_id, minutes)

def save_custom_reminder_minutes(message):
    user_id = message.from_user.id
    try:
        minutes = int(message.text)
        finish_task_setting(message, user_id, minutes)
    except ValueError:
        msg = bot.send_message(message.chat.id, "Пожалуйста, введи только число (например: 20)")
        bot.register_next_step_handler(msg, save_custom_reminder_minutes)

def finish_task_setting(message, user_id, minutes):
    draft = user_drafts[user_id]
    # Вызываем твою функцию из db_functions
    final_time = update_reminder_time(draft["id"], draft["time"], minutes)
    bot.send_message(message.chat.id, f"✅ Договорились! Напомню в {final_time}")
    if user_id in user_drafts:
        del user_drafts[user_id]

# --- ОБРАБОТЧИК ТЕКСТА ---
@bot.message_handler(content_types=['text'])
def handle_text(message):
    # ПРЕДОХРАНИТЕЛЬ: если мы в процессе регистрации, handle_text не должен мешать
    if message.text in ['По нику из ТГ', 'Хочу ввести свое имя']:
        # Если вдруг register_next_step_handler отвалился, вызываем check_choice вручную
        check_choice(message)
        return

    # Стандартная логика поиска времени
    result = save_initial_task(message.from_user.id, message.text)

    if result:
        # ВАЖНО: на твоем скрине db.py видно, что функция возвращает (id, время, текст)
        task_id, event_time, _ = result
        user_drafts[message.from_user.id] = {"id": task_id, "time": event_time}

        markup = types.InlineKeyboardMarkup()
        markup.add(
            types.InlineKeyboardButton("5 мин", callback_data="min_5"),
            types.InlineKeyboardButton("10 мин", callback_data="min_10"),
            types.InlineKeyboardButton("Своё время 💬", callback_data="min_custom")
        )

        bot.send_message(message.chat.id,
                         f"Запланировано на {event_time.strftime('%H:%M')}.\nЗа сколько минут до этого напомнить?",
                         reply_markup=markup)
    else:
        bot.send_message(message.chat.id, "Я не нашел время в сообщении. Напиши, например: 'в 15:00 купить пиццу'")

        # Настройка постоянной кнопки меню слева от ввода сообщения
        def set_main_menu(bot):
            web_info = types.WebAppInfo("https://ilonabaulina.github.io/tgbot/")
            # Устанавливаем специальную кнопку Mini App в интерфейс бота
            bot.set_chat_menu_button(
                menu_button=types.MenuButtonWebApp(
                    type="web_app",
                    text="🗓 Календарь",
                    web_app=web_info
                )
            )

        # Вызываем настройку меню
        set_main_menu(bot)
# --- ЗАПУСК ---
if __name__ == '__main__':
    print("--- БОТ ЗАПУЩЕН И ГОТОВ К РАБОТЕ ---")
    bot.polling(none_stop=True)

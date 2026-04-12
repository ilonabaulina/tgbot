import telebot
from telebot import types
import speech_recognition as sr
from pydub import AudioSegment
import os
import json  # ОБЯЗАТЕЛЬНО для работы с Mini App
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from db_functions import *

# --- НАСТРОЙКИ ПУТЕЙ ---
current_dir = os.path.dirname(os.path.abspath(__file__))
AudioSegment.converter = os.path.join(current_dir, "ffmpeg.exe")
AudioSegment.ffprobe = os.path.join(current_dir, "ffprobe.exe")

bot = telebot.TeleBot('8702280476:AAFUnL-y3aL7Qx3BRMYI1JFxdAZQOQBd4BE')
user_drafts = {}


# ==========================================
# 1. КОМАНДЫ
# ==========================================

@bot.message_handler(commands=['start'])
def start_command(message):
    register_user(message.from_user.id, message.from_user.username)

    markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
    # ЗАМЕНИ ССЫЛКУ НИЖЕ на свою ссылку от GitHub Pages
    web_ui = types.WebAppInfo("https://твой-адрес.github.io/")

    markup.add(types.KeyboardButton("Открыть Flow 🌊", web_app=web_ui))

    bot.send_message(
        message.chat.id,
        f"Привет, {message.from_user.first_name}! 🌊\nЯ помогу тебе с расписанием и напомню о важных делах.",
        reply_markup=markup
    )


@bot.message_handler(commands=['setup'])
def setup_command(message):
    msg = bot.send_message(message.chat.id, "Введи номер своей группы БГУИР (например, 568402):")
    bot.register_next_step_handler(msg, process_group_sync)


@bot.message_handler(commands=['status'])
def status_menu(message):
    markup = types.InlineKeyboardMarkup()
    markup.add(types.InlineKeyboardButton("🤒 Я на больничном", callback_data="status_sick"))
    markup.add(types.InlineKeyboardButton("✅ Я в строю", callback_data="status_active"))
    bot.send_message(message.chat.id, "Твой режим уведомлений:", reply_markup=markup)


# ==========================================
# 2. ФОНОВЫЙ БУДИЛЬНИК
# ==========================================

def check_reminders_task():
    try:
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
        tasks = get_tasks_to_notify(now_str)
        for t_id, u_id, text in tasks:
            try:
                bot.send_message(u_id, f"⏰ **Напоминание:**\n{text}", parse_mode="Markdown")
                mark_as_done(t_id)
            except telebot.apihelper.ApiTelegramException as e:
                # Если пользователь удалил чат с ботом (ошибка 403)
                print(f"Не удалось отправить юзеру {u_id}: {e}")
                if e.error_code == 403:
                    mark_as_done(t_id) # Просто закрываем задачу
    except Exception as e:
        print(f"Критическая ошибка будильника: {e}")


# ==========================================
# 3. ОБРАБОТКА ИЗ MINI APP (Календарь)
# ==========================================

@bot.message_handler(content_types=['web_app_data'])
def handle_webapp_data(message):
    try:
        # Получаем данные из твоего исправленного script.js
        data = json.loads(message.web_app_data.data)
        task_text = data.get('text')
        task_date = data.get('date')  # YYYY-MM-DD
        user_id = message.from_user.id

        # Сохраняем (функцию добавь в db_functions, как мы обсуждали)
        if save_task_from_webapp(user_id, task_text, task_date):
            bot.send_message(message.chat.id, f"🌟 Напоминание «{task_text}» добавлено в календарь на {task_date}!")
        else:
            bot.send_message(message.chat.id, "❌ Ошибка сохранения.")

    except Exception as e:
        bot.send_message(message.chat.id, f"Ошибка Mini App: {e}")


# ==========================================
# 4. ОБРАБОТКА МЕДИА
# ==========================================

@bot.message_handler(content_types=['voice'])
def handle_voice(message):
    bot.send_chat_action(message.chat.id, 'typing')
    try:
        file_info = bot.get_file(message.voice.file_id)
        downloaded_file = bot.download_file(file_info.file_path)
        path_ogg = os.path.join(current_dir, "voice.ogg")
        path_wav = os.path.join(current_dir, "voice.wav")

        with open(path_ogg, "wb") as f:
            f.write(downloaded_file)

        audio = AudioSegment.from_ogg(path_ogg)
        audio.export(path_wav, format="wav")

        r = sr.Recognizer()
        with sr.AudioFile(path_wav) as source:
            audio_data = r.record(source)
            text = r.recognize_google(audio_data, language="ru-RU")
            message.text = text
            handle_text(message)
    except Exception as e:
        bot.send_message(message.chat.id, "Не удалось разобрать голос.")
    finally:
        if os.path.exists(path_ogg): os.remove(path_ogg)
        if os.path.exists(path_wav): os.remove(path_wav)


# ==========================================
# 5. ОБРАБОТКА ТЕКСТА
# ==========================================

@bot.message_handler(content_types=['text'])
def handle_text(message):
    user_id = message.from_user.id
    text = message.text

    greeting = "Привет! 😊 " if should_greet(user_id) else ""
    result = save_initial_task(user_id, text)

    if result:
        task_id, event_time, task_name = result
        user_drafts[user_id] = {"id": task_id, "time": event_time}

        markup = types.InlineKeyboardMarkup()
        markup.add(types.InlineKeyboardButton("⏰ В само время", callback_data="min_0"),
                   types.InlineKeyboardButton("5 мин", callback_data="min_5"),
                   types.InlineKeyboardButton("Своё", callback_data="min_custom"))

        bot.send_message(
            message.chat.id,
            f"{greeting}Записал: **{task_name}**\nНа {event_time.strftime('%H:%M')}\n\nНапомню за 15 минут. Нужно поменять?",
            reply_markup=markup, parse_mode="Markdown"
        )
    elif greeting:
        bot.send_message(message.chat.id,
                         f"{greeting}Что записываем? (Напиши задачу и время, например: сдать лабу 14:00)")


# ==========================================
# 6. КОЛБЭКИ И ВСПОМОГАТЕЛЬНОЕ
# ==========================================

@bot.callback_query_handler(func=lambda call: True)
def handle_callbacks(call):
    user_id = call.from_user.id
    if call.data.startswith("status_"):
        new_status = call.data.split("_")[1]
        update_user_status(user_id, new_status)
        text = "Выздоравливай! 🤒" if new_status == "sick" else "В строю! ✅"
        bot.edit_message_text(text, call.message.chat.id, call.message.message_id)

    elif user_id in user_drafts:
        if call.data == "min_custom":
            msg = bot.send_message(call.message.chat.id, "За сколько минут напомнить? (Напиши только число)")
            bot.register_next_step_handler(msg, save_custom_minutes)
        elif call.data.startswith("min_"):
            minutes = int(call.data.split('_')[1])
            finish_setting(call.message, user_id, minutes)


def save_custom_minutes(message):
    try:
        minutes = int(message.text)
        finish_setting(message, message.from_user.id, minutes)
    except:
        bot.send_message(message.chat.id, "Введи число цифрами.")


def finish_setting(message, user_id, minutes):
    draft = user_drafts[user_id]
    final_time = update_reminder_time(draft["id"], draft["time"], minutes)
    time_only = final_time.split(' ')[1]
    bot.send_message(message.chat.id, f"✅ Ок! Напомню в {time_only}")
    if user_id in user_drafts: del user_drafts[user_id]


def process_group_sync(message):
    group = message.text
    sync_bsuir_schedule(message.from_user.id, group)
    bot.send_message(message.chat.id, "✅ Готово!")


if __name__ == '__main__':
    print("--- FLOW BOT ЗАПУЩЕН ---")
    bot.polling(none_stop=True)
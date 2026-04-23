import telebot
import threading
from telebot import types
import speech_recognition as sr
from pydub import AudioSegment
import os
import json
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from db_functions import *

current_dir = os.path.dirname(os.path.abspath(__file__))
AudioSegment.converter = os.path.join(current_dir, "ffmpeg.exe")
AudioSegment.ffprobe = os.path.join(current_dir, "ffprobe.exe")

bot = telebot.TeleBot('8702280476:AAFUnL-y3aL7Qx3BRMYI1JFxdAZQOQBd4BE')
user_drafts = {}
user_timers = {}
user_task_cache = {}


@bot.message_handler(commands=['start'])
def start_command(message):
    register_user(message.from_user.id, message.from_user.username)
    markup = types.ReplyKeyboardMarkup(resize_keyboard=True)
    web_ui = types.WebAppInfo("https://ilonabaulina.github.io/tgbot/")
    markup.add(types.KeyboardButton("Открыть Flow 🌊", web_app=web_ui))
    bot.send_message(message.chat.id, f"Привет, {message.from_user.first_name}! 🌊\nЯ помогу тебе с расписанием и напомню о важных делах.", reply_markup=markup)


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


def check_reminders_task():
    try:
        now_str = datetime.now().strftime('%Y-%m-%d %H:%M')
        tasks = get_tasks_to_notify(now_str)
        for t_id, u_id, text in tasks:
            try:
                bot.send_message(u_id, f"⏰ **Напоминание:**\n{text}", parse_mode="Markdown")
                mark_as_done(t_id)
            except:
                mark_as_done(t_id)
    except Exception as e:
        print(f"Ошибка: {e}")


@bot.message_handler(content_types=['web_app_data'])
def handle_webapp_data(message):
    try:
        data = json.loads(message.web_app_data.data)
        task_text = data.get('text')
        task_date = data.get('date')
        task_time = data.get('time', '09:00')
        category_id = data.get('category_id')
        user_id = message.from_user.id

        task_id = save_task_from_webapp(user_id, task_text, task_date, task_time, category_id)
        if task_id:
            cat_name = ""
            if category_id:
                categories = get_user_categories(user_id)
                for cat in categories:
                    if str(cat[0]) == str(category_id):
                        cat_name = f"\n🏁 Категория: {cat[1]}"
                        break
            bot.send_message(message.chat.id, f"🌟 Задача «{task_text}» добавлена в календарь!\n📅 {task_date}\n🕐 {task_time}{cat_name}")
        else:
            bot.send_message(message.chat.id, "❌ Ошибка сохранения.")
    except Exception as e:
        bot.send_message(message.chat.id, f"Ошибка: {e}")


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
    except:
        bot.send_message(message.chat.id, "Не удалось разобрать голос.")
    finally:
        if os.path.exists(path_ogg): os.remove(path_ogg)
        if os.path.exists(path_wav): os.remove(path_wav)


@bot.message_handler(content_types=['text'])
def handle_text(message):
    user_id = message.from_user.id
    text = message.text
    greeting = "Привет! 😊 " if should_greet(user_id) else ""
    result = save_initial_task(user_id, text)

    if result:
        task_id, event_time, task_name = result
        user_drafts[user_id] = {"id": task_id, "time": event_time}
        user_task_cache[user_id] = {'task_id': task_id, 'task_text': task_name, 'task_time': event_time, 'step': 'waiting_for_minutes'}

        markup = types.InlineKeyboardMarkup(row_width=2)
        markup.add(
            types.InlineKeyboardButton("5 мин", callback_data="min_5"),
            types.InlineKeyboardButton("15 мин ✓", callback_data="min_15"),
            types.InlineKeyboardButton("30 мин", callback_data="min_30"),
            types.InlineKeyboardButton("⚡ Своё", callback_data="min_custom")
        )

        bot.send_message(message.chat.id, f"{greeting}📝 **{task_name}**\n🕐 На {event_time.strftime('%H:%M')}\n\n⏰ Когда напомнить? (15 мин по умолчанию)\n_Если не выберешь, установлю автоматически через 30 сек_", reply_markup=markup, parse_mode="Markdown")
        set_default_reminder(user_id, task_id, event_time)
    elif greeting:
        bot.send_message(message.chat.id, f"{greeting}Что записываем? (Напиши задачу и время, например: купить молоко 15:30)")


def set_default_reminder(user_id, task_id, event_time):
    def default_action():
        if user_id in user_drafts:
            draft = user_drafts.get(user_id)
            if draft and draft.get('id') == task_id:
                final_time = update_reminder_time(task_id, event_time, 15)
                time_only = final_time.split(' ')[1] if ' ' in final_time else final_time
                bot.send_message(user_id, f"⏰ Напоминание установлено на {time_only} (по умолчанию 15 минут)\n\n🏁 Теперь выбери категорию для задачи:", parse_mode="Markdown")
                ask_category_direct(user_id, task_id, 15)
                if user_id in user_timers: del user_timers[user_id]
                if user_id in user_drafts: del user_drafts[user_id]
    timer = threading.Timer(30.0, default_action)
    user_timers[user_id] = timer
    timer.start()


def ask_category_direct(user_id, task_id, minutes):
    categories = get_user_categories(user_id)
    markup = types.InlineKeyboardMarkup(row_width=2)
    for cat in categories:
        cat_id, cat_name, cat_color = cat
        markup.add(types.InlineKeyboardButton(f"🏁 {cat_name}", callback_data=f"cat_{cat_id}_{task_id}"))
    markup.add(types.InlineKeyboardButton("⏭️ Без категории", callback_data=f"cat_skip_{task_id}"))
    bot.send_message(user_id, f"🏁 **Выбери категорию** для задачи (или пропусти):", reply_markup=markup, parse_mode="Markdown")


def ask_category(message, user_id, task_id, minutes):
    categories = get_user_categories(user_id)
    markup = types.InlineKeyboardMarkup(row_width=2)
    for cat in categories:
        cat_id, cat_name, cat_color = cat
        markup.add(types.InlineKeyboardButton(f"📁 {cat_name}", callback_data=f"cat_{cat_id}_{task_id}"))
    markup.add(types.InlineKeyboardButton("⏭️ Пропустить", callback_data=f"cat_skip_{task_id}"))
    bot.send_message(message.chat.id, f"🏷️ Выбери категорию для задачи (или пропусти):", reply_markup=markup)


@bot.callback_query_handler(func=lambda call: True)
def handle_callbacks(call):
    user_id = call.from_user.id
    if user_id in user_timers:
        user_timers[user_id].cancel()
        del user_timers[user_id]

    if call.data.startswith("status_"):
        new_status = call.data.split("_")[1]
        update_user_status(user_id, new_status)
        text = "Выздоравливай! 🤒" if new_status == "sick" else "В строю! ✅"
        bot.edit_message_text(text, call.message.chat.id, call.message.message_id)
        return

    if user_id in user_drafts and call.data.startswith("min_"):
        if call.data == "min_custom":
            msg = bot.send_message(call.message.chat.id, "✏️ За сколько минут напомнить? (Введи число):")
            bot.register_next_step_handler(msg, save_custom_minutes)
        else:
            minutes = int(call.data.split('_')[1])
            draft = user_drafts[user_id]
            final_time = update_reminder_time(draft["id"], draft["time"], minutes)
            time_only = final_time.split(' ')[1] if ' ' in final_time else final_time
            bot.send_message(call.message.chat.id, f"✅ Напомню в {time_only}")
            ask_category(call.message, user_id, draft["id"], minutes)
            if user_id in user_drafts: del user_drafts[user_id]
        return

    if call.data.startswith("cat_"):
        parts = call.data.split("_")
        if parts[1] == "skip":
            task_id = int(parts[2])
            bot.edit_message_text("✅ Задача сохранена без категории!\n\nМожешь посмотреть её в календаре 🌊", call.message.chat.id, call.message.message_id)
        else:
            category_id = parts[1]
            task_id = int(parts[2])
            update_task_category(task_id, category_id)
            categories = get_user_categories(user_id)
            cat_name = next((c[1] for c in categories if str(c[0]) == category_id), "категория")
            bot.edit_message_text(f"✅ Задача сохранена!\n🏁 Категория: {cat_name}\n\nВ календаре задача будет отмечена цветом этой категории 🌊", call.message.chat.id, call.message.message_id)
        if user_id in user_task_cache: del user_task_cache[user_id]
        return


def save_custom_minutes(message):
    try:
        minutes = int(message.text)
        user_id = message.from_user.id
        if user_id in user_drafts:
            draft = user_drafts[user_id]
            final_time = update_reminder_time(draft["id"], draft["time"], minutes)
            ask_category(message, user_id, draft["id"], minutes)
            if user_id in user_drafts: del user_drafts[user_id]
        else:
            bot.send_message(message.chat.id, "Ошибка: задача не найдена")
    except:
        bot.send_message(message.chat.id, "Введи число цифрами.")


def process_group_sync(message):
    group = message.text
    sync_bsuir_schedule(message.from_user.id, group)
    bot.send_message(message.chat.id, "✅ Готово!")


if __name__ == '__main__':
    print("--- FLOW BOT ЗАПУЩЕН ---")
    scheduler = BackgroundScheduler()
    scheduler.add_job(check_reminders_task, 'interval', minutes=1)
    scheduler.start()
    bot.polling(none_stop=True)

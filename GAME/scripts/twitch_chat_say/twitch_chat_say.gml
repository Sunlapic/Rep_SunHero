/// =============================================
/// @function twitch_chat_say(text)
/// @description ✅ FIX: Кладёт сообщение в очередь вместо прямой отправки.
/// Реальная отправка происходит в scr_irc_flush() (Step Event).
/// =============================================
function twitch_chat_say(argument0)
{
    // Убираем переносы строк из текста (они ломают IRC-протокол)
    argument0 = string_replace_all(argument0, chr(13), "");
    argument0 = string_replace_all(argument0, chr(10), "");

    // Проверки
    if (global.IRC_socket == -1 || global.IRC_channel == "" || string(argument0) == "")
    {
        twitch_log("Message sending failed — no connection or empty text");
        return -1;
    }

    // ✅ FIX: Не отправляем напрямую — кладём в очередь!
    // Это предотвращает rate limit (20 сообщений / 30 секунд)
    var _full = "PRIVMSG " + string(global.IRC_channel) + " :" + string(argument0);
    ds_queue_enqueue(global.irc_send_queue, _full);

    show_debug_message("📥 QUEUED> " + _full);

    // Добавляем в список чата для отображения в UI
    ds_list_add(global.Chat_list,
        string(global.IRC_name) + ": " + string(argument0));
}

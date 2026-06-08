/// =============================================
/// @function scr_irc_flush()
/// @description ✅ НОВЫЙ СКРИПТ: Отправляет одно сообщение из очереди
/// с соблюдением rate limit. Вызывать каждый кадр из Step Event.
/// =============================================
function scr_irc_flush()
{
    // Если очередь пуста — выходим
    if (ds_queue_empty(global.irc_send_queue)) return;

    // Если сокет невалиден — не отправляем
    if (global.IRC_socket < 0 || !global.irc_ready) return;

    // ✅ FIX: Проверяем интервал между отправками
    var _now = current_time;
    if (_now - global.irc_last_send_time < global.irc_send_interval) return;

    // Достаём одно сообщение из очереди
    var _text = ds_queue_dequeue(global.irc_send_queue);
    var _raw = _text + chr(13) + chr(10);

    // Создаём буфер и записываем (buffer_text, БЕЗ \0)
    var _len = string_byte_length(_raw);
    var _buf = buffer_create(_len + 1, buffer_grow, 1);
    buffer_write(_buf, buffer_text, _raw);

    var _send_size = buffer_tell(_buf);
    var _result = network_send_raw(global.IRC_socket, _buf, _send_size);
    buffer_delete(_buf);

    // Логируем
    var _dbg = string_replace_all(_text, chr(13), "<CR>");
    _dbg = string_replace_all(_dbg, chr(10), "<LF>");
    show_debug_message("📤 SENT> " + _dbg + " | result=" + string(_result));

    if (_result < 0)
    {
        // Отправка не удалась — реконнект
        twitch_log("⚠ Send failed, result = " + string(_result));
        global.irc_ready = false;

        if (global.IRC_socket >= 0)
        {
            network_destroy(global.IRC_socket);
            global.IRC_socket = -1;
        }

        // ✅ FIX: Возвращаем сообщение обратно в очередь (оно не потеряется)
        // К сожалению ds_queue не имеет push_front, поэтому создаём новую
        // очередь с этим элементом + старые
        var _new_q = ds_queue_create();
        ds_queue_enqueue(_new_q, _text);
        while (!ds_queue_empty(global.irc_send_queue))
        {
            ds_queue_enqueue(_new_q, ds_queue_dequeue(global.irc_send_queue));
        }
        ds_queue_destroy(global.irc_send_queue);
        global.irc_send_queue = _new_q;

        // Устанавливаем задержку реконнекта
        global.irc_reconnect_cd = current_time + 3000;
    }
    else
    {
        // Успешно — обновляем таймер
        global.irc_last_send_time = _now;
        twitch_log("Chat message sent!");
    }
}
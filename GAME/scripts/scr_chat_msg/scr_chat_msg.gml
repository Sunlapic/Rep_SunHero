function scr_chat_msg(_pl, _msg) {
    // ── Пишем сообщение в лог GameMaker ──
    show_debug_message(
    "scr_chat_msg CALLED >>> " + string(_msg)
);
	show_debug_message(string(_msg));

    // ── Проверяем, существует ли глобальный список чата ──
    if (variable_global_exists("Chat_list")) {
        // ── Если списка нет, создаём его заново ──
        if (!ds_exists(global.Chat_list, ds_type_list))
            global.Chat_list = ds_list_create(); // Создаём список, если его нет
        // ── Добавляем сообщение в начало списка чата ──
        ds_list_insert(global.Chat_list, 0, "SYSTEM: " + string(_msg));
    }

    // ── Логируем, что мы отправляем в Twitch ──
    show_debug_message("Отправка в Twitch: @" + _pl.username + " " + string(_msg));

    // ── Если игрок существует ──
    if (instance_exists(_pl)) {
        // ── Отправляем сообщение в Twitch-канал ──
        twitch_chat_say("@" + _pl.username + " " + string(_msg));
    }
}

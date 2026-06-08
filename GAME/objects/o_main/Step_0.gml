/// =============================================
/// o_main — Step Event
/// =============================================

// =============================================
// 1. ПРИВЕТСТВЕННОЕ СООБЩЕНИЕ (одноразово)
// =============================================
if (global.irc_ready && !sent_welcome)
{
    twitch_chat_say("SunHero v1");
    sent_welcome = true;
    show_debug_message("👋 Welcome message sent!");
}

// =============================================
// 2. ✅ FIX: ОТПРАВКА ОЧЕРЕДИ СООБЩЕНИЙ (RATE LIMIT)
// =============================================
// Каждый кадр пробуем отправить одно сообщение из очереди
// scr_irc_flush сам проверяет интервал (1.6 сек между отправками)
scr_irc_flush();

// =============================================
// 3. KEEPALIVE (каждые 90 секунд)
// =============================================
if (global.irc_ready && global.IRC_socket >= 0)
{
    if (current_time - global.last_irc_activity > 90000)
    {
        // ✅ FIX: Используем buffer_text вместо buffer_string!
        var _ping_str = "PING :tmi.twitch.tv" + chr(13) + chr(10);
        var _ping = buffer_create(string_byte_length(_ping_str) + 1, buffer_grow, 1);
        buffer_write(_ping, buffer_text, _ping_str);
        network_send_raw(global.IRC_socket, _ping, buffer_tell(_ping));
        buffer_delete(_ping);

        global.last_irc_activity = current_time;
        show_debug_message("🏓 KEEPALIVE PING sent");
    }
}

// =============================================
// 4. ✅ FIX: АВТО-РЕКОННЕКТ (таймер в мс через current_time)
// =============================================
if (!global.irc_ready && global.IRC_socket < 0)
{
    // Ждём, пока current_time превысит заданную задержку
    if (current_time >= global.irc_reconnect_cd)
    {
        show_debug_message("🔄 RECONNECT ATTEMPT...");
        twitch_chat_connect(global.IRC_channel_clean, global.IRC_name, global.IRC_oauth);

        // Следующая попытка — через 5 секунд, если не удастся
        global.irc_reconnect_cd = current_time + 5000;
    }
}

// =============================================
// 5. СПАВН ВРАГОВ
// =============================================
enemy_spawn_timer++;

if (enemy_spawn_timer >= 300)
{
    enemy_spawn_timer = 0;

    if (instance_number(o_enemy) < enemy_max)
    {
        var sx = irandom_range(50, room_width - 50);
        var sy = irandom_range(50, room_height - 50);
        instance_create_layer(sx, sy, "Instances", o_enemy);
    }
}
// =============================================
// 6. АВТОСОХРАНЕНИЕ ВСЕХ ИГРОКОВ
// =============================================
auto_save_timer++;
if (auto_save_timer >= auto_save_interval)
{
    auto_save_timer = 0;
    
    // Проходимся по всем игрокам в словаре и сохраняем их
    var _key = ds_map_find_first(global.players);
    var _saved_count = 0;
    
    while (!is_undefined(_key))
    {
        var _pl = global.players[? _key];
        if (instance_exists(_pl))
        {
            scr_api_update(_pl);
            _saved_count++;
        }
        _key = ds_map_find_next(global.players, _key);
    }
    
    if (_saved_count > 0) {
        show_debug_message("💾 АВТОСОХРАНЕНИЕ: Сохранено игроков - " + string(_saved_count));
    }
}
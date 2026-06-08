/// =============================================
/// @function twitch_chat_async()
/// @description Обработка всех событий от Twitch IRC
/// Вызывается из Async - Networking Event
/// =============================================
function twitch_chat_async()
{
    // =============================================
    // 1. ПОЛУЧАЕМ ТИП СОБЫТИЯ
    // =============================================
    var _type = async_load[? "type"];
    global.last_irc_activity = current_time;

    // =============================================
    // 2. ОБРАБОТКА ПОДКЛЮЧЕНИЯ
    // =============================================
    if (_type == network_type_connect)
    {
        global.irc_ready = true;
        global.last_irc_activity = current_time;
        show_debug_message("✅ IRC CONNECTED!");
        return;
    }

    // =============================================
    // 3. ОБРАБОТКА ОТКЛЮЧЕНИЯ
    // =============================================
    if (_type == network_type_disconnect)
    {
        global.irc_ready = false;
        show_debug_message("❌ IRC DISCONNECTED!");

        if (global.IRC_socket >= 0)
        {
            network_destroy(global.IRC_socket);
        }
        global.IRC_socket = -1;

        // ✅ FIX: Задержка реконнекта — в миллисекундах (current_time)
        global.irc_reconnect_cd = current_time + 3000;
        return;
    }

    // =============================================
    // 4. ПРОВЕРЯЕМ НАЛИЧИЕ БУФЕРА
    // =============================================
    if (!ds_map_exists(async_load, "buffer")) return;

    var net_buff = async_load[? "buffer"];
    if (net_buff == undefined) return;

    var _size = buffer_get_size(net_buff);
    if (_size <= 0) return;

    // =============================================
    // 5. ✅ FIX: ЧИТАЕМ БАЙТЫ И ДОБАВЛЯЕМ В НАКОПИТЕЛЬ
    // =============================================
    // НЕ используем buffer_read(buffer_text) — он может обрезать/потерять \r\n.
    // Читаем побайтово и склеиваем в строку.
    buffer_seek(net_buff, buffer_seek_start, 0);
    var _raw = "";
    for (var _b = 0; _b < _size; _b++)
    {
        _raw += chr(buffer_read(net_buff, buffer_u8));
    }

    // Добавляем к накопителю (в нём может быть хвост от прошлого пакета)
    global.irc_recv_buffer += _raw;

    // =============================================
    // 6. ✅ FIX: РАЗБИРАЕМ ВСЕ ПОЛНЫЕ СТРОКИ ПО \r\n
    // =============================================
    // В одном TCP-пакете может быть 0, 1, 5, 10 IRC-строк.
    // Обрабатываем все полные (заканчивающиеся на \r\n),
    // а хвост оставляем в буфере до следующего пакета.
    while (true)
    {
        var _crlf = string_pos(chr(13) + chr(10), global.irc_recv_buffer);
        if (_crlf == 0) break; // нет полной строки — ждём

        // Вырезаем одну строку (без \r\n)
        var _line = string_copy(global.irc_recv_buffer, 1, _crlf - 1);

        // Удаляем эту строку + \r\n из буфера
        global.irc_recv_buffer = string_delete(global.irc_recv_buffer, 1, _crlf + 1);

        // Пропускаем пустые строки
        if (string_length(_line) == 0) continue;

        // Логируем
        show_debug_message("IRC> " + _line);

        // =============================================
        // 6.1. PING — отвечаем PONG немедленно
        // =============================================
        if (string_pos("PING", _line) == 1)
        {
            var _ping_payload = string_delete(_line, 1, 4);
            var _pong_str = "PONG" + _ping_payload + chr(13) + chr(10);

            var _pong_buf = buffer_create(string_byte_length(_pong_str) + 1, buffer_grow, 1);
            buffer_write(_pong_buf, buffer_text, _pong_str);
            network_send_raw(global.IRC_socket, _pong_buf, buffer_tell(_pong_buf));
            buffer_delete(_pong_buf);

            show_debug_message("🏓 PONG SENT: PONG" + _ping_payload);
            continue;
        }

        // =============================================
        // 6.2. RECONNECT (Twitch просит переподключиться)
        // =============================================
        if (string_pos("RECONNECT", _line) != 0)
        {
            show_debug_message("⚠️ TWITCH REQUESTED RECONNECT");
            if (global.IRC_socket >= 0)
            {
                network_destroy(global.IRC_socket);
                global.IRC_socket = -1;
            }
            global.irc_ready = false;
            global.irc_reconnect_cd = current_time + 2000;
            continue;
        }

        // =============================================
        // 6.2.5. УСПЕШНАЯ АВТОРИЗАЦИЯ (001)
        // =============================================
        // Raw-сокеты в GM не всегда вызывают network_type_connect,
        // поэтому мы ставим irc_ready = true когда Twitch нас пустил
        if (string_pos(" 001 ", _line) > 0)
        {
            global.irc_ready = true;
            show_debug_message("✅ IRC AUTHENTICATED & READY!");
            continue;
        }
        // =============================================
        // 6.3. PRIVMSG — сообщения чата
        // =============================================
        if (string_pos("PRIVMSG", _line) != 0)
        {
            // --- Парсим имя ---
            var _exc = string_pos("!", _line);
            if (_exc <= 2) continue;
            var _name = string_copy(_line, 2, _exc - 2);

            // --- Парсим текст сообщения ---
            var _pm = string_pos("PRIVMSG", _line);
            var _after = string_copy(_line, _pm, string_length(_line));
            var _colon = string_pos(" :", _after);
            var _msg = "";
            if (_colon > 0)
            {
                _msg = string_copy(_after, _colon + 2, string_length(_after));
            }

            var _text = string_lower(string_trim(_msg));
            var _key = string_lower(_name);

            // --- !join ---
            if (_text == "!join")
            {
                if (!ds_map_exists(global.players, _key))
                {
                    var _pl = instance_create_layer(1300, 95, "Instances", o_player);
                    _pl.username = _name;
                    _pl.class = "warrior";
                    _pl.gold = 0;
                    _pl.hp = 100;
                    _pl.max_hp = 100;

                    scr_attr_init(_pl);
                    scr_recalc_stats(_pl);

                    global.players[? _key] = _pl;

                    scr_api_load(_pl);
                    scr_api_join(_pl);

                    twitch_chat_say("@" + _name + " joined!");
                    show_debug_message("✅ Player added: " + _name);
                }
                else
                {
                    show_debug_message("⚠️ Player already exists: " + _name);
                }
            }

            // --- !reclass ---
            var _trimmed = _text;
            if (string_pos("!reclass ", _trimmed) == 1)
            {
                var _args = string_trim(string_copy(_trimmed, 10,
                    string_length(_trimmed) - 9));
                if (ds_map_exists(global.players, _key))
                {
                    var _pl = global.players[? _key];
                    if (instance_exists(_pl))
                    {
                        if (_pl.gold >= 50)
                        {
                            _pl.gold -= 50;
                            scr_reclass(_pl, _args);
                            scr_api_update(_pl);
                        }
                        else
                        {
                            scr_chat_msg(_pl,
                                "Недостаточно золота. Нужно 50, у вас " + string(_pl.gold));
                        }
                    }
                }
            }
            // --- Раскидывание статов (!str, !agi, !int) ---
            if (string_pos("!str", _trimmed) == 1 || string_pos("!agi", _trimmed) == 1 || string_pos("!int", _trimmed) == 1)
            {
                if (ds_map_exists(global.players, _key))
                {
                    var _pl = global.players[? _key];
                    if (instance_exists(_pl))
                    {
                        // Определяем команду и количество
                        var _space_pos = string_pos(" ", _trimmed);
                        var _cmd = _trimmed;
                        var _amount = 1; // По умолчанию +1 очко
                        if (_space_pos > 0)
                        {
                            _cmd = string_copy(_trimmed, 1, _space_pos - 1);
                            // Извлекаем только цифры (на случай если напишут "!agi 10a")
                            var _val_str = string_digits(string_copy(_trimmed, _space_pos + 1, string_length(_trimmed)));
                            if (_val_str != "") _amount = real(_val_str);
                        }
                        // Проверяем доступные очки для текущего класса
                        var _curr_class = _pl.class;
                        var _avail_pts = _pl.class_attr_points[$ _curr_class];
                        if (is_undefined(_avail_pts)) _avail_pts = 0;
                        if (_amount > 0)
                        {
                            if (_avail_pts >= _amount)
                            {
                                // Списываем очки
                                _pl.class_attr_points[$ _curr_class] -= _amount;
                                var _stats = _pl.class_stats[$ _curr_class];
                                var _stat_name = "";
                                // Начисляем статы (обновляем и корень игрока, и структуру класса)
                                if (_cmd == "!str") { 
                                    _pl.strength += _amount; 
                                    _stats.strength += _amount;
                                    _stat_name = "Сила"; 
                                }
                                else if (_cmd == "!agi") { 
                                    _pl.agility += _amount; 
                                    _stats.agility += _amount;
                                    _stat_name = "Ловкость"; 
                                }
                                else if (_cmd == "!int") { 
                                    _pl.intellect += _amount; 
                                    _stats.intellect += _amount;
                                    _stat_name = "Интеллект"; 
                                }
                                // Пересчитываем HP/Урон и мгновенно сохраняем в БД
                                scr_recalc_stats(_pl);
                                scr_api_update(_pl);
                                // Сообщаем в чат об успехе
                                scr_chat_msg(_pl, _stat_name + " +" + string(_amount) + ". Осталось очков: " + string(_pl.class_attr_points[$ _curr_class]));
                            }
                            else
                            {
                                // Очков не хватает
                                scr_chat_msg(_pl, "Недостаточно очков (" + string(_curr_class) + ")! Доступно: " + string(_avail_pts));
                            }
                        }
                    }
                }
            }
			// =============================================
// === Команда входа в PvP-арену ===
// =============================================
if (_text == "!pvp")
{
    // Проверяем, что игрок существует в списке
    if (ds_map_exists(global.players, _key))
    {
        var _pl = global.players[? _key];
        if (instance_exists(_pl))
        {
            // Если уже в PvP — сообщаем и выходим
            if (_pl.in_pvp)
            {
                scr_chat_msg(_pl, "ты уже на арене!");
            }
            else
            {
                // Помечаем игрока как PvP-бойца
                _pl.in_pvp = true;
                
                // Восстанавливаем HP полностью при входе на арену
                _pl.hp = _pl.max_hp;
                
                // Сообщаем в чат
                scr_chat_msg(_pl, "вошёл на PvP-арену! Бой начался ⚔");
                
                // Сохраняем флаг в БД
                scr_api_update(_pl);
            }
        }
    }
}

// =============================================
// === Команда выхода из PvP ===
// =============================================
if (_text == "!pve")
{
    if (ds_map_exists(global.players, _key))
    {
        var _pl = global.players[? _key];
        if (instance_exists(_pl))
        {
            if (!_pl.in_pvp)
            {
                scr_chat_msg(_pl, "ты не в PvP, ты и так в безопасной зоне.");
            }
            else
            {
                _pl.in_pvp = false;
                _pl.hp = _pl.max_hp; // Лечим при выходе
                scr_chat_msg(_pl, "вышел из PvP в безопасную зону.");
                scr_api_update(_pl);
            }
        }
    }
}
        }
    }
}

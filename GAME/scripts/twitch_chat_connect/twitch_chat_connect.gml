/// =============================================
/// @function twitch_chat_connect(channel, username, oauth)
/// @description Подключение к Twitch IRC чату
/// @param channel    - Имя канала (БЕЗ #, например "Sunlapic")
/// @param username   - Имя бота (в нижнем регистре)
/// @param oauth      - OAuth токен (с префиксом "oauth:")
/// =============================================
function twitch_chat_connect(argument0, argument1, argument2)
{
    // =============================================
    // 1. СОХРАНЯЕМ ПАРАМЕТРЫ ДЛЯ RECONNECT
    // =============================================
    global.IRC_channel_clean = string(argument0);
    global.IRC_channel = "#" + string(argument0);
    global.IRC_name = argument1;

    // =============================================
    // 2. ГАРАНТИРУЕМ ПРЕФИКС "oauth:" В ТОКЕНЕ
    // =============================================
    if (string_length(argument2) > 0)
    {
        var _prefix = string_copy(argument2, 1, 6);
        if (_prefix != "oauth:")
        {
            argument2 = "oauth:" + argument2;
            show_debug_message("⚠️ Added missing oauth: prefix to token");
        }
    }
    global.IRC_oauth = argument2;

    // =============================================
    // 3. ИНИЦИАЛИЗАЦИЯ СПИСКА ЧАТА
    // =============================================
    if (variable_global_exists("Chat_list") && ds_exists(global.Chat_list, ds_type_list))
    {
        ds_list_clear(global.Chat_list);
    }
    else
    {
        global.Chat_list = ds_list_create();
    }

    // =============================================
    // 4. УНИЧТОЖАЕМ СТАРЫЙ СОКЕТ (ЕСЛИ ЕСТЬ)
    // =============================================
    if (variable_global_exists("IRC_socket") && global.IRC_socket >= 0)
    {
        network_destroy(global.IRC_socket);
        show_debug_message("🗑️ Destroyed old IRC socket");
    }

    // =============================================
    // 5. СОЗДАЁМ НОВЫЙ СОКЕТ
    // =============================================
    global.IRC_socket = -1;
    global.IRC_socket = network_create_socket(network_socket_tcp);

    if (global.IRC_socket < 0)
    {
        global.IRC_socket = -1;
        show_debug_message("❌ FAILED TO CREATE TCP SOCKET");
        return -1;
    }

    show_debug_message("✅ TCP Socket created");

    // =============================================
    // 6. ПОДКЛЮЧАЕМСЯ К СЕРВЕРУ
    // =============================================
    var success = network_connect_raw(global.IRC_socket, "irc.chat.twitch.tv", 6667);

    if (success < 0)
    {
        network_destroy(global.IRC_socket);
        global.IRC_socket = -1;
        show_debug_message("❌ FAILED TO CONNECT TO IRC SERVER");
        return -1;
    }

    show_debug_message("🔗 Connecting to irc.chat.twitch.tv...");

    // =============================================
    // 7. ОТПРАВЛЯЕМ PASS, NICK, JOIN
    // =============================================
    // ✅ FIX: Используем buffer_text вместо buffer_string!
    // buffer_string добавляет 2-байтный заголовок длины — это ломает IRC.
    var _commands = array_create(3);
    _commands[0] = "PASS " + global.IRC_oauth;
    _commands[1] = "NICK " + global.IRC_name;
    _commands[2] = "JOIN " + global.IRC_channel;

    for (var i = 0; i < 3; i++)
    {
        var send_str = _commands[i] + chr(13) + chr(10);
        var send_buff = buffer_create(string_byte_length(send_str) + 1, buffer_grow, 1);
        buffer_write(send_buff, buffer_text, send_str);
        network_send_raw(global.IRC_socket, send_buff, buffer_tell(send_buff));
        buffer_delete(send_buff);

        show_debug_message("📤 SENT: " + _commands[i]);
    }

    // =============================================
    // 8. СБРАСЫВАЕМ ФЛАГИ
    // =============================================
    global.irc_ready = false;
    global.last_irc_activity = current_time;

    // ✅ FIX: Очищаем буфер-накопитель при каждом подключении
    global.irc_recv_buffer = "";

    show_debug_message("⏳ Waiting for IRC connection...");
}

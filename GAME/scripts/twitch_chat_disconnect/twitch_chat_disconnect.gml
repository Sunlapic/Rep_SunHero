/// =============================================
/// @function twitch_chat_disconnect()
/// @description Отключение от Twitch IRC
/// =============================================
function twitch_chat_disconnect()
{
    global.irc_ready = false;

    if (global.IRC_socket > -1)
    {
        network_destroy(global.IRC_socket);
        global.IRC_socket = -1;
    }

    if (ds_exists(global.Chat_list, ds_type_list))
    {
        ds_list_destroy(global.Chat_list);
        global.Chat_list = -1;
    }

    // ✅ FIX: Очищаем буфер и очередь
    global.irc_recv_buffer = "";
    if (ds_exists(global.irc_send_queue, ds_type_queue))
    {
        ds_queue_clear(global.irc_send_queue);
    }

    if (global.Twitch_debuglog)
        twitch_log("TCP socket closed; disconnected from chat.");
}

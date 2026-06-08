/// @description  twitch_init(client ID);
/// @param client ID
function twitch_init(argument0) {

    // change these values depending on your program
    global.Update_autochck = false; // auto update stream info
    global.Update_interval = room_speed * 15; // auto update interval
    global.Twitch_debuglog = true; // debug logging
    global.Twitch_debugnum = "";
    global.Client_ID = argument0;

    // initialize Twitch API data
    global.Stream_list = ds_map_create();
    global.Update_list = ds_map_create();
    global.Thumb_list = ds_map_create();
    global.Chat_list = -1;

    // don't change these values
    global.IRC_socket = -1;
    global.IRC_channel = "";
    global.IRC_name    = "";
    global.IRC_oauth   = "";
    global.Update_timeleft = global.Update_interval;

    // =============================================
    // ✅ FIX: Буфер-накопитель для TCP-стрима
    // =============================================
    global.irc_recv_buffer = "";

    // =============================================
    // ✅ FIX: Очередь исходящих сообщений (rate limit)
    // =============================================
    global.irc_send_queue = ds_queue_create();
    global.irc_last_send_time = 0;  // current_time последней отправки
    global.irc_send_interval = 1600; // мс между отправками (20 msg / 30s ≈ 1500ms + запас)

    // numbered debug log, don't change this
    if (global.Twitch_debuglog)
    {
        var version = 0;
        while(file_exists(working_directory + "\\debug_log" + string(global.Twitch_debugnum) + ".ini"))
        {
            if (version > 0)
                global.Twitch_debugnum = "_" + string(version);
            version++;
        }
    }
}

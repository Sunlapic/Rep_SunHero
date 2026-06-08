/// scr_api_load(_pl)
// Загружает игрока с сервера по его username

function scr_api_load(_pl)
{
    if (!instance_exists(_pl)) return; // защита

    show_debug_message("LOAD REQUEST FOR: " + _pl.username); // лог

    http_request(
        "https://rep-sunhero.onrender.com/api/player/" + string(_pl.username),
        "GET",
        0,
        0
    );
}

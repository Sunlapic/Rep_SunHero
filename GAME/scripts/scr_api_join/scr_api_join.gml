/// scr_api_join(_pl)
/// Отправляет данные нового игрока на сервер MongoDB.
/// Никакой логики баланса тут больше нет! Только отправка.

function scr_api_join(_pl)
{
    if (!instance_exists(_pl)) return;

    // Формируем пакет данных (всё уже подготовлено в scr_attr_init)
    var data = {
        name: _pl.username,
        class_stats: _pl.class_stats,
        class_levels: _pl.class_levels,
        class_exp: _pl.class_exp,
        class_attr_points: _pl.class_attr_points
    };

    var headers = ds_map_create();
    headers[? "Content-Type"] = "application/json";

    http_request(
        "https://rep-sunhero.onrender.com/api/join",
        "POST",
        headers,
        json_stringify(data)
    );

    ds_map_destroy(headers);
}
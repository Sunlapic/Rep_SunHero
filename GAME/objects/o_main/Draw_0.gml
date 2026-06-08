/// Панель лидеров
/// global.players = ds_map, где:
/// key   = имя / ID игрока
/// value = instance игрока


// Получаем камеру первого вьюпорта.
var cam = view_camera[0];

// Координаты и размеры видимой области камеры.
var vx = camera_get_view_x(cam);
var vy = camera_get_view_y(cam);
var vw = camera_get_view_width(cam);
// var vh = camera_get_view_height(cam); // не используется


// Размеры панели.
var panel_w  = 300; /// Ширина панели
var padding  = 10;
var header_h = 26;
var row_h    = 18;
var footer_h = 0;

// Положение панели относительно камеры.
var _x = vx + vw - panel_w - 20;
var _y = vy + 20;


// Временный массив игроков.
var list = [];
var count = 0;


// Проверяем, существует ли global.players и является ли он ds_map.
if (variable_global_exists("players") && ds_exists(global.players, ds_type_map))
{
    var total_in_map = ds_map_size(global.players);

    if (total_in_map > 0)
    {
        var key = ds_map_find_first(global.players);

        repeat (total_in_map)
        {
            var pl = ds_map_find_value(global.players, key);

            if (instance_exists(pl))
            {
                list[count] =
                {
                    key   : string(key),
                    ref   : pl,
                    level : variable_instance_exists(pl, "level") ? pl.level : 0,
                    gold  : variable_instance_exists(pl, "gold")  ? pl.gold  : 0,
                    hp    : variable_instance_exists(pl, "hp")    ? pl.hp    : 0
                };

                count++;
            }

            key = ds_map_find_next(global.players, key);
        }
    }
}


// Сортировка массива игроков.
for (var i = 0; i < count - 1; i++)
{
    for (var j = i + 1; j < count; j++)
    {
        var swap = false;

        if (sort_mode == 0)
        {
            // Сортировка по уровню, при равенстве — по золоту.
            if (list[j].level > list[i].level) swap = true;
            else if (list[j].level == list[i].level && list[j].gold > list[i].gold) swap = true;
        }
        else
        {
            // Сортировка по золоту, при равенстве — по уровню.
            if (list[j].gold > list[i].gold) swap = true;
            else if (list[j].gold == list[i].gold && list[j].level > list[i].level) swap = true;
        }

        if (swap)
        {
            var tmp = list[i];
            list[i] = list[j];
            list[j] = tmp;
        }
    }
}


// Сколько строк реально показываем.
var visible_rows = min(count, max_rows);

// Если игроков больше, чем max_rows — добавляем футер.
if (count > max_rows) footer_h = 18;

// Высота панели.
var panel_h = header_h + 18 + (visible_rows * row_h) + padding + footer_h + 8;

// Подпись режима сортировки.
var sort_name = (sort_mode == 0) ? "LV" : "GOLD";


// ---------- РИСОВАНИЕ ----------

// Тень
draw_set_alpha(0.30);
draw_set_color(c_black);
draw_rectangle(_x + 4, _y + 4, _x + panel_w + 4, _y + panel_h + 4, false);

// Основная панель
draw_set_alpha(1);
draw_set_color(make_color_rgb(20, 22, 28));
draw_rectangle(_x, _y, _x + panel_w, _y + panel_h, false);

// Шапка
draw_set_color(make_color_rgb(40, 44, 56));
draw_rectangle(_x, _y, _x + panel_w, _y + header_h, false);

// Полоска под шапкой
draw_set_color(make_color_rgb(80, 180, 255));
draw_rectangle(_x, _y + header_h - 2, _x + panel_w, _y + header_h, false);


// Текст шапки
draw_set_color(c_white);
draw_set_halign(fa_left);
draw_text(_x + padding, _y + 6, "TOP");

draw_set_halign(fa_right);
draw_text(_x + panel_w - padding, _y + 6, "SORT: " + sort_name);


// Колонки
var col_rank = _x + 12;
var col_name = _x + 38;
var col_lv   = _x + 220;
var col_g    = _x + 255;
var col_hp   = _x + 290;

draw_set_color(make_color_rgb(180, 190, 210));

draw_set_halign(fa_left);
draw_text(col_rank, _y + header_h + 2, "#");
draw_text(col_name, _y + header_h + 2, "NAME");

draw_set_halign(fa_right);
draw_text(col_lv, _y + header_h + 2, "LV");
draw_text(col_g,  _y + header_h + 2, "G");
draw_text(col_hp, _y + header_h + 2, "HP");


// Если игроков нет
if (count <= 0)
{
    draw_set_halign(fa_left);
	draw_set_color(c_white);
    draw_text(_x + padding, _y + header_h + 24, "No players");
}
else
{
    for (var n = 0; n < visible_rows; n++)
    {
        var entry = list[n];
        var row_y = _y + header_h + 18 + n * row_h;

        // Фон строки
        if ((n mod 2) == 0)
            draw_set_color(make_color_rgb(28, 31, 40));
        else
            draw_set_color(make_color_rgb(24, 27, 35));

        draw_rectangle(_x + 6, row_y - 1, _x + panel_w - 6, row_y + row_h - 2, false);

        // Цвет текста
        if (n == 0) draw_set_color(make_color_rgb(255, 215, 80));
        else if (n == 1) draw_set_color(make_color_rgb(220, 220, 230));
        else if (n == 2) draw_set_color(make_color_rgb(205, 140, 90));
        else draw_set_color(c_white);

        // Ранг и имя
        draw_set_halign(fa_left);
        draw_text(col_rank, row_y, string(n + 1));
        draw_text(col_name, row_y, entry.key);

        // Числовые колонки
        draw_set_halign(fa_right);
        draw_text(col_lv, row_y, string(entry.level));
        draw_text(col_g,  row_y, string(entry.gold));
        draw_text(col_hp, row_y, string(entry.hp));
    }
}


// Футер
if (count > max_rows)
{
    draw_set_color(make_color_rgb(170, 180, 200));
    draw_set_halign(fa_left);
    draw_text(_x + padding, _y + panel_h - padding - 12, "+" + string(count - max_rows) + " ещё...");
}


// Возвращаем выравнивание по умолчанию
draw_set_halign(fa_left);
draw_set_alpha(1);
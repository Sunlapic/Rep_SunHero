function scr_big_arrow_step()
{
    if (has_hit) exit; // если стрела уже завершена — выходим

    var _px = x; // прошлая позиция X
    var _py = y; // прошлая позиция Y

    x += lengthdir_x(speed_arrow, image_angle); // двигаем стрелу по X
    y += lengthdir_y(speed_arrow, image_angle); // двигаем стрелу по Y
    distance_traveled += speed_arrow; // считаем пройденную дистанцию

    var _hits = ds_list_create(); // список врагов на линии полета
    var _count = collision_line_list(_px, _py, x, y, o_enemy, false, true, _hits, false); // ищем всех врагов на линии

    for (var i = 0; i < _count; i++)
    {
        var _e = _hits[| i]; // текущий враг из списка

        if (instance_exists(_e) && !_e.is_dead) // если враг существует и жив
        {
            if (ds_list_find_index(hit_list, _e) == -1) // если этого врага еще не били этой стрелой
            {
                _e.last_attacker = owner; // запоминаем владельца стрелы как последнего атакующего
                _e.hp = max(_e.hp - damage, 0); // наносим урон и не уходим в минус
                ds_list_add(hit_list, _e); // помечаем врага как уже задетого

                show_debug_message("BIG FIRE HIT! damage=" + string(damage) + " enemy hp=" + string(_e.hp)); // лог попадания
            }
        }
    }

    ds_list_destroy(_hits); // удаляем временный список

    if (distance_traveled >= range || x < -100 || x > room_width + 100 || y < -100 || y > room_height + 100) // если стрела улетела слишком далеко
    {
        instance_destroy(); // удаляем стрелу
    }
}
// ═══════════════════════════════════════════════════════════
// scr_combat — ОБЩИЕ БОЕВЫЕ ФУНКЦИИ (для игрока И стрелы)
// ═══════════════════════════════════════════════════════════

// ── АНТИ-ЗАСТРЕВАНИЕ В ЗЕМЛЕ ──────────────────────────────
// Выталкивает текущий instance вверх из земли и держит его в границах комнаты по X.
function scr_unstick_from_ground(_max_steps)
{
    if (place_meeting(x, y, o_par_ground)) // если объект оказался внутри земли
    {
        for (var _p = 0; _p < _max_steps && place_meeting(x, y, o_par_ground); _p++) // пробуем вытащить вверх
            y -= 1; // поднимаем на 1 пиксель
    }

    x = clamp(x, 16, room_width - 16); // не вылезаем за края комнаты
}
function scr_attr_refund_points_for_reclass(_pl)
{
    var _base_str = 5; // базовая сила
    var _base_agi = 5; // базовая ловкость
    var _base_int = 5; // базовый интеллект

    if (_pl.class == "warrior") // если воин
    {
        _base_str = 8; // базовая сила воина
        _base_agi = 4; // базовая ловкость воина
        _base_int = 3; // базовый интеллект воина
    }
    else if (_pl.class == "archer") // если лучник
    {
        _base_str = 4; // базовая сила лучника
        _base_agi = 8; // базовая ловкость лучника
        _base_int = 3; // базовый интеллект лучника
    }
    else if (_pl.class == "wizard") // если маг
    {
        _base_str = 3; // базовая сила мага
        _base_agi = 4; // базовая ловкость мага
        _base_int = 8; // базовый интеллект мага
    }

    var _spent = 0; // сколько очков было вложено игроком

    _spent += max(0, _pl.strength - _base_str); // вложено в силу
    _spent += max(0, _pl.agility - _base_agi); // вложено в ловкость
    _spent += max(0, _pl.intellect - _base_int); // вложено в интеллект

    _pl.attr_points += _spent; // возвращаем очки игроку

    return _spent; // возвращаем количество очков
}
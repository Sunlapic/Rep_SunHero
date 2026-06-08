/// scr_player_apply_attributes(_pl)

function scr_player_apply_attributes(_pl)
{
    if (!instance_exists(_pl)) return;

    with (_pl)
    {
        // ── СИЛА → HP и урон ──
        var _old_max = max_hp;

        max_hp = 100 + strength * 10;
        damage = 10 + strength * 2;

        // корректировка HP при изменении max_hp
        var _diff = max_hp - _old_max;
        if (_diff > 0) hp += _diff;

        hp = clamp(hp, 0, max_hp);

        // ── ЛОВКОСТЬ → скорость и стрелы ──
        move_spd    = 2 + agility * 0.2;
        arrow_speed = 12 + agility * 0.3;
        arrow_damage_m = 1.0 + agility * 0.05;

        // ── ИНТЕЛЛЕКТ → магия ──
        fire_cd_max = max(60, 300 - intellect * 2);
        big_arrow_damage_m = 3.0 + intellect * 0.05;
    }

    // ── флаг синхронизации ──
    _pl.changed = true;
}
/// scr_attr_auto_levelup(_pl)

/// scr_attr_auto_levelup(_pl)
/// Вызывается при получении уровня
function scr_attr_auto_levelup(_pl)
{
    if (!instance_exists(_pl)) return;
    // ✅ FIX: Начисляем очки в структуру ТЕКУЩЕГО класса
    var _curr_class = _pl.class;
    
    // Проверяем, существует ли поле для этого класса, если нет - создаем
    if (is_undefined(_pl.class_attr_points[$ _curr_class])) {
        _pl.class_attr_points[$ _curr_class] = 0;
    }
    
    // Добавляем 3 очка
    _pl.class_attr_points[$ _curr_class] += 3;
    
    // Старая переменная для обратной совместимости (если где-то ещё используется)
    if (variable_instance_exists(_pl, "attr_points")) {
        _pl.attr_points += 3;
    }
    
    _pl.changed = true;
    if (asset_get_type("twitch_log") == asset_script)
        twitch_log(_pl.username + " +3 attribute points");
}
/// scr_reclass(_pl, _new)

function scr_reclass(_pl, _new)
{
    if (!instance_exists(_pl)) return; // защита

    // ── если уже этот класс ──
    if (_pl.class == _new)
    {
        scr_chat_msg(_pl, " Вы уже " + _new);
        return;
    }

    var _old = _pl.class; // запоминаем старый класс

    // ── сохраняем статы старого класса ──
    _pl.class_stats[$ _old].strength  = _pl.strength;   // сохраняем STR
    _pl.class_stats[$ _old].agility   = _pl.agility;    // сохраняем AGI
    _pl.class_stats[$ _old].intellect = _pl.intellect;  // сохраняем INT

    // ── сохраняем старый класс ──
    if (asset_get_type("scr_set_class_level") == asset_script)
        scr_set_class_level(_pl, _old, _pl.level); // сохраняем уровень

    if (asset_get_type("scr_set_class_exp") == asset_script)
        scr_set_class_exp(_pl, _old, _pl.experience); // сохраняем опыт

    if (asset_get_type("scr_set_class_attr_points") == asset_script)
        scr_set_class_attr_points(_pl, _old, _pl.attr_points); // сохраняем AP

    // ── переключаем класс ──
	show_debug_message("SAVE STATS FOR: " + _old);

show_debug_message(
    "STR=" + string(_pl.strength) +
    " AGI=" + string(_pl.agility) +
    " INT=" + string(_pl.intellect)
);
    _pl.class = _new; // новый класс
	
	show_debug_message("LOAD STATS FOR: " + _new);

    // ── защита структуры class_stats ──
if (!variable_instance_exists(_pl, "class_stats") || is_undefined(_pl.class_stats))
{
    _pl.class_stats = {
        warrior: {strength: 5, agility: 2, intellect: 2},
        archer:  {strength: 2, agility: 5, intellect: 2},
        wizard:  {strength: 2, agility: 2, intellect: 5}
    };
}

// ── защита конкретного класса ──
if (!variable_struct_exists(_pl.class_stats, _new))
{
    _pl.class_stats[$ _new] = {
        strength: 5,
        agility: 5,
        intellect: 5
    };
}

// ── загрузка ──
_pl.strength  = _pl.class_stats[$ _new].strength;
_pl.agility   = _pl.class_stats[$ _new].agility;
_pl.intellect = _pl.class_stats[$ _new].intellect;

    // ── загрузка нового класса ──
    if (asset_get_type("scr_get_class_level") == asset_script)
        _pl.level = scr_get_class_level(_pl, _new); // загружаем уровень

    if (asset_get_type("scr_get_class_exp") == asset_script)
        _pl.experience = scr_get_class_exp(_pl, _new); // загружаем опыт

    if (asset_get_type("scr_get_class_attr_points") == asset_script)
        _pl.attr_points = scr_get_class_attr_points(_pl, _new); // загружаем AP

    _pl.exp_needed = scr_exp_for_level(_pl.level + 1); // пересчёт опыта до следующего уровня

    // ── пересчёт ──
    if (asset_get_type("scr_recalc_stats") == asset_script)
        scr_recalc_stats(_pl); // пересчёт боевых параметров

    if (asset_get_type("scr_update_player_sprites") == asset_script)
        scr_update_player_sprites(_pl); // обновление спрайтов

    // ── MongoDB флаг ──
    _pl.changed = true; // помечаем как изменённого

    // ── ЕДИНСТВЕННОЕ сообщение в чат ──
    scr_chat_msg(_pl,
        " Класс: " + _old + " → " + _new +
        "  LVL " + string(_pl.level) +
        "  XP " + string(_pl.experience)
    );
}
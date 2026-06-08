/// scr_give_kill_reward(_pl, _target)
/// Вызывается при убийстве врага. Начисляет опыт, золото и проверяет Level Up.
function scr_give_kill_reward(_pl, _target)
{
    if (!instance_exists(_pl)) return;
    if (!instance_exists(_target)) return;
    if (!variable_instance_exists(_pl, "username")) return;
    if (_pl.username == "") return;
    // ── гарантируем базовые данные ──
    if (!variable_instance_exists(_pl, "experience"))
    {
        if (asset_get_type("scr_attr_init") == asset_script)
            scr_attr_init(_pl);
    }
    // ── награды ──
    var _xp_gain   = variable_instance_exists(_target, "xp_reward")   ? _target.xp_reward   : 25;
    var _gold_gain = variable_instance_exists(_target, "gold_reward") ? _target.gold_reward : 5;
    _pl.gold       += _gold_gain;
    _pl.experience += _xp_gain;
    // ── левелап ──
    var _levels_gained = 0;
    while (_pl.experience >= _pl.exp_needed)
    {
        _pl.experience -= _pl.exp_needed;
        _pl.level += 1;
        _levels_gained++;
        _pl.exp_needed = scr_exp_for_level(_pl.level + 1);
    }
    // ── награды за уровни ──
    if (_levels_gained > 0)
    {
        // ✅ FIX: Начисляем очки напрямую в структуру текущего класса!
        var _curr_class = _pl.class;
        var _pts_to_add = _levels_gained * 3;
        
        // Гарантируем, что поле существует
        if (is_undefined(_pl.class_attr_points[$ _curr_class])) {
            _pl.class_attr_points[$ _curr_class] = 0;
        }
        
        _pl.class_attr_points[$ _curr_class] += _pts_to_add;
        _pl.attr_points += _pts_to_add; // Оставляем для совместимости
        if (asset_get_type("scr_recalc_stats") == asset_script)
            scr_recalc_stats(_pl);
            
        // ✅ FIX: Мгновенное сохранение при Level Up, чтобы ничего не пропало
        if (asset_get_type("scr_api_update") == asset_script)
            scr_api_update(_pl);
    }
    // ── синхронизация слотов классов ──
    if (asset_get_type("scr_set_class_level") == asset_script)
        scr_set_class_level(_pl, _pl.class, _pl.level);
    if (asset_get_type("scr_set_class_exp") == asset_script)
        scr_set_class_exp(_pl, _pl.class, _pl.experience);
    // Убираем старую синхронизацию очков, так как мы уже записали их напрямую
    // (Если скрипт scr_set_class_attr_points всё же есть, он не сломается)
    if (asset_get_type("scr_set_class_attr_points") == asset_script)
        scr_set_class_attr_points(_pl, _pl.class, _pl.class_attr_points[$ _pl.class]);
    // ── флаг изменения (для API / save) ──
    _pl.changed = true;
    // ── чат ──
    if (_levels_gained > 0 && asset_get_type("scr_chat_msg") == asset_script)
    {
        scr_chat_msg(_pl,
            " " + _pl.username +
            " LVL UP → " + string(_pl.level) +
            " | +" + string(_levels_gained * 3) + " AP"
        );
    }
}
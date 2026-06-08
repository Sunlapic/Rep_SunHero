/// scr_attr_init(_pl)
/// Инициализирует все параметры нового игрока (баланс, статы, классы).
/// Это ЕДИНСТВЕННОЕ место, где настраиваются стартовые параметры.
function scr_attr_init(_pl)
{
    if (!instance_exists(_pl)) return;
    // ── 1. БАЗОВЫЕ НАСТРОЙКИ (Деньги и активный класс) ──
    if (!variable_instance_exists(_pl, "gold")) _pl.gold = 0;
    if (!variable_instance_exists(_pl, "class")) _pl.class = "warrior";
    // ── 2. БАЛАНС КЛАССОВ (Стартовые статы для каждого класса) ──
    // Здесь ты настраиваешь, с какими статами начинает каждый класс!
    if (!variable_instance_exists(_pl, "class_stats"))
    {
        _pl.class_stats = {
            warrior: {strength: 7, agility: 4, intellect: 2}, // Воин: сильный, неповоротливый
            archer:  {strength: 3, agility: 8, intellect: 2}, // Лучник: быстрый, ловкий
            wizard:  {strength: 1, agility: 2, intellect: 9}  // Маг: хилый, но умный
        };
    }
    // ── 3. СИСТЕМА УРОВНЕЙ И ОПЫТА (Для каждого класса отдельно) ──
    if (!variable_instance_exists(_pl, "class_levels"))
    {
        _pl.class_levels = { warrior: 1, archer: 1, wizard: 1 };
    }
    
    if (!variable_instance_exists(_pl, "class_exp"))
    {
        _pl.class_exp = { warrior: 0, archer: 0, wizard: 0 };
    }
    if (!variable_instance_exists(_pl, "class_attr_points"))
    {
        _pl.class_attr_points = { warrior: 0, archer: 0, wizard: 0 };
    }
    // ── 4. ПРИМЕНЕНИЕ СТАТОВ АКТИВНОГО КЛАССА К ИГРОКУ ──
    // Берем статы текущего класса и копируем их в "корень" игрока
    var _curr_class = _pl.class;
    var _stats = _pl.class_stats[$ _curr_class];
    
    _pl.strength = _stats.strength;
    _pl.agility = _stats.agility;
    _pl.intellect = _stats.intellect;
    _pl.level = _pl.class_levels[$ _curr_class];
    _pl.experience = _pl.class_exp[$ _curr_class];
    
    // (функция scr_exp_for_level должна существовать у тебя в проекте)
    _pl.exp_needed = scr_exp_for_level(_pl.level + 1); 
    // ── 5. БОЕВАЯ СИСТЕМА И ЗАГЛУШКИ ХП ──
    if (!variable_instance_exists(_pl, "attack_hit_done")) _pl.attack_hit_done = false;
    if (!variable_instance_exists(_pl, "attack_hit_frame")) _pl.attack_hit_frame = 2;
    
    if (!variable_instance_exists(_pl, "max_hp")) _pl.max_hp = 100;
    if (!variable_instance_exists(_pl, "hp")) _pl.hp = 100;
    if (!variable_instance_exists(_pl, "damage")) _pl.damage = 10;
    // ── 6. ФИНАЛЬНЫЙ ПЕРЕСЧЕТ УРОНА И ЗДОРОВЬЯ ──
    if (asset_get_type("scr_recalc_stats") == asset_script)
        scr_recalc_stats(_pl);
		// ── 7. ФЛАГ PVP-РЕЖИМА ──
// По умолчанию игрок в PvE (бьёт только мобов)
if (!variable_instance_exists(_pl, "in_pvp")) _pl.in_pvp = false;
}

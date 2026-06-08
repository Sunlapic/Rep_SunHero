/// scr_recalc_stats(_pl)
/// Пересчитывает производные характеристики (max_hp, damage)
/// на основе атрибутов, уровня и активного класса.
/// Вызывается из scr_attr_init, scr_attr_spend_point, scr_reclass.

function scr_recalc_stats(_pl)
{
    // ── Базовые значения атрибутов ──
    var _str = _pl.strength;
    var _agi = _pl.agility;
    var _int = _pl.intellect;
    var _lvl = _pl.level;

    // ── Множители по классу ──
    // (можно подкрутить под свой баланс)
    var _hp_per_str  = 10;
    var _dmg_per_str = 1.5;
    var _dmg_per_agi = 1.0;
    var _dmg_per_int = 1.0;

    switch (_pl.class)
    {
        case "warrior":
            _hp_per_str  = 14;
            _dmg_per_str = 2.0;
            break;
        case "archer":
            _dmg_per_agi = 2.0;
            break;
        case "wizard":
            _dmg_per_int = 2.5;
            break;
    }

    // ── Производные характеристики ──
    _pl.max_hp = 80 + _str * _hp_per_str + _lvl * 5;

    // Если HP ещё не было — устанавливаем full
    if (!variable_instance_exists(_pl, "hp"))
        _pl.hp = _pl.max_hp;

    // Если max_hp вырос — НЕ режем текущее HP;
    // если уменьшился — клампим
    if (_pl.hp > _pl.max_hp)
        _pl.hp = _pl.max_hp;

    _pl.damage = floor(
        10 +
        _str * _dmg_per_str +
        _agi * _dmg_per_agi +
        _int * _dmg_per_int +
        _lvl * 1.5
    );
}

/// scr_class_helpers
/// Универсальные геттеры/сеттеры уровня, опыта и поинтов по имени класса.
/// Работают через современные структуры (class_levels, class_exp, class_attr_points).

// ═══════════════════════════════════════════════════════════
//   1. УРОВНИ ПО КЛАССАМ (Class Levels)
// ═══════════════════════════════════════════════════════════

/// @function scr_get_class_level(_pl, _class)
/// @description Возвращает уровень указанного класса
function scr_get_class_level(_pl, _class)
{
    // Защита: если объекта игрока нет на карте — возвращаем 1
    if (!instance_exists(_pl)) return 1;
    
    // Защита: если структура class_levels еще не создана у игрока — возвращаем 1
    if (!variable_instance_exists(_pl, "class_levels")) return 1;
    
    // Достаём значение уровня по имени класса (warrior/archer/wizard) через [$ ]
    var _lvl = _pl.class_levels[$ _class];
    
    // Если такого ключа в структуре нет — значит уровень 1
    if (is_undefined(_lvl)) return 1;
    
    // Возвращаем найденный уровень
    return _lvl;
}

/// @function scr_set_class_level(_pl, _class, _level)
/// @description Устанавливает уровень указанного класса
function scr_set_class_level(_pl, _class, _level)
{
    // Минимум 1 уровень (защита от отрицательных значений)
    if (_level < 1) _level = 1;
    
    // Защита: если объекта игрока нет на карте — выходим
    if (!instance_exists(_pl)) return;
    
    // Если структуры class_levels нет — создаём её со стартовыми значениями
    if (!variable_instance_exists(_pl, "class_levels"))
        _pl.class_levels = { warrior: 1, archer: 1, wizard: 1 };
    
    // Записываем новый уровень в нужный класс через [$ ]
    _pl.class_levels[$ _class] = _level;
}

// ═══════════════════════════════════════════════════════════
//   2. ОПЫТ ПО КЛАССАМ (Class EXP)
// ═══════════════════════════════════════════════════════════

/// @function scr_get_class_exp(_pl, _class)
/// @description Возвращает накопленный опыт указанного класса
function scr_get_class_exp(_pl, _class)
{
    // Защита: если игрок исчез — возвращаем 0
    if (!instance_exists(_pl)) return 0;
    
    // Если структуры опыта нет — возвращаем 0
    if (!variable_instance_exists(_pl, "class_exp")) return 0;
    
    // Достаём опыт нужного класса
    var _exp = _pl.class_exp[$ _class];
    
    // Если ключ не найден — опыта нет
    if (is_undefined(_exp)) return 0;
    
    // Возвращаем найденное значение
    return _exp;
}

/// @function scr_set_class_exp(_pl, _class, _exp)
/// @description Устанавливает опыт указанного класса
function scr_set_class_exp(_pl, _class, _exp)
{
    // Опыт не может быть отрицательным
    if (_exp < 0) _exp = 0;
    
    // Защита от вылета
    if (!instance_exists(_pl)) return;
    
    // Создаём структуру опыта, если её ещё нет
    if (!variable_instance_exists(_pl, "class_exp"))
        _pl.class_exp = { warrior: 0, archer: 0, wizard: 0 };
    
    // Сохраняем новое значение опыта в нужный класс
    _pl.class_exp[$ _class] = _exp;
}

// ═══════════════════════════════════════════════════════════
//   3. ОЧКИ ХАРАКТЕРИСТИК ПО КЛАССАМ (Class Attribute Points)
// ═══════════════════════════════════════════════════════════

/// @function scr_get_class_attr_points(_pl, _class)
/// @description Возвращает свободные поинты указанного класса
function scr_get_class_attr_points(_pl, _class)
{
    // Защита от исчезновения игрока
    if (!instance_exists(_pl)) return 0;
    
    // Если структуры поинтов нет — возвращаем 0
    if (!variable_instance_exists(_pl, "class_attr_points")) return 0;
    
    // Достаём количество свободных поинтов
    var _pts = _pl.class_attr_points[$ _class];
    
    // Если ключ не найден — поинтов нет
    if (is_undefined(_pts)) return 0;
    
    // Возвращаем количество поинтов
    return _pts;
}

/// @function scr_set_class_attr_points(_pl, _class, _pts)
/// @description Устанавливает свободные поинты указанного класса
function scr_set_class_attr_points(_pl, _class, _pts)
{
    // Поинтов не может быть меньше нуля
    if (_pts < 0) _pts = 0;
    
    // Защита от вылета
    if (!instance_exists(_pl)) return;
    
    // Создаём структуру поинтов, если её ещё нет
    if (!variable_instance_exists(_pl, "class_attr_points"))
        _pl.class_attr_points = { warrior: 0, archer: 0, wizard: 0 };
    
    // Записываем новое количество поинтов
    _pl.class_attr_points[$ _class] = _pts;
}

// ═══════════════════════════════════════════════════════════
//   4. ФОРМУЛА ОПЫТА (Не трогаем, она и так хороша)
// ═══════════════════════════════════════════════════════════

/// @function scr_exp_for_level(_level)
/// @description Сколько суммарно опыта нужно для достижения _level. Формула: 100 * (_level - 1)^2
function scr_exp_for_level(_level)
{
    // На 1-м уровне опыт не нужен
    if (_level < 2) return 0;
    
    // Берем разницу с 1-м уровнем (например, для уровня 5 это будет 4)
    var _n = _level - 1;
    
    // Возвращаем результат по квадратичной формуле (Уровень 2 = 100, Уровень 3 = 400, Уровень 4 = 900)
    return 100 * _n * _n;
}
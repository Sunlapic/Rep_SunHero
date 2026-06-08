/// scr_api_update(_pl)
function scr_api_update(_pl)
{
    if (!instance_exists(_pl)) return;

    // ✅ FIX: Синхронизируем текущий активный уровень и опыт со структурой классов перед сохранением
    // (Иначе в базу уходят нули, и при загрузке прогресс откатывается)
    
    // Проверяем, есть ли переменная level, и обновляем соответствующий класс
    if (variable_instance_exists(_pl, "level") && variable_struct_exists(_pl.class_levels, _pl.class)) {
        // Доступ через [$ ] позволяет использовать строку с названием класса
        _pl.class_levels[$ _pl.class] = _pl.level;
    }
    
    // Проверяем, как у тебя называется опыт (xp или exp)
    if (variable_instance_exists(_pl, "xp") && variable_struct_exists(_pl.class_exp, _pl.class)) {
        _pl.class_exp[$ _pl.class] = _pl.xp;
    } else if (variable_instance_exists(_pl, "exp") && variable_struct_exists(_pl.class_exp, _pl.class)) {
        _pl.class_exp[$ _pl.class] = _pl.exp;
    }

    var data = {
        name: _pl.username,
        data: {
            class:     _pl.class,
            gold:      real(_pl.gold),
            hp:        real(_pl.hp),
            max_hp:    real(_pl.max_hp),
            strength:  real(_pl.strength),
            agility:   real(_pl.agility),
            intellect: real(_pl.intellect),
            damage:    real(_pl.damage),

            class_stats: {
                warrior: {
                    strength:  _pl.class_stats.warrior.strength,
                    agility:   _pl.class_stats.warrior.agility,
                    intellect: _pl.class_stats.warrior.intellect
                },
                archer: {
                    strength:  _pl.class_stats.archer.strength,
                    agility:   _pl.class_stats.archer.agility,
                    intellect: _pl.class_stats.archer.intellect
                },
                wizard: {
                    strength:  _pl.class_stats.wizard.strength,
                    agility:   _pl.class_stats.wizard.agility,
                    intellect: _pl.class_stats.wizard.intellect
                }
            },
            class_levels: {
                warrior: _pl.class_levels.warrior,
                archer:  _pl.class_levels.archer,
                wizard:  _pl.class_levels.wizard
            },
            class_exp: {
                warrior: _pl.class_exp.warrior,
                archer:  _pl.class_exp.archer,
                wizard:  _pl.class_exp.wizard
            },
            class_attr_points: {
                warrior: _pl.class_attr_points.warrior,
                archer:  _pl.class_attr_points.archer,
                wizard:  _pl.class_attr_points.wizard
            }
        }
    };

    var _headers = ds_map_create();
    _headers[? "Content-Type"] = "application/json";

    show_debug_message("SAVE USER: " + string(_pl.username));
    show_debug_message("SAVE JSON: " + json_stringify(data));

    http_request(
        "https://rep-sunhero.onrender.com/api/update",
        "POST",
        _headers,
        json_stringify(data)
    );

    ds_map_destroy(_headers);
}
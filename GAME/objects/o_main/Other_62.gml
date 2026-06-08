
/// =============================================
/// o_main — Async - HTTP Event

// =============================================
// УСТАНОВКА ГЛОБАЛЬНОГО ШРИФТА ДЛЯ ВСЕЙ ИГРЫ
// =============================================
draw_set_font(fnt_main); // fnt_main - это имя шрифта

/// Обработка загрузки данных игрока с сервера
/// =============================================

var _type = async_load[? "id"];
if (_type != undefined)
{
    var _result = async_load[? "result"];
    show_debug_message("HTTP RESPONSE: " + string(_result));
    if (is_string(_result) && string_length(_result) > 0)
    {
        var _json = json_parse(_result);
        if (_json != undefined)
        {
            // ✅ FIX 1: Сервер присылает "username", а не "name"
            if (variable_struct_exists(_json, "username"))
            {
                var _name = _json.username;
                var _key = string_lower(_name);
                show_debug_message("📦 DATA FOR: " + string(_name));
                // ✅ FIX 2: Ищем конкретного игрока по имени, а не первого попавшегося o_player!
                if (ds_map_exists(global.players, _key))
                {
                    var _pl = global.players[? _key];
                    if (instance_exists(_pl))
                    {
                        // ✅ FIX 3: Данные лежат в корне JSON, а не внутри объекта "data"
                        // Аккуратно загружаем все поля
                        if (variable_struct_exists(_json, "gold")) _pl.gold = _json.gold;
                        if (variable_struct_exists(_json, "class")) _pl.class = _json.class;
                        
                        if (variable_struct_exists(_json, "hp")) _pl.hp = _json.hp;
                        if (variable_struct_exists(_json, "max_hp")) _pl.max_hp = _json.max_hp;
                        if (variable_struct_exists(_json, "damage")) _pl.damage = _json.damage;
                        
                        if (variable_struct_exists(_json, "strength")) _pl.strength = _json.strength;
                        if (variable_struct_exists(_json, "agility")) _pl.agility = _json.agility;
                        if (variable_struct_exists(_json, "intellect")) _pl.intellect = _json.intellect;
                        // ✅ FIX 4: Глубокое копирование вложенных структур
                        // Если просто присвоить _pl.class_levels = _json.class_levels, 
                        // GameMaker перепишет старую структуру. Мы должны обновить поля ВНУТРИ существующих структур.
                        
                        var _classes = ["warrior", "archer", "wizard"];
                        
                        for (var _i = 0; _i < array_length(_classes); _i++) {
                            var _c = _classes[_i];
                            
                            if (variable_struct_exists(_json, "class_levels") && variable_struct_exists(_json.class_levels, _c))
                                _pl.class_levels[$ _c] = _json.class_levels[$ _c];
                                
                            if (variable_struct_exists(_json, "class_exp") && variable_struct_exists(_json.class_exp, _c))
                                _pl.class_exp[$ _c] = _json.class_exp[$ _c];
                                
                            if (variable_struct_exists(_json, "class_attr_points") && variable_struct_exists(_json.class_attr_points, _c))
                                _pl.class_attr_points[$ _c] = _json.class_attr_points[$ _c];
                                
                            if (variable_struct_exists(_json, "class_stats") && variable_struct_exists(_json.class_stats, _c)) {
                                var _s_in = _json.class_stats[$ _c];
                                var _s_out = _pl.class_stats[$ _c];
                                if (variable_struct_exists(_s_in, "strength")) _s_out.strength = _s_in.strength;
                                if (variable_struct_exists(_s_in, "agility")) _s_out.agility = _s_in.agility;
                                if (variable_struct_exists(_s_in, "intellect")) _s_out.intellect = _s_in.intellect;
                            }
                        }
                        // Пересчитываем статы после загрузки
                        // Убедимся, что level установлен для текущего класса
                        if (variable_struct_exists(_pl.class_levels, _pl.class)) {
                            _pl.level = _pl.class_levels[$ _pl.class];
                        }
                        
                        scr_recalc_stats(_pl);
                        _pl.data_loaded = true;
                        show_debug_message("✅ PLAYER LOADED FROM SERVER: " + string(_name));
                    }
                }
                else
                {
                    show_debug_message("⚠️ PLAYER NOT FOUND IN GLOBAL MAP: " + string(_name));
                }
            }
        }
    }
}
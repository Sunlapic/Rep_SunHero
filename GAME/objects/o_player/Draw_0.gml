draw_set_alpha(1);

var bar_w = 40;
var bar_h = 6;
var bar_x = x - bar_w / 2;
var bar_y = y - 60;

var hp_ratio  = (max_hp > 0) ? clamp(hp / max_hp, 0, 1) : 0;
var exp_ratio = (exp_needed > 0) ? clamp(experience / exp_needed, 0, 1) : 0;

// ── Красная тень под PvP-игроками ──
if (variable_instance_exists(id, "in_pvp") && in_pvp)
{
    draw_set_alpha(0.6); // Полупрозрачная (60%)
    draw_set_color(c_red);
    
    // Рисуем овальную тень под ногами
    // bbox_bottom - это самая нижняя точка спрайта игрока
    draw_ellipse(
        x - 25, bbox_bottom - 5, // Левый верхний угол овала
        x + 25, bbox_bottom + 5, // Правый нижний угол овала
        false                     // false = заливка, true = только контур
    );
    
    // Возвращаем настройки рисования по умолчанию
    draw_set_alpha(1);
    draw_set_color(c_white);
}

// ── Спрайт со сдвигом 4px (ноги в траве) ─────────────────
if (sprite_index != -1 && sprite_exists(sprite_index))
{
    draw_sprite_ext(sprite_index, image_index, x, y + 4, image_xscale, 1, 0, c_white, 1);
}

// ── HP фон ───────────────────────────────────────────────
draw_set_color(c_red);
draw_rectangle(bar_x, bar_y, bar_x + bar_w, bar_y + bar_h, false);

// ── HP заливка ───────────────────────────────────────────
draw_set_color(merge_color(c_red, c_lime, hp_ratio));
draw_rectangle(bar_x, bar_y, bar_x + floor(bar_w * hp_ratio), bar_y + bar_h, false);

// ── XP ───────────────────────────────────────────────────
var xp_y = bar_y + bar_h + 3;
draw_set_color(c_dkgray);
draw_rectangle(bar_x, xp_y, bar_x + bar_w, xp_y + 3, false);
draw_set_color(c_yellow);
draw_rectangle(bar_x, xp_y, bar_x + floor(bar_w * exp_ratio), xp_y + 3, false);

// ── Имя ──────────────────────────────────────────────────
draw_set_color(c_grey);
draw_text(bar_x - 30, bar_y - 20, username + "  Lv." + string(level));

// Атрибуты (маленьким шрифтом)
draw_set_color(make_color_rgb(180,180,180));
draw_text_transformed(x, bbox_top - 60,
    "STR:" + string(strength)
    + " AGI:" + string(agility)
    + " INT:" + string(intellect),
    0.7, 0.7, 0);
 
// Очки атрибутов (если есть)
var _curr_pts = 0;
if (variable_instance_exists(id, "class_attr_points") && variable_struct_exists(class_attr_points, class)) 
{
    _curr_pts = class_attr_points[$ class];
}

if (_curr_pts > 0)
{
    draw_set_color(c_yellow);
    draw_text(x, bbox_top - 80, "+" + string(_curr_pts) + " points");
}
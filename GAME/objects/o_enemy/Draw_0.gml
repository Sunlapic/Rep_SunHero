// Прорисовка спрайта
draw_self();
// Полоска HP
var bar_w = 40;
var bar_h = 6;
var bar_x1 = x - bar_w / 2;
var bar_y1 = bbox_top - 10;
var bar_x2 = x + bar_w / 2;
var bar_y2 = bar_y1 + bar_h;
// hp_ratio всегда от 0 до 1, чтобы полоса не уходила в минус
var hp_ratio = (max_hp > 0) ? clamp(hp / max_hp, 0, 1) : 0;
var hp_w = floor(bar_w * hp_ratio);
// Фон полоски
draw_set_color(c_red);
draw_rectangle(bar_x1, bar_y1, bar_x2, bar_y2, false);
// Красная часть HP
draw_set_color(c_green);
draw_rectangle(bar_x1, bar_y1, bar_x1 + hp_w, bar_y2, false);
// Надпись "enemy"
draw_set_color(c_red);
draw_set_halign(fa_center);
draw_text(x, bar_y1 - 16, "Del_Torus");
// Возвращаем настройки текста обратно
draw_set_halign(fa_left);
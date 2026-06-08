sprite_index = spr_big_arrow; // спрайт большой стрелы
image_index = 0; // стартовый кадр
image_speed = 0.6; // скорость анимации

speed_arrow = 18; // скорость полета
damage = 30; // урон
range = room_width + 400; // дальность полета
distance_traveled = 0; // сколько уже пролетела

owner = noone; // владелец стрелы
has_hit = false; // флаг завершения

image_angle = 0; // угол полета
image_xscale = 3; // увеличиваем по X
image_yscale = 3; // увеличиваем по Y
depth = 90; // глубина

hit_list = ds_list_create(); // список уже задетых врагов
// ═══════════════════════════════════════════════════════════
// o_player Create
// ═══════════════════════════════════════════════════════════

// ── ОБЩИЕ НАСТРОЙКИ ────────────────────────────────────────
target_hsp = 0;   // желаемая скорость по X (заполняется в combat)

visible = true;                          // объект сразу видим после создания
just_spawned = true;                     // флаг первого кадра после спавна, нужен чтобы поставить игрока на землю
depth = 50;                              // глубина отрисовки: чем больше число, тем дальше объект рисуется

// ── ОСНОВНЫЕ ДАННЫЕ ПЕРСОНАЖА ─────────────────────────────
username   = "Player";                   // имя по умолчанию, потом обычно заменяется ником из Twitch
level      = 1;                          // стартовый уровень персонажа
experience = 0;                          // текущий накопленный опыт
exp_needed = 50;                         // сколько опыта нужно до следующего уровня; 50 = первый уровень берётся быстро
gold       = 0;                          // стартовое золото
// Инициализируем структуру с нужными классами
class_attr_points = {
    warrior: 0,
    archer: 0,
    wizard: 0
};

class_levels = {
    warrior: 1,
    archer: 1,
    wizard: 1
};

class_exp = {
    warrior: 0,
    archer: 0,
    wizard: 0
};
class_stats = {
    warrior: {
        strength: 5,
        agility: 2,
        intellect: 2
    },

    archer: {
        strength: 2,
        agility: 5,
        intellect: 2
    },

    wizard: {
        strength: 2,
        agility: 2,
        intellect: 5
    }
};

// ── ЗДОРОВЬЕ ───────────────────────────────────────────────
max_hp = 100;                            // максимальное здоровье; 100 = базовый запас HP
hp     = max_hp;                         // текущее здоровье в начале равно максимуму

// ── СОСТОЯНИЕ ПЕРСОНАЖА ───────────────────────────────────
attacking  = false;                      // атакует ли персонаж прямо сейчас
moving     = false;                      // двигается ли персонаж прямо сейчас
attack_key = false;                      // запасная переменная под кнопку/сигнал атаки

// ── БОЕВЫЕ ХАРАКТЕРИСТИКИ ─────────────────────────────────
damage        = 10;                      // текущий урон за удар/выстрел; 10 = нормальный стартовый урон
move_spd      = 2;                       // скорость движения; 2 = спокойная базовая скорость
attack_spd    = 30;                      // задержка между атаками в кадрах; 30 = 2 атаки в секунду при 60 FPS
attack_range  = 50;                      // базовая дистанция атаки; 50 = ближний бой почти вплотную
attack_height = 50;                      // допустимая разница по высоте для атаки; 50 = не бьёт через высокий уступ
attack_timer  = attack_spd;              // таймер кулдауна атаки, стартует полностью заряженным

// ── ЦЕЛЬ И ПОВЕДЕНИЕ БЕЗ ЦЕЛИ ─────────────────────────────
target     = noone;                      // текущая цель; noone = цели пока нет
move_timer = irandom_range(60, 120);     // сколько кадров идти в случайном направлении; 60..120 = от 1 до 2 сек при 60 FPS
move_dir   = choose(-1, 1);              // стартовое направление блуждания: -1 = влево, 1 = вправо

// ── СМЕРТЬ И РЕСПАВН ──────────────────────────────────────
is_dead       = false;                   // мёртв ли персонаж сейчас
respawn_timer = 0;                       // таймер до возрождения после смерти
respawn_time  = game_get_speed(gamespeed_fps) * 5; // 5 секунд до респавна

// ── ФИЗИКА ────────────────────────────────────────────────
hsp          = 0;
vsp          = 0;
grav         = 0.35;
max_fall_spd = 8;
on_ground    = false;
ground_object = o_par_ground;
attack_y_range = 48;

// ── ОТБРАСЫВАНИЕ / KNOCKBACK ──────────────────────────────
knockback_x     = 0;
knockback_y     = 0;
knockback_timer = 0;

// ── НАПРАВЛЕНИЕ И АНИМАЦИЯ ────────────────────────────────
face_dir        = 1;
death_anim_done = false;
sprite_index    = spr_player_idle;
image_index     = 0;
image_speed     = 1;

// ── АРХЕТИП / КЛАСС ───────────────────────────────────────
class       = "archer";
arch_tier   = 1;
class_ready = false;

// ── СКИЛ: ОГНЕННАЯ СТРЕЛА (!fire) ──
fire_requested = false;
is_casting     = false;
cast_fired     = false;
fire_cd        = 0;
fire_cd_max    = game_get_speed(gamespeed_fps) * 10;
fire_hit_frame = 12;

// ── параметры гигантской стрелы ──
big_arrow_speed    = 16;
big_arrow_damage_m = 10.0;
big_arrow_scale    = 5.0;

// ── БАЗОВЫЕ СТАТЫ ───────────────────────────────────────
base_max_hp   = 100;
base_damage   = 6;
base_move_spd = 2;

// ── ВОИН ────────────────────────────────────────────────
melee_attack_range = 50;

// ── ЛУЧНИК ──────────────────────────────────────────────
archer_attack_range = 200;
archer_min_range    = 90;
projectile_speed    = 10;
projectile_spawn_x  = 0;
projectile_spawn_y  = -20;

// ── МАГ ────────────────────────────────────────────────
wizard_attack_range = 200;
wizard_min_range    = 90;

// ── СТРЕЛА ──────────────────────────────────────────────
arrow_speed    = projectile_speed;
arrow_range    = 400;
arrow_damage_m = 1.0;

// ── СПРАЙТЫ (пока выключены) ────────────────────────────
//spr_idle = spr_player_idle;
//spr_run  = spr_player_run;
//spr_atk  = spr_player_attack;
//spr_dead = spr_player_dead;

// ── ВЫТАЛКИВАНИЕ ИЗ ЗЕМЛИ ──────────────────────────────
while (place_meeting(x, y, o_par_ground))
    y -= 1;

// ── РЕСПАВН ─────────────────────────────────────────────
spawn_x = x;
spawn_y = y;

// ── АТРИБУТЫ ────────────────────────────────────────────
username    = "";
class       = "warrior";

strength    = 5;
agility     = 5;
intellect   = 5;
attr_points = 0;

// ── ДЛЯ ПЕРЕСЧЁТА ───────────────────────────────────────
move_spd          = 2;
arrow_speed       = 12;
arrow_damage_m    = 1.0;
fire_cd_max       = 300;
big_arrow_damage_m = 3.0;

// ── СОХРАНЕНИЕ ЗАГРУЗКА ────────────────────────────────────
data_loaded = false; // пока данные не пришли с сервера — нельзя сохранять

// ── PvP флаг ──
pvp_killed = false;

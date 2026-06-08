// ═══════════════════════════════════════════════════════════
// scr_skills — СКИЛЫ ИГРОКА (команды из чата)
// Скопируй содержимое в скрипт-ресурс с именем "scr_skills"
//
// Сейчас здесь скил !fire (огненная стрела лучника).
// Функции вызываются из Step объекта o_player.
// ═══════════════════════════════════════════════════════════


// ── ОБРАБОТКА СКИЛОВ ──────────────────────────────────────
// Вызывать в Step ПОСЛЕ проверки смерти и ДО обычного боя.
// Возвращает true, если игрок сейчас КАСТУЕТ скил —
// тогда обычный бой/движение в этот кадр пропускаем
// (оставляем только гравитацию).
function scr_player_handle_skills()
{
    if (fire_cd > 0) fire_cd--;              // кулдаун скила тикает всегда

    // ── ЗАПУСК СКИЛА ПО КОМАНДЕ ИЗ ЧАТА ──
    if (fire_requested)
    {
        fire_requested = false;             // запрос обработан (сбрасываем всегда)

        // условия: не кастуем, живы, это лучник, кулдаун прошёл
        if (!is_casting && !is_dead && class == "archer" && fire_cd <= 0)
        {
            is_casting = true;              // входим в состояние каста
            cast_fired = false;            // стрела ещё не выпущена
            fire_cd    = fire_cd_max;      // ставим кулдаун

            hsp        = 0;                // мгновенно гасим движение
            target_hsp = 0;

            // ── ВЫБИРАЕМ НАПРАВЛЕНИЕ ВЫСТРЕЛА ──
            // целимся в ближайшего живого врага, иначе — куда смотрим
            var _d  = face_dir;
            var _nr = instance_nearest(x, y, o_enemy);
            if (instance_exists(_nr) && !_nr.is_dead)
                _d = (_nr.x >= x) ? 1 : -1;

            face_dir     = _d;
            image_xscale = _d;

            // включаем анимацию выстрела с колена
            sprite_index = spr_archer_skill_fire;
            image_index  = 0;
            image_speed  = 1;
        }
    }

    if (!is_casting) return false;          // не кастуем — обычный Step

    // ── ИДЁТ КАСТ: стоим неподвижно ──
    hsp        = 0;
    target_hsp = 0;

    // момент выпуска стрелы (нужный кадр анимации)
    if (!cast_fired && image_index >= fire_hit_frame)
    {
        cast_fired = true;
        scr_player_fire_big_arrow();        // создаём гигантскую стрелу
    }

    // анимация выстрела закончилась — выходим из каста
    if (image_index >= sprite_get_number(spr_archer_skill_fire) - 1)
    {
        is_casting   = false;
        sprite_index = spr_idle;
        image_index  = 0;
    }

    return true;                            // в этот кадр — только каст
}


// ── СОЗДАНИЕ ГИГАНТСКОЙ СТРЕЛЫ ────────────────────────────
function scr_player_fire_big_arrow()
{
    // направление: 0 = вправо, 180 = влево (зависит от face_dir)
    var _angle = (face_dir >= 0) ? 0 : 180;

    var _a = instance_create_layer(
        x + projectile_spawn_x * face_dir,  // смещение по направлению
        y + projectile_spawn_y,
        "Instances",
        o_arrow_big
    );

    _a.image_angle  = _angle;
    _a.image_xscale = big_arrow_scale;      // ×3 размер
    _a.image_yscale = big_arrow_scale;
    _a.speed_arrow  = big_arrow_speed;
    _a.damage       = round(damage * big_arrow_damage_m); // ×3 урон
    _a.owner        = id;

    twitch_log(username + " used FIRE ARROW!");
}

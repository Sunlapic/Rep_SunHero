// ── НАБОР СПРАЙТОВ ПО КЛАССУ ──────────────────────────────
// Выбирает spr_idle/run/atk/dead в зависимости от class.
// ВЫЗЫВАЕМ В НАЧАЛЕ Step, чтобы даже анимация смерти брала
// правильные спрайты класса.
function scr_player_apply_class_sprites()
{
    if (class == "archer")
    {
        spr_idle = spr_archer_idle;
        spr_run  = spr_archer_run;
        spr_atk  = spr_archer_attack;
        spr_dead = spr_archer_dead;
        attack_hit_frame = 13;   // удар на 2-м кадре
    }
    else if (class == "wizard")   // ← НОВОЕ: wizard
    {
        spr_idle = spr_fire_wizard_idle;
        spr_run  = spr_fire_wizard_run;
        spr_atk  = spr_fire_wizard_attack_1;
        spr_dead = spr_fire_wizard_dead;
        attack_hit_frame = 3;   // удар на 4-м кадре (каст)
    }
    else                              // warrior (default)
    {
        spr_idle = spr_player_idle;
        spr_run  = spr_player_run;
        spr_atk  = spr_player_attack;
        spr_dead = spr_player_dead;
        attack_hit_frame = 4;   // удар на 3-м кадре
    }
}


// ── ПЕРВЫЙ КАДР: СТАВИМ ИГРОКА НА ЗЕМЛЮ ───────────────────
function scr_player_first_frame()
{
    if (!just_spawned) return false;

    just_spawned = false;

    var _gy = y;
    while (_gy < room_height && !position_meeting(x, _gy, o_par_ground))
        _gy += 1;

    y       = _gy - 1;
    spawn_x = x;
    spawn_y = y;
    return true;
}


// ── ПОИСК ЦЕЛИ (враги + PvP игроки) ───────────────────────
function scr_player_update_target()
{
    // Если текущая цель умерла — сбрасываем
    if (instance_exists(target))
    {
        if (variable_instance_exists(target, "is_dead") && target.is_dead) target = noone;
        if (variable_instance_exists(target, "hp") && target.hp <= 0) target = noone;
    }

    var _best_target = noone;
    var _best_dist   = 999999;

    // === 1. Ищем врагов ===
    var _nr = instance_nearest(x, y, o_enemy);
    if (instance_exists(_nr) && !_nr.is_dead)
    {
        var _d = point_distance(x, y, _nr.x, _nr.y);
        if (_d < _best_dist)
        {
            _best_dist   = _d;
            _best_target = _nr;
        }
    }

    // === 2. Ищем игроков в PvP (только если мы сами в PvP) ===
    if (variable_instance_exists(id, "in_pvp") && in_pvp)
    {
        with (o_player)
        {
            if (id != other.id && variable_instance_exists(id, "in_pvp") && in_pvp && hp > 0)
            {
                var _d = point_distance(other.x, other.y, x, y);
                if (_d < _best_dist)
                {
                    _best_dist   = _d;
                    _best_target = id;
                }
            }
        }
    }

    // Выбираем ближайшую цель
    if (instance_exists(_best_target))
    {
        if (!instance_exists(target) || point_distance(x, y, _best_target.x, _best_target.y) < point_distance(x, y, target.x, target.y) - 40)
        {
            target = _best_target;
        }
    }
}
// ── БОЙ + РАСЧЁТ ЖЕЛАЕМОЙ СКОРОСТИ ────────────────────────
function scr_player_combat()
{
    if (attack_timer > 0) attack_timer--;

    // Блокировка движения во время атаки
    if (sprite_index == spr_atk)
    {
        hsp        = 0;
        target_hsp = 0;
        return false;
    }

    var _thsp = 0;
    var _atk  = false;

    // дистанция остановки зависит от класса
    var _stop = melee_attack_range;
    if (class == "archer")  _stop = archer_attack_range;
    if (class == "wizard")  _stop = wizard_attack_range;  // ← НОВОЕ

    if (instance_exists(target))
    {
        var _dx = abs(target.x - x);

        if (_dx <= _stop)
        {
            _thsp = 0;

            if (attack_timer <= 0)
            {
                attack_timer    = attack_spd;
                attack_hit_done = false;   // ← сбрасываем флаг!
                _atk = true;
                // УРОН НЕ НАНОСИМ ЗДЕСЬ — он пойдёт на hit frame
            }
        }
        else
        {
            _thsp = sign(target.x - x) * move_spd;
        }
    }
    else
    {
        move_timer--;
        if (move_timer <= 0)
        {
            move_timer = irandom_range(60, 120);
            move_dir   = choose(-1, 0, 1);
        }
        _thsp = move_dir * move_spd;
    }

    target_hsp = _thsp;
    return _atk;
}

// ── ЛУЧНИК: СОЗДАНИЕ СТРЕЛЫ ───────────────────────────────
function scr_player_shoot_arrow()
{
    // Цель исчезла или умерла
    if (target == noone || !instance_exists(target))
    {
        target = noone;
        exit;
    }

    var _a = instance_create_layer(
        x + projectile_spawn_x,
        y + projectile_spawn_y,
        "Instances",
        o_arrow
    );

    _a.image_angle = point_direction(
        x + projectile_spawn_x,
        y + projectile_spawn_y,
        target.x,
        target.y
    );

    _a.speed_arrow = arrow_speed;
    _a.damage      = round(damage * arrow_damage_m);
    _a.range       = arrow_range;
    _a.owner       = id;
}
// ── WIZARD: ФАЕРБОЛЛ (с поддержкой PvP) ───────────────────
function scr_player_cast_fireball()
{
    if (target == noone || !instance_exists(target))
    {
        target = noone;
        exit;
    }

    var _f = instance_create_layer(
        x + projectile_spawn_x,
        y + projectile_spawn_y,
        "Instances",
        o_fireball
    );

    _f.image_angle = point_direction(
        x + projectile_spawn_x,
        y + projectile_spawn_y,
        target.x,
        target.y
    );

    _f.speed_fireball = arrow_speed;
    _f.damage         = round(damage * 1.2);
    _f.range          = arrow_range;
    _f.owner          = id;
}

// ── НАНЕСЕНИЕ УРОНА (вызывается на hit frame анимации) ─────
// Эта функция вызывается из scr_player_update_sprites(),
// когда image_index доходит до attack_hit_frame.
function scr_player_deal_attack_damage()
{
    if (class == "archer")
        scr_player_shoot_arrow();
    else if (class == "wizard")
        scr_player_cast_fireball();
    else
        scr_player_melee_hit();
}


// ── ВОИН: БЛИЖНИЙ УДАР (PvP + PvE) ────────────────────────
function scr_player_melee_hit()
{
    if (!instance_exists(target) || target.hp <= 0) return;

    // ── ПОПАДАНИЕ ПО ИГРОКУ (PvP) ──
    if (target.object_index == o_player)
    {
        if (variable_instance_exists(id, "in_pvp") && in_pvp &&
            variable_instance_exists(target.id, "in_pvp") && target.in_pvp)
        {
            target.hp = max(target.hp - damage, 0);

            if (target.hp <= 0)
            {
                gold += 50;
                if (variable_struct_exists(class_attr_points, class))
                    class_attr_points[$ class] += 1;

                scr_recalc_stats(id);
                scr_chat_msg(id, "убил @" + target.username + "! +50 золота ⚔");

                target.hp = target.max_hp;
                target.in_pvp = false;
                target.x = 1300;
                target.y = 95;

                scr_chat_msg(target, "ты пал в бою. Возрождение в безопасной зоне.");

                scr_api_update(id);
                scr_api_update(target);

                target = noone;
            }
        }
        return;
    }

    // ── ПОПАДАНИЕ ПО ВРАГУ (PvE) ──
    if (!target.is_dead)
        target.hp -= damage;

    if (target.hp <= 0)
    {
        scr_give_kill_reward(id, target);
        instance_destroy(target);
        target = noone;
    }
}
// ── ДВИЖЕНИЕ, РАЗВОРОТ, ГРАВИТАЦИЯ, КОЛЛИЗИИ ──────────────
function scr_player_movement()
{
    var _thsp = target_hsp;

    if      (_thsp > 0 && hsp < _thsp)  hsp += move_spd * 0.3;
    else if (_thsp < 0 && hsp > _thsp)  hsp -= move_spd * 0.3;
    else if (_thsp == 0)                hsp *= 0.5;
    else                                hsp  = _thsp;

    if (abs(hsp) < 0.1) hsp = 0;

    if (hsp != 0)
        face_dir = sign(hsp);
    else if (instance_exists(target))
    {
        if      (target.x > x + 5) face_dir =  1;
        else if (target.x < x - 5) face_dir = -1;
    }
    image_xscale = face_dir;

    var _hsp = round(hsp);
    if (_hsp != 0)
    {
        var _d = sign(_hsp);
        repeat (abs(_hsp))
        {
            if (!place_meeting(x + _d, y, o_par_ground)) x += _d;
            else { hsp = 0; break; }
        }
    }

    if (!place_meeting(x, y + 1, o_par_ground)) vsp += grav;
    else                                    vsp  = 0;

    if (place_meeting(x, y + vsp, o_par_ground))
    {
        while (!place_meeting(x, y + sign(vsp), o_par_ground))
            y += sign(vsp);
        vsp = 0;
    }
    y += vsp;
}


// ── СМЕРТЬ И РЕСПАВН ──────────────────────────────────────
function scr_player_handle_death()
{
    // === НАСТУПИЛА СМЕРТЬ ===
    if (hp <= 0 && !is_dead)
    {
        is_dead         = true;
        respawn_timer   = 0;
        death_anim_done = false;
        sprite_index    = spr_dead;
        image_index     = 0;
        image_speed     = 1;
        hsp = 0;
        vsp = 0;

        is_casting     = false;
        cast_fired     = false;
        fire_requested = false;
        target_hsp     = 0;
        target         = noone; // СБРАСЫВАЕМ ЦЕЛЬ ПРИ СМЕРТИ
    }

    if (!is_dead) return false;

    // === АНИМАЦИЯ СМЕРТИ ===
    if (!death_anim_done)
    {
        image_speed = 1;
        if (image_index >= sprite_get_number(spr_dead) - 1)
        {
            image_speed     = 0;
            image_index     = sprite_get_number(spr_dead) - 1;
            death_anim_done = true;
        }
        return true;
    }

    // === ВОСКРЕШЕНИЕ ===
    respawn_timer += 1;
    if (respawn_timer >= respawn_time)
    {
        is_dead         = false;
        death_anim_done = false;
        hp              = max_hp;
        x               = spawn_x;
        y               = spawn_y;
        visible         = true;
        respawn_timer   = 0;
        hsp = 0;
        vsp = 0;
        image_speed     = 1;
        sprite_index    = spr_idle;

        is_casting     = false;
        cast_fired     = false;
        fire_requested = false;
        target_hsp     = 0;
        target         = noone; // СБРАСЫВАЕМ ЦЕЛЬ ПРИ ВОСКРЕШЕНИИ

        // ═══════════════════════════════════════
        // 🔴 PvP-СПЕЦИАЛЬНАЯ ОБРАБОТКА 🔴
        // ═══════════════════════════════════════
        if (variable_instance_exists(id, "pvp_killed") && pvp_killed)
        {
            pvp_killed = false;

            // ВЫКИДЫВАЕМ ИЗ PvP
            in_pvp = false;

            // НАГРАДА УБИЙЦЕ
            if (variable_instance_exists(id, "last_attacker") && instance_exists(last_attacker))
            {
                last_attacker.gold += 50;
                if (variable_struct_exists(last_attacker.class_attr_points, last_attacker.class))
                    last_attacker.class_attr_points[$ last_attacker.class] += 1;

                scr_recalc_stats(last_attacker);
                scr_chat_msg(last_attacker, "убил @" + username + "! +50 золота ⚔");
                scr_api_update(last_attacker);
            }

            scr_chat_msg(id, "ты пал в бою. Возрождение в безопасной зоне.");
            scr_api_update(id);
        }
    }
    return true;
}
// ── АНИМАЦИЯ ──────────────────────────────────────────────
function scr_player_update_sprites(_atk)
{
    if (sprite_index == spr_atk)
    {
        // ═══════════════════════════════════════════════════
        //  HIT FRAME: проверяем, не пора ли нанести урон?
        // ═══════════════════════════════════════════════════
        if (!attack_hit_done && image_index >= attack_hit_frame)
        {
            attack_hit_done = true;
            scr_player_deal_attack_damage();   // ← УРОН ЗДЕСЬ!
        }

        // доигрываем анимацию до конца
        if (image_index >= sprite_get_number(spr_atk) - 1)
        {
            sprite_index = spr_idle;
            image_index  = 0;
        }
    }
    else
    {
        if (_atk)
        {
            sprite_index = spr_atk;
            image_index  = 0;
            image_speed  = 1;
        }
        else if (abs(hsp) > 0.5)
        {
            if (sprite_index != spr_run) { sprite_index = spr_run; image_index = 0; }
            image_speed = 0.8;
        }
        else
        {
            if (sprite_index != spr_idle) { sprite_index = spr_idle; image_index = 0; }
            image_speed = 0.5;
        }
    }
}

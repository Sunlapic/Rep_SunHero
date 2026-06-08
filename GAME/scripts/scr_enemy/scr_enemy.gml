// ═══════════════════════════════════════════════════════════
// scr_enemy — ВСЯ ЛОГИКА ВРАГА (вынесена из o_enemy Step)
// Скопируй содержимое в скрипт-ресурс с именем "scr_enemy"
//
// Функции вызываются из Step объекта o_enemy, поэтому внутри
// x, y, hp, target и т.д. — это переменные самого врага.
// ═══════════════════════════════════════════════════════════

// ── ПЕРВЫЙ КАДР: СТАВИМ ВРАГА НА ЗЕМЛЮ ────────────────────
function scr_enemy_first_frame()
{
    if (enemy_grounded) return; // уже поставлен

    enemy_grounded = true;
    var _gy = y;

    while (_gy < room_height && !position_meeting(x, _gy, o_par_ground))
        _gy += 1;

    y = _gy - 1; // ставим над землёй
    spawn_y = y; // точный Y для респавна
}

// ── СМЕРТЬ И РЕСПАВН ──────────────────────────────────────
// Возвращает true, если этот кадр нужно завершить (exit в Step).
function scr_enemy_handle_death()
{
    if (hp > 0) return false; // жив — обычный Step

    if (!is_dead) // только что умер
    {
        is_dead = true;
        death_anim_done = false;
        is_attacking = false;
        attack_hit_done = false;
        respawn_timer = respawn_delay;
        target = noone;
        vsp = 0;

        if (!reward_given && instance_exists(last_attacker))
        {
            scr_give_kill_reward(last_attacker, id); // даём награду тому, кто добил
            reward_given = true; // второй раз не выдаём
        }

        sprite_index = spr_dead;
        image_index = 0;
        image_speed = 1;
    }

    if (!death_anim_done) // доигрываем смерть
    {
        if (image_index >= sprite_get_number(spr_dead) - 1)
        {
            image_index = sprite_get_number(spr_dead) - 1;
            image_speed = 0;
            death_anim_done = true;
        }
    }

    respawn_timer--;

    if (death_anim_done && respawn_timer <= 0) // воскрешаем
    {
        x = spawn_x;
        y = spawn_y;
        hp = max_hp;
        is_dead = false;
        death_anim_done = false;
        reward_given = false; // можно снова выдавать награду после новой смерти
        last_attacker = noone; // забываем, кто бил раньше
        target = noone;
        vsp = 0;
        wander_dir = choose(-1, 1);
        wander_timer = irandom_range(60, 120);
        attack_timer = 0;
        is_attacking = false;
        attack_hit_done = false;
        sprite_index = spr_walk;
        image_index = 0;
        image_speed = 0.6;
    }

    return true; // мёртвый дальше не думает
}

// ── ОБНАРУЖЕНИЕ БЛИЖАЙШЕГО ЖИВОГО ИГРОКА ──────────────────
// Раньше использовалось o_player.x — но в чат-RPG игроков МНОГО,
// и это всегда брало только первого. Теперь ищем ближайшего живого.
function scr_enemy_update_target()
{
    if (attack_timer > 0) attack_timer--; // кулдаун атаки

    var _best = noone;
    var _best_d = notice_range + 1; // ищем в радиусе внимания

    with (o_player)
    {
        if (is_dead) continue; // мёртвых не замечаем

        var _ddx = abs(x - other.x);
        var _ddy = abs(y - other.y);

        if (_ddx < other.notice_range && _ddy < other.notice_height)
        {
            if (_ddx < _best_d)
            {
                _best_d = _ddx;
                _best = id;
            }
        }
    }

    if (_best != noone) target = _best; // нашли — берём в цель

    if (!instance_exists(target) || target.is_dead) // цель пропала или умерла
        target = noone;
}

// ── ДОИГРЫВАНИЕ АНИМАЦИИ АТАКИ + НАНЕСЕНИЕ УРОНА ──────────
function scr_enemy_continue_attack()
{
    if (!is_attacking) return;

    if (!attack_hit_done && image_index >= attack_hit_frame) // момент удара
    {
        if (instance_exists(target))
        {
            var _ax = target.x - x;
            var _ay = target.y - y;

            if (abs(_ax) <= attack_range && abs(_ay) <= attack_height)
            {
                if (!target.is_dead)
                    target.hp = max(target.hp - damage, 0); // бьём живого и не уходим в минус
            }
        }

        attack_hit_done = true; // не бьём повторно в этой анимации
    }

    if (image_index >= sprite_get_number(current_attack_sprite) - 1) // анимация атаки закончилась
    {
        is_attacking = false;
        attack_hit_done = false;
    }
}

// ── ПОВЕДЕНИЕ: ПОГОНЯ / АТАКА / БЛУЖДАНИЕ ─────────────────
// Возвращает желаемое движение по X (_move_x) для этого кадра.
function scr_enemy_behaviour()
{
    if (is_attacking) return 0; // во время удара стоим

    var _move_x = 0;

    if (instance_exists(target))
    {
        var _tx = target.x - x;
        var _ty = target.y - y;
        var _side = sign(_tx);

        if (abs(_tx) <= attack_range && abs(_ty) <= attack_height)
        {
            _move_x = 0; // в зоне удара — стоим и бьём

            if (attack_timer <= 0)
            {
                attack_timer = attack_speed;
                is_attacking = true;
                attack_hit_done = false;
                current_attack_sprite = choose(spr_attack_1, spr_attack_2, spr_attack_3);
                sprite_index = current_attack_sprite;
                image_index = 0;
                image_speed = 1;

                if (_side != 0) image_xscale = _side; // разворот к цели
            }
        }
        else
        {
            _move_x = _side * chase_speed; // бежим к игроку

            if (_side != 0) image_xscale = _side;
        }
    }
    else
    {
        // ── БЛУЖДАНИЕ ──
        wander_timer--;

        if (wander_timer <= 0)
        {
            wander_timer = irandom_range(60, 150);

            if (irandom(1)) wander_dir *= -1;
        }

        _move_x = wander_dir * wander_speed;
        image_xscale = wander_dir;

        var _look_x = x + sign(_move_x) * 20; // проверка пропасти впереди
        var _look_y = y + 40;

        if (!place_meeting(_look_x, _look_y, o_par_ground))
        {
            wander_dir *= -1; // разворот от обрыва
            _move_x = 0;
            wander_timer = irandom_range(30, 60);
        }
    }

    return _move_x;
}

// ── ГОРИЗОНТАЛЬНОЕ ДВИЖЕНИЕ ПОПИКСЕЛЬНО ───────────────────
function scr_enemy_apply_movement(_move_x)
{
    if (_move_x == 0) return;

    var _hstep = sign(_move_x);

    repeat (abs(round(_move_x)))
    {
        if (!place_meeting(x + _hstep, y, o_par_ground))
        {
            x += _hstep;
        }
        else
        {
            if (target == noone) // упёрлись во время блуждания
            {
                wander_dir *= -1;
                wander_timer = irandom_range(30, 60);
            }

            break;
        }
    }
}

// ── ГРАВИТАЦИЯ И ДВИЖЕНИЕ ПО Y ────────────────────────────
function scr_enemy_gravity()
{
    vsp += grav;

    if (vsp > max_fall_speed)
        vsp = max_fall_speed;

    if (vsp != 0)
    {
        var _vstep = sign(vsp);

        repeat (abs(round(vsp)))
        {
            if (!place_meeting(x, y + _vstep, o_par_ground))
                y += _vstep;
            else
            {
                vsp = 0;
                break;
            }
        }
    }
}

// ── АНИМАЦИЯ ДВИЖЕНИЯ ─────────────────────────────────────
function scr_enemy_animation(_move_x)
{
    if (is_attacking) return; // во время удара не трогаем

    if (instance_exists(target) && abs(_move_x) > 0)
    {
        if (sprite_index != spr_run)
        {
            sprite_index = spr_run;
            image_index = 0;
        }

        image_speed = 0.9; // бег
    }
    else if (!instance_exists(target) && abs(_move_x) > 0)
    {
        if (sprite_index != spr_walk)
        {
            sprite_index = spr_walk;
            image_index = 0;
        }

        image_speed = 0.6; // ходьба
    }
    else
    {
        if (sprite_index != spr_walk)
            sprite_index = spr_walk;

        image_speed = 0; // стойка (первый кадр walk)
        image_index = 0;
    }
}
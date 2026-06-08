// ═══════════════════════════════════════════════════════════
// scr_fireball_step() вызывается из Step объекта o_fireball.
// ═══════════════════════════════════════════════════════════
function scr_fireball_step()
{
    if (has_hit) return;

    x += lengthdir_x(speed_fireball, image_angle);
    y += lengthdir_y(speed_fireball, image_angle);
    distance_traveled += speed_fireball;

    if (fireball_gravity > 0)
    {
        if (!variable_instance_exists(id, "vsp_fireball")) vsp_fireball = 0;
        vsp_fireball += fireball_gravity;
        y += vsp_fireball;
        image_angle = point_direction(x - lengthdir_x(speed_fireball, image_angle), y - vsp_fireball, x, y);
    }

    if (x < -50 || x > room_width + 50 || y < -50 || y > room_height + 50)
    {
        instance_destroy();
        return;
    }

    if (place_meeting(x, y, o_par_ground))
    {
        has_hit = true;
        y += 2;
        alarm[0] = 120;
        return;
    }

    // ── ПОПАДАНИЕ ВО ВРАГА ──
    var _nearest = instance_nearest(x, y, o_enemy);
    if (instance_exists(_nearest) && _nearest != owner && !_nearest.is_dead)
    {
        var _dist = point_distance(x, y, _nearest.x, _nearest.y);
        if (_dist < 20)
        {
            _nearest.last_attacker = owner;
            _nearest.hp = max(_nearest.hp - damage, 0);

            if (_nearest.hp <= 0 && instance_exists(owner))
            {
                if (owner.target == _nearest) owner.target = noone;
            }

            has_hit = true;
            instance_destroy();
            return;
        }
    }

    // ── ПОПАДАНИЕ В ИГРОКА (PvP) ──
    var _p = instance_place(x, y, o_player);
    if (instance_exists(_p) && _p != owner && _p.hp > 0)
    {
        if (instance_exists(owner) && owner.in_pvp && _p.in_pvp)
        {
            _p.hp = max(_p.hp - damage, 0);

            if (_p.hp <= 0 && instance_exists(owner))
            {
                owner.gold += 50;
                if (variable_struct_exists(owner.class_attr_points, owner.class))
                    owner.class_attr_points[$ owner.class] += 1;

                scr_recalc_stats(owner);
                scr_chat_msg(owner, "убил @" + _p.username + "! +50 золота ⚔");

                _p.hp = _p.max_hp;
                _p.in_pvp = false;
                _p.x = 1300;
                _p.y = 95;

                scr_chat_msg(_p, "ты пал в бою. Возрождение в безопасной зоне.");

                scr_api_update(owner);
                scr_api_update(_p);
            }

            has_hit = true;
            instance_destroy();
            return;
        }
    }

    if (distance_traveled >= range)
        instance_destroy();
}
/// scr_update_player_sprites(_pl)
/// Устанавливает базовый спрайт (idle) при смене класса.
/// Вызывается из scr_reclass после изменения class.
///
/// ТВОИ СПРАЙТЫ МАГА УЖЕ В ПРОЕКТЕ:
///   spr_fire_wizard_idle
///   spr_fire_wizard_walk
///   spr_fire_wizard_run
///   spr_fire_wizard_attack_1
///   spr_fire_wizard_attack_2
///   spr_fire_wizard_charge
///   spr_fire_wizard_dead
///   spr_fire_wizard_fireball
///   spr_fire_wizard_flame_jet
///
/// Просто раскомментируй строку в case "mage" ниже.

function scr_update_player_sprites(_pl)
{
    switch (_pl.class)
    {
        case "warrior":
            // _pl.sprite_index = spr_player_idle;
            break;

        case "archer":
            // _pl.sprite_index = spr_archer_idle;
            break;

        case "wizard":
            // ═══════════════════════════════════════════════════
            //  ТВОЙ СПРАЙТ МАГА — раскомментируй эту строку:
            // ═══════════════════════════════════════════════════
            _pl.sprite_index = spr_fire_wizard_idle;
            break;
    }
}

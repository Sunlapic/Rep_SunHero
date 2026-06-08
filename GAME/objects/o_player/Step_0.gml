/// Player Step
scr_player_apply_class_sprites();
      if (scr_player_first_frame()) exit;
      scr_unstick_from_ground(8);
      if (scr_player_handle_death()) exit;

      // ── СКИЛ ── если кастуем — только гравитация, остальное пропускаем
      if (scr_player_handle_skills())
      {
          scr_player_movement();   // гравитация/коллизии работают
          exit;
      }

      scr_player_update_target();
      var _atk = scr_player_combat();
      scr_player_movement();
      scr_player_update_sprites(_atk);
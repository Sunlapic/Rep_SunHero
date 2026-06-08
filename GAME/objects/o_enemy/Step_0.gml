/// enemy Step
scr_enemy_first_frame();
scr_unstick_from_ground(8);
if (scr_enemy_handle_death()) exit;
scr_enemy_update_target();
scr_enemy_continue_attack();
var _move_x = scr_enemy_behaviour();
scr_enemy_apply_movement(_move_x);
scr_enemy_gravity();
scr_enemy_animation(_move_x);
var enemy_count = instance_number(o_enemy);

if (enemy_count < 10)
{
    instance_create_layer(
        irandom_range(100, 1200),
        irandom_range(100, 700),
        "Instances",
        o_enemy
    );
}



// перезапускаем alarm
alarm[0] = 300;
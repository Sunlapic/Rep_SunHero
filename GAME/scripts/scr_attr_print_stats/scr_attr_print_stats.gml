/// scr_attr_print_stats(_pl)
/// Печатает текущие характеристики игрока — для команды !stats.

function scr_attr_print_stats(_pl)
{
    scr_chat_msg(_pl,
        _pl.username +
        " | " + _pl.class +
        " lvl " + string(_pl.level) +
        " (XP " + string(_pl.experience) + "/" + string(_pl.exp_needed) + ")" +
        " | STR:" + string(_pl.strength) +
        " AGI:" + string(_pl.agility) +
        " INT:" + string(_pl.intellect) +
        " | HP:" + string(_pl.max_hp) +
        " DMG:" + string(_pl.damage) +
        " | Gold:" + string(_pl.gold) +
        " | Points(" + _pl.class + "):" + string(_pl.attr_points)
    );
}

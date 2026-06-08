/// scr_attr_spend_point(_pl, _stat, _amount)

function scr_attr_spend_point(_pl, _stat, _amount = 1)
{
    // ── защита ──
    if (!instance_exists(_pl)) return;

    if (!variable_instance_exists(_pl, "attr_points"))
        return;

    if (_pl.attr_points <= 0)
    {
        _scr_chat_msg_safe(_pl, "❌ " + _pl.username + ": нет свободных очков");
        return;
    }

    // ── нормализация ──
    _amount = max(1, floor(real(_amount)));
    _amount = min(_amount, _pl.attr_points);

    // ── применение стата ──
    switch (_stat)
    {
        case "str": _pl.strength += _amount; break;
        case "agi": _pl.agility += _amount; break;
        case "int": _pl.intellect += _amount; break;

        default:
            scr_chat_msg(_pl, "❌ неизвестный стат: " + string(_stat));
            return;
    }

    // ── списание очков ──
    _pl.attr_points -= _amount;

    // ── пересчёт статов ──
    if (asset_get_type("scr_recalc_stats") == asset_script)
        scr_recalc_stats(_pl);

    // ── флаг для MongoDB ──
    _pl.changed = true;

    // ── чат ──
    scr_chat_msg(_pl,
        "✅ " + _pl.username +
        " +" + string(_amount) + " " + string_upper(_stat) +
        " | STR:" + string(_pl.strength) +
        " AGI:" + string(_pl.agility) +
        " INT:" + string(_pl.intellect) +
        " | AP:" + string(_pl.attr_points)
    );
}

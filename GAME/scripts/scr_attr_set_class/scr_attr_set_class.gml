/// scr_attr_set_class(_pl, _class)
/// Бесплатная смена класса для новичков (active level == 1).

function scr_attr_set_class(_pl, _class)
{
    var _allowed = (_class == "warrior" ||
                    _class == "archer"  ||
                    _class == "wizard");
    if (!_allowed)
    {
        scr_chat_msg(_pl, "❌ Неизвестный класс: " + string(_class));
        return;
    }

    if (_pl.class == _class)
    {
        scr_chat_msg(_pl, "❌ Вы уже " + _class);
        return;
    }

    if (_pl.level > 1)
    {
        scr_chat_msg(_pl,
            "❌ !class только на 1 уровне. Используйте !reclass " + _class +
            " за 50 золота.");
        return;
    }

    // делегируем смену в общий scr_reclass — он корректно сохранит
    // и загрузит уровни/опыт по слотам каждого класса
    scr_reclass(_pl, _class);
}

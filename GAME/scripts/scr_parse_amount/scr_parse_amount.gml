/// scr_parse_amount(_trimmed, _cmd_with_space)
/// Извлекает число из команды чата.
/// _trimmed         — нижний регистр и обрезанные пробелы (например "!agi 10")
/// _cmd_with_space  — название команды с пробелом ("!agi ", "!str ", "!int ")
///
/// Возвращает целое число >= 1. Если аргумент отсутствует/некорректен — 1.

function scr_parse_amount(_trimmed, _cmd_with_space)
{
    var _cmd_len = string_length(_cmd_with_space);
    var _len     = string_length(_trimmed);

    // Команда без пробела ("!agi", "!str") — это значит "+1"
    if (_len <= _cmd_len) return 1;

    // Берём всё, что после "!agi "
    var _arg = string_copy(_trimmed, _cmd_len + 1, _len - _cmd_len);
    _arg = string_trim(_arg);

    if (_arg == "") return 1;

    // Защитимся от мусора: возьмём только первое "слово"
    var _sp = string_pos(" ", _arg);
    if (_sp > 0) _arg = string_copy(_arg, 1, _sp - 1);

    // Вручную проверяем, что все символы — цифры. Это надёжнее
    // чем полагаться на поведение real() со строками.
    var _arg_len = string_length(_arg);
    if (_arg_len == 0) return 1;
    for (var _i = 1; _i <= _arg_len; _i++)
    {
        var _c = string_char_at(_arg, _i);
        if (_c < "0" || _c > "9") return 1;
    }

    var _n = floor(real(_arg));
    if (_n < 1) _n = 1;
    return _n;
}

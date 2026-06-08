/// =============================================
/// o_main — Async - Networking Event
/// Здесь обрабатываем все события от TCP-сокета (connect, disconnect, data)
/// =============================================

// Получаем тип сетевого события
var _type = async_load[? "type"];

// Логируем тип события (для отладки)
show_debug_message("🔌 NETWORKING EVENT: type=" + string(_type));

// Вызываем функцию обработки IRC-событий
twitch_chat_async();
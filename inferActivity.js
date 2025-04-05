export function inferActivity({
  window_title = "",
  keys_pressed = [],
  mouse_clicks = 0,
}) {
  const title = window_title.toLowerCase();
  const keyCount = keys_pressed.length;

  // Caracteres típicos de programação
  const codingChars = ["{", "}", "(", ")", ";", "=", ".", "<", ">", "[", "]"];
  const codingKeys = keys_pressed.filter((k) => codingChars.includes(k)).length;
  const lettersCount = keys_pressed.filter((k) => /^[a-zA-Z]$/.test(k)).length;
  const browserTitles = ["chrome", "firefox", "edge", "opera", "brave"];

  // 1. Programando
  if (title.includes("code") || title.includes("vscode")) {
    if (codingKeys >= 5 || lettersCount >= 20) return "programando";
  }

  // 2. Em reunião
  if (title.includes("teams") || title.includes("microsoft teams")) {
    return "em reunião";
  }

  // 3. Jogando (Runescape)
  if (title.includes("runescape") || title.includes("runelite")) {
    return "jogando";
  }

  // 4. Chatting
  if (
    title.includes("discord") ||
    title.includes("whatsapp") ||
    title.includes("microsoft teams") ||
    title.includes("teams")
  ) {
    if (lettersCount > 15) return "chatting";
  }

  // 5. Assistindo
  const isBrowser = browserTitles.some((browser) => title.includes(browser));
  if (isBrowser && keyCount < 5 && mouse_clicks < 10) {
    return "assistindo";
  }

  // 6. Scroll
  if (isBrowser && keyCount < 5 && mouse_clicks >= 10) {
    return "scrolling";
  }

  // 7. Default
  return "atividade desconhecida";
}

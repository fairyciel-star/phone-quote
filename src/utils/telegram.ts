const BOT_TOKEN = import.meta.env.VITE_TELEGRAM_BOT_TOKEN ?? '';
const CHAT_ID = import.meta.env.VITE_TELEGRAM_CHAT_ID ?? '';

export async function sendTelegramNotification(message: string): Promise<boolean> {
  if (!BOT_TOKEN || !CHAT_ID) return false;

  try {
    const url = `https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: CHAT_ID,
        text: message,
        parse_mode: 'HTML',
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

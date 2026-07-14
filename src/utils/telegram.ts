// Telegram 알림은 봇 토큰 노출을 막기 위해 Supabase Edge Function(send-telegram)을 경유한다.
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

// 사용자 입력이 Telegram HTML 메시지(parse_mode: 'HTML')를 깨거나
// 태그를 주입하지 못하도록 특수문자를 이스케이프한다.
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendTelegramNotification(message: string): Promise<boolean> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return false;

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-telegram`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        apikey: SUPABASE_ANON_KEY,
      },
      body: JSON.stringify({ message }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

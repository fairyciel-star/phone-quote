// Supabase Edge Function: 상담/사전예약 Telegram 알림 전송 프록시
//
// 봇 토큰이 클라이언트 번들에 노출되지 않도록 서버에서만 Telegram API를 호출한다.
//
// 배포:
//   npx supabase functions deploy send-telegram
//   npx supabase secrets set TELEGRAM_BOT_TOKEN=... TELEGRAM_CHAT_ID=...
//
// 호출:
//   POST /functions/v1/send-telegram
//   Headers: Authorization: Bearer <anon key>
//   Body: { message: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const MAX_MESSAGE_LENGTH = 3500

// 인스턴스 생명주기 동안의 IP별 요청 제한 (완전하진 않지만 무차별 스팸 차단용)
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000
const RATE_LIMIT_MAX = 5
const requestLog = new Map<string, number[]>()

function isRateLimited(ip: string): boolean {
  const now = Date.now()
  const timestamps = (requestLog.get(ip) ?? []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS)
  if (timestamps.length >= RATE_LIMIT_MAX) {
    requestLog.set(ip, timestamps)
    return true
  }
  requestLog.set(ip, [...timestamps, now])
  return false
}

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  const botToken = Deno.env.get('TELEGRAM_BOT_TOKEN')
  const chatId = Deno.env.get('TELEGRAM_CHAT_ID')
  if (!botToken || !chatId) {
    return jsonResponse({ error: 'Telegram secrets not configured' }, 500)
  }

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown'
  if (isRateLimited(ip)) {
    return jsonResponse({ error: 'Too many requests' }, 429)
  }

  try {
    const { message } = await req.json()

    if (typeof message !== 'string' || message.trim() === '') {
      return jsonResponse({ error: 'message is required' }, 400)
    }
    if (message.length > MAX_MESSAGE_LENGTH) {
      return jsonResponse({ error: 'message too long' }, 400)
    }

    const res = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: 'HTML',
      }),
    })

    if (!res.ok) {
      const detail = await res.text()
      console.error('Telegram API error:', res.status, detail)
      return jsonResponse({ error: 'Telegram send failed' }, 502)
    }

    return jsonResponse({ ok: true }, 200)
  } catch (err) {
    console.error('send-telegram error:', err)
    return jsonResponse({ error: 'Invalid request' }, 400)
  }
})

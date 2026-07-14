// Supabase Edge Function: 단가표 이미지 → Claude Vision 파싱
//
// 배포:
//   npx supabase functions deploy parse-price-table
//   npx supabase secrets set ANTHROPIC_API_KEY=sk-ant-api03-...
//
// 호출:
//   POST /functions/v1/parse-price-table
//   Body: { image_base64: string, carrier: "SKT"|"KT"|"LGU", media_type: string }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': Deno.env.get('ALLOWED_ORIGIN') ?? '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// base64 문자열 기준 최대 크기 (~10MB 이미지)
const MAX_IMAGE_BASE64_LENGTH = 15_000_000

// 유료 API(Claude Vision)를 호출하는 함수이므로 관리자 로그인 세션(JWT)을 요구한다.
async function requireAuthenticatedUser(req: Request): Promise<boolean> {
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return false

  const supabaseUrl = Deno.env.get('SUPABASE_URL')
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY')
  if (!supabaseUrl || !anonKey) return false

  const supabase = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  })
  const { data, error } = await supabase.auth.getUser()
  return !error && !!data.user
}

const CARRIER_PROMPTS: Record<string, string> = {
  SKT: `이것은 SKT 대리점 단가표입니다.

**컬럼 구조 설명:**
- 표는 여러 요금제 구간으로 나뉩니다 (신규요금제등급팩, SGX표리더십, F_79구간, L_69구간 등)
- 각 구간마다 "010신규 / MNP / 기변" 3개의 하위 컬럼이 있습니다
- **반드시 첫 번째 구간("신규요금제등급팩 표준할인가")의 값만 추출하세요**
- 각 구간의 첫 번째 하위 컬럼이 "010신규", 두 번째가 "MNP", 세 번째가 "기변"입니다

**추출 규칙:**
1. 첫 번째 요금제 구간(가장 왼쪽 구간)의 010신규/MNP/기변 값만 사용하세요
2. 각 모델은 "공시" 행(위)과 "선택" 행(아래) 두 줄입니다
3. 숫자는 만원 단위 (예: 56 → 56만원)
4. 모델ID는 표 맨 왼쪽 열의 코드 (예: SM-S942N)
5. storage는 모델명 옆 또는 별도 열의 용량 (128G, 256G, 512G 등)
6. storage가 없는 모델은 ""로 표시
7. 출고가는 만원 단위 숫자

**주의사항:**
- 각 모델의 공시 행(위)과 선택 행(아래)이 세트입니다
- 기변 컬럼은 MNP 컬럼 바로 오른쪽입니다
- 각 구간의 컬럼 순서: [010신규] [MNP] [기변]
- 모델ID의 숫자를 정확히 읽으세요

**출력 형식 (JSON만 출력, 다른 텍스트 없이):**
{
  "carrier": "SKT",
  "plan_tier": "고가",
  "models": [
    {
      "model_id": "SM-S942N",
      "storage": "128G",
      "retail_price": 125.4,
      "공시": { "신규": 3, "MNP": 56, "기변": 63 },
      "선택": { "신규": 28, "MNP": 56, "기변": 58 }
    }
  ]
}`,

  KT: `이것은 KT 대리점 단가표입니다.

**추출 규칙:**
1. 첫 번째/고가 구간 컬럼만 추출하세요
2. 각 모델은 "공시" 행과 "선택" 행 두 줄입니다
3. 컬럼: 010신규, MNP(번호이동), 기변(기기변경)
4. 숫자는 만원 단위
5. 모델ID는 표 맨 왼쪽 코드

**출력 형식 (JSON만 출력):**
{
  "carrier": "KT",
  "plan_tier": "고가",
  "models": [
    {
      "model_id": "SM-S942NK",
      "storage": "128G",
      "retail_price": 125.4,
      "공시": { "신규": 20, "MNP": 56, "기변": 51 },
      "선택": { "신규": 20, "MNP": 56, "기변": 51 }
    }
  ]
}`,

  LGU: `이것은 LGU+(유플러스) 대리점 단가표입니다.

**추출 규칙:**
1. "[0구간]" 또는 첫 번째/고가 구간 컬럼만 추출하세요
2. 각 모델은 "공시" 행과 "선택" 행 두 줄입니다
3. 컬럼: 010신규, MNP(번호이동), 기변(기기변경)
4. 숫자는 만원 단위
5. 모델ID는 표 맨 왼쪽 코드

**출력 형식 (JSON만 출력):**
{
  "carrier": "LGU",
  "plan_tier": "고가",
  "models": [
    {
      "model_id": "UIP17E-256AF",
      "storage": "256G",
      "retail_price": 93.0,
      "공시": { "신규": 20, "MNP": 58, "기변": 34 },
      "선택": { "신규": 20, "MNP": 58, "기변": 34 }
    }
  ]
}`,
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (!(await requireAuthenticatedUser(req))) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: admin login required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { image_base64, carrier, media_type } = await req.json()

    if (typeof image_base64 !== 'string' || image_base64.length === 0) {
      return new Response(
        JSON.stringify({ error: 'image_base64 is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    if (image_base64.length > MAX_IMAGE_BASE64_LENGTH) {
      return new Response(
        JSON.stringify({ error: 'image too large' }),
        { status: 413, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const apiKey = Deno.env.get('ANTHROPIC_API_KEY')
    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const prompt = CARRIER_PROMPTS[carrier]
    if (!prompt) {
      return new Response(
        JSON.stringify({ error: `Unknown carrier: ${carrier}` }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 8192,
        messages: [{
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: media_type || 'image/jpeg', data: image_base64 },
            },
            { type: 'text', text: prompt },
          ],
        }],
      }),
    })

    const result = await response.json()

    if (!response.ok) {
      return new Response(
        JSON.stringify({ error: result.error?.message || 'API call failed' }),
        { status: response.status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const rawText = result.content?.[0]?.text ?? ''
    const jsonMatch = rawText.match(/```json\s*([\s\S]*?)```/) ?? rawText.match(/(\{[\s\S]*\})/)
    const jsonStr = jsonMatch ? jsonMatch[1] : rawText

    const parsed = JSON.parse(jsonStr.trim())

    return new Response(
      JSON.stringify(parsed),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

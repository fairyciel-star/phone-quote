// KakaoAlertBanner.tsx
// 만나픽 카카오 가격 알림 배너 컴포넌트
// 사용 위치: 기기선택 페이지(4페이지) 상단

import { useEffect, useRef } from 'react'

interface KakaoAlertBannerProps {
  /** 배너 닫기 버튼 클릭 시 (옵션: X버튼 추가할 경우 사용) */
  onClose?: () => void
  /** "받기" 버튼 클릭 시 실행할 함수 */
  onConfirm?: () => void
  /** 배너 표시 여부 */
  visible?: boolean
}

export default function KakaoAlertBanner({
  onConfirm,
  visible = true,
}: KakaoAlertBannerProps) {
  const bellRef = useRef<HTMLDivElement>(null)

  // 카카오 아이콘 흔들림 애니메이션 (CSS keyframes → JS로 동일 구현)
  useEffect(() => {
    if (!bellRef.current) return
    const el = bellRef.current
    const style = document.createElement('style')
    style.textContent = `
      @keyframes mp-bell {
        0%, 70%, 100% { transform: rotate(0deg); }
        80%            { transform: rotate(11deg); }
        90%            { transform: rotate(-9deg); }
      }
      .mp-bell-anim {
        animation: mp-bell 3.5s ease-in-out infinite;
        transform-origin: top center;
      }
    `
    document.head.appendChild(style)
    el.classList.add('mp-bell-anim')
    return () => {
      document.head.removeChild(style)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      style={{
        // 외부 컨테이너: 가로 꽉 차게, 기기선택 페이지 상단에 배치
        width: '100%',
        padding: '12px 16px',
        backgroundColor: '#F5F5F5', // 페이지 배경색에 맞게 조정
      }}
    >
      <div
        style={{
          borderRadius: 16,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          backgroundColor: '#FFFFFF',
          boxShadow: '0 1px 6px rgba(0,0,0,0.08)',
          fontFamily:
            '"Pretendard Variable", -apple-system, "Apple SD Gothic Neo", system-ui, sans-serif',
        }}
      >
        {/* 카카오 채팅 아이콘 */}
        <div
          ref={bellRef}
          style={{
            width: 42,
            height: 42,
            flexShrink: 0,
            borderRadius: 12,
            backgroundColor: '#FAE100',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <svg width="21" height="21" viewBox="0 0 24 24" fill="#3A1D1D">
            <path d="M12 3C7 3 3 6.3 3 10.4c0 2.6 1.7 4.9 4.3 6.2-.2.7-.7 2.4-.8 2.8 0 0-.02.1.05.16.07.05.15.02.15.02.2-.03 2.5-1.65 3.5-2.34.6.08 1.2.13 1.8.13 5 0 9-3.3 9-7.4S17 3 12 3z" />
          </svg>
        </div>

        {/* 텍스트 영역 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: '#B0241A',
              lineHeight: 1.3,
            }}
          >
            지금 가격이 아쉬우신가요?
          </div>
          <div
            style={{
              fontWeight: 500,
              color: '#16181D',
              marginTop: 3,
              fontSize: 12.6,
              lineHeight: 1.4,
              whiteSpace: 'normal',
              wordBreak: 'keep-all',
            }}
          >
            가격변동 알림 받기
          </div>
        </div>

        {/* 받기 버튼 */}
        <button
          onClick={onConfirm}
          style={{
            fontSize: 13.5,
            fontWeight: 800,
            color: '#1A1A1A',
            whiteSpace: 'nowrap',
            backgroundColor: '#FAE100',
            borderRadius: 11,
            padding: '11px 16px',
            border: 'none',
            cursor: 'pointer',
            flexShrink: 0,
            fontFamily: 'inherit',
            transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => ((e.target as HTMLButtonElement).style.opacity = '0.8')}
          onMouseLeave={e => ((e.target as HTMLButtonElement).style.opacity = '1')}
        >
          받기
        </button>
      </div>
    </div>
  )
}

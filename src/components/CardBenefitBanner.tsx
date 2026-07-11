// CardBenefitBanner.tsx
// 제휴카드 혜택 적용가 배너 컴포넌트
// 사용 위치: 기기선택 페이지(4페이지) 카카오 배너 바로 아래
// 클릭 시 전체 기기 가격에 제휴카드 혜택 할인을 적용/해제

interface CardBenefitBannerProps {
  /** 카드 혜택이 현재 적용된 상태인지 */
  active: boolean
  /** 배너 클릭 시 실행할 함수 (혜택 적용/해제 토글) */
  onClick: () => void
}

export default function CardBenefitBanner({ active, onClick }: CardBenefitBannerProps) {
  return (
    <div
      style={{
        width: '100%',
        padding: '0 16px 12px',
        backgroundColor: '#F5F5F5',
      }}
    >
      <button
        onClick={onClick}
        style={{
          width: '100%',
          border: 'none',
          cursor: 'pointer',
          borderRadius: 16,
          padding: '14px 16px',
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          background: 'linear-gradient(90deg, #C92819 0%, #FF8A1E 100%)',
          boxShadow: '0 1px 6px rgba(0,0,0,0.12)',
          fontFamily:
            '"Pretendard Variable", -apple-system, "Apple SD Gothic Neo", system-ui, sans-serif',
          textAlign: 'left',
          transition: 'opacity 0.15s',
        }}
        onMouseEnter={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '0.9')}
        onMouseLeave={e => ((e.currentTarget as HTMLButtonElement).style.opacity = '1')}
      >
        {/* 카드+퍼센트 아이콘 */}
        <div style={{ position: 'relative', width: 42, height: 42, flexShrink: 0 }}>
          <div
            style={{
              width: 42,
              height: 42,
              borderRadius: 12,
              backgroundColor: 'rgba(255,255,255,0.22)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
            }}
          >
            💳
          </div>
          <div
            style={{
              position: 'absolute',
              bottom: -4,
              left: -4,
              width: 18,
              height: 18,
              borderRadius: '50%',
              backgroundColor: '#FFD600',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
              fontWeight: 800,
              color: '#A01E12',
            }}
          >
            %
          </div>
        </div>

        {/* 텍스트 영역 */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 15,
              fontWeight: 800,
              color: '#FFFFFF',
              lineHeight: 1.3,
            }}
          >
            {active ? '제휴카드 혜택 적용중이에요!' : '혜택 적용하면 얼마까지 내려갈까?'}
          </div>
          <div
            style={{
              fontWeight: 500,
              color: 'rgba(255,255,255,0.92)',
              marginTop: 3,
              fontSize: 12.6,
              lineHeight: 1.4,
              whiteSpace: 'normal',
              wordBreak: 'keep-all',
            }}
          >
            {active ? '탭하면 원래 가격으로 돌아가요' : '제휴카드 적용 가격 바로 보기'}
          </div>
        </div>

        {/* 우측 화살표 / 체크 */}
        <div
          style={{
            width: 26,
            height: 26,
            flexShrink: 0,
            borderRadius: '50%',
            backgroundColor: 'rgba(255,255,255,0.22)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#FFFFFF',
            fontSize: active ? 13 : 15,
            fontWeight: 800,
          }}
        >
          {active ? '✓' : '›'}
        </div>
      </button>
    </div>
  )
}

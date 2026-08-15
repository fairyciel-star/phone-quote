/** 매장 정보 — 상담신청(6스텝) 하단 매장 위치·문의 링크에서 사용한다. */

export interface StoreInfo {
  readonly name: string;
  readonly hours: string;
  readonly addr: string;
  readonly phone: string;
  readonly kakaoUrl: string;
  /** 이동통신 사전승낙서(한국정보통신진흥협회) 조회 링크 */
  readonly preconUrl: string;
}

export const STORE: StoreInfo = {
  name: '동네휴대폰마트',
  hours: '매일 10:00 – 20:00 · 공휴일 11:00 – 19:00',
  addr: '경기 부천시 오정구 삼작로 385 1층 동네휴대폰마트',
  phone: '010-5627-9993',
  kakaoUrl: 'https://pf.kakao.com/_xmpfxcn',
  preconUrl:
    'https://ictmarket.or.kr:8443/precon/pop_CertIcon.do?PRECON_REQ_ID=PRE0000194989&YN=1',
};

export interface MapLinks {
  readonly kakao: string;
  readonly naver: string;
}

/** 지도 앱 딥링크. 모바일에서 앱이 있으면 앱으로, 없으면 웹 지도로 열린다. */
export function mapLinks(store: StoreInfo): MapLinks {
  const query = encodeURIComponent(store.addr || store.name);
  return {
    kakao: `https://map.kakao.com/link/search/${query}`,
    naver: `https://map.naver.com/p/search/${query}`,
  };
}

/** tel: 링크용 — 숫자와 +만 남긴다 */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^0-9+]/g, '')}`;
}

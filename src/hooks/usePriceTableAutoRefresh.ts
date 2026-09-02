import { useEffect } from 'react';
import { usePriceTableStore } from '../store/usePriceTableStore';

/**
 * 마지막 로드 이후 이만큼 지나야 다시 불러온다.
 * 탭을 잠깐씩 오갈 때마다 시트를 때리지 않기 위한 쿨다운.
 */
const REFRESH_COOLDOWN_MS = 5 * 60 * 1000;

/** 마지막 로드 이후 쿨다운이 지났는지. 로드 이력이 없거나 값이 깨졌으면 갱신 대상으로 본다. */
function isStale(lastLoaded: string | null, now: number): boolean {
  if (!lastLoaded) return true;
  const loadedAt = Date.parse(lastLoaded);
  if (Number.isNaN(loadedAt)) return true;
  return now - loadedAt >= REFRESH_COOLDOWN_MS;
}

/**
 * 앱으로 돌아왔을 때 단가표(구글시트)를 다시 불러온다.
 *
 * 모바일 브라우저는 탭을 오래 방치하면 페이지를 얼렸다가 리로드 없이 복원한다.
 * 그러면 App 의 마운트 effect 가 다시 실행되지 않아 시트 데이터가
 * 처음 열었던 시점에 멈춘다. 복귀 시점을 직접 잡아서 갱신한다.
 *
 * - visibilitychange: 탭 전환·화면 잠금 해제 후 복귀
 * - pageshow(persisted): 뒤로가기·bfcache 복원
 *
 * 갱신 중에도 기존 행을 지우지 않으므로(loadAll 은 성공한 통신사만 교체한다)
 * 화면이 빈 상태로 깜빡이지 않는다.
 */
export function usePriceTableAutoRefresh(sheetId: string): void {
  useEffect(() => {
    const refreshIfStale = () => {
      // 핸들러 시점의 최신 상태를 직접 읽는다 (effect 클로저에 값을 가두지 않는다)
      const { loading, lastLoaded, loadAll } = usePriceTableStore.getState();
      // 이미 불러오는 중이면 중복 요청하지 않는다.
      // visibilitychange 와 pageshow 가 함께 발생해도 여기서 걸러진다.
      if (loading) return;
      if (!isStale(lastLoaded, Date.now())) return;
      loadAll(sheetId);
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') refreshIfStale();
    };
    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) refreshIfStale();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('pageshow', handlePageShow);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('pageshow', handlePageShow);
    };
  }, [sheetId]);
}

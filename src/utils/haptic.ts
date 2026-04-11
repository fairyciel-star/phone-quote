// 햅틱 피드백 유틸리티 (Vibration API)
// 모바일 기기에서 선택 시 진동 피드백 제공

export function hapticLight() {
  if (navigator.vibrate) {
    navigator.vibrate(10);
  }
}

export function hapticMedium() {
  if (navigator.vibrate) {
    navigator.vibrate(20);
  }
}

export function hapticHeavy() {
  if (navigator.vibrate) {
    navigator.vibrate(40);
  }
}

export function hapticSuccess() {
  if (navigator.vibrate) {
    navigator.vibrate([15, 50, 15]);
  }
}

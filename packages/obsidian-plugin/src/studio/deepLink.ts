// deepLink.ts (옵시디언 shim) — Tauri deep-link 이벤트는 옵시디언 환경에서
// 의미 없음. ManuscriptStudioView 는 옵시디언 명령어 / 카드 클릭 / view state
// (projectFolder) 로 이미 프로젝트를 식별한다. 따라서 이 모듈은 호출 site
// 호환을 위한 빈 구현만 제공한다.

export interface DeepLinkPayload {
  vault: string;
  project: string;
}

export function parseDeepLinkUrl(_raw: string): DeepLinkPayload | null {
  return null;
}

export async function onDeepLink(
  _cb: (payload: DeepLinkPayload) => void,
): Promise<() => void> {
  return () => {
    /* no-op */
  };
}

export async function getInitialDeepLinks(): Promise<DeepLinkPayload[]> {
  return [];
}

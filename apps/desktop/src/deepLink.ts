// deepLink.ts — Tauri의 `deep-link:open` 이벤트 구독 + URL 파싱.
//
// URL 스킴: ai-manuscript-studio://open?vault=<path>&project=<slug>
// (참고: plan 1.4)
//
// Rust 측이 파싱된 URL 문자열을 그대로 emit하므로 프론트에서 한 번 더
// `URL` API를 통과시켜 안전하게 query를 추출한다.

import { listen } from "@tauri-apps/api/event";
import { getCurrent as getCurrentDeepLinks } from "@tauri-apps/plugin-deep-link";

export interface DeepLinkPayload {
  vault: string;
  project: string;
}

export interface RawDeepLinkEvent {
  url: string;
}

const SCHEME = "ai-manuscript-studio:";

export function parseDeepLinkUrl(raw: string): DeepLinkPayload | null {
  // Tauri가 넘기는 URL 문자열은 보통 표준 URL이지만,
  // 일부 OS에서는 인코딩이 빠져 들어올 수 있어 안전하게 시도만 한다.
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    return null;
  }

  if (parsed.protocol !== SCHEME) return null;

  // host 또는 pathname 첫 세그먼트가 "open"이어야 함.
  const action = parsed.host || parsed.pathname.replace(/^\//, "");
  if (action !== "open") return null;

  const vault = parsed.searchParams.get("vault");
  const project = parsed.searchParams.get("project");
  if (!vault || !project) return null;

  return { vault, project };
}

export async function onDeepLink(
  cb: (payload: DeepLinkPayload) => void,
): Promise<() => void> {
  const unlisten = await listen<RawDeepLinkEvent>("deep-link:open", (msg) => {
    const parsed = parseDeepLinkUrl(msg.payload.url);
    if (parsed) cb(parsed);
  });
  return unlisten;
}

/**
 * cold-launch (앱이 이번 실행에서 처음 부팅될 때) URL 회수.
 * Rust setup()이 emit한 이벤트가 React listener 등록 전에 발생하면
 * 그 이벤트는 lost 된다. 그래서 mount 후 plugin이 노출하는 getCurrent()로
 * URL을 한 번 더 직접 가져와 처리한다.
 */
export async function getInitialDeepLinks(): Promise<DeepLinkPayload[]> {
  try {
    const urls = await getCurrentDeepLinks();
    if (!urls || urls.length === 0) return [];
    const out: DeepLinkPayload[] = [];
    for (const u of urls) {
      const parsed = parseDeepLinkUrl(u);
      if (parsed) out.push(parsed);
    }
    return out;
  } catch {
    // plugin이 없거나 권한 부족 — 무시
    return [];
  }
}

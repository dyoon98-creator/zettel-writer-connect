// selectionResultCache.ts — 액션별 마지막 AI 결과 캐시.
//
// 사용자 정책 (2026-05-17):
//   "비유 메뉴 호출 → 결과 → 다른 selection 으로 비유 메뉴 다시 호출 →
//    그 이전 결과를 그대로 보여줘. 다른 selection 이어도. 사용자가 보고
//    '다시 분석' 누를지 판단."
//
// 따라서 캐시 키는 action.id 한 개. selection text 는 의도적으로 포함 안 함.
// (이전 결과 영영 안 보고 싶으면 '다시 분석' 버튼으로 덮어씀.)
//
// 영구화: localStorage 의 단일 키. JSON serializable.

const STORAGE_KEY = "ams.selection-result-cache.v1";
const MAX_ENTRIES = 200;

export interface CachedResult {
  fullText: string;
  durationMs: number;
  timestampMs: number;
  /** 디버깅·표시용: 캐시 생성 시점의 선택 텍스트 (앞 80자 trim). */
  selectionPreview?: string;
}

interface CacheStore {
  [key: string]: CachedResult;
}

function load(): CacheStore {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as CacheStore;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function save(store: CacheStore): void {
  try {
    const entries = Object.entries(store);
    // 200 개 초과 시 오래된 순으로 자름.
    if (entries.length > MAX_ENTRIES) {
      entries.sort((a, b) => a[1].timestampMs - b[1].timestampMs);
      const keep = entries.slice(-MAX_ENTRIES);
      const trimmed: CacheStore = {};
      for (const [k, v] of keep) trimmed[k] = v;
      globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(trimmed));
      return;
    }
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {
    /* localStorage quota exceeded — silent */
  }
}

/** 캐시 키 = action.id 만. selection / provider / binaryPath 무관. */
export function makeKey(actionId: string): string {
  return actionId;
}

export function getCached(key: string): CachedResult | null {
  const store = load();
  return store[key] ?? null;
}

export function setCached(key: string, result: CachedResult): void {
  const store = load();
  store[key] = result;
  save(store);
}

export function clearCached(key: string): void {
  const store = load();
  delete store[key];
  save(store);
}

export function clearAll(): void {
  try {
    globalThis.localStorage?.removeItem(STORAGE_KEY);
  } catch {
    /* swallow */
  }
}

// selectionResultCache.ts — selection × action 별 AI 결과 캐시.
//
// 사용자가 같은 선택 + 같은 액션으로 다시 메뉴를 열면 자동 분석 안 하고
// 캐시된 결과를 즉시 보여준다. 사용자가 명시적으로 "다시 분석" 누를 때만
// 새로 호출.
//
// 캐시 키: actionId + selection.trim() + provider + binaryPath.
// 영구화: localStorage 의 단일 키. JSON serializable.

const STORAGE_KEY = "ams.selection-result-cache.v1";
const MAX_ENTRIES = 200;

export interface CachedResult {
  fullText: string;
  durationMs: number;
  timestampMs: number;
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

/** djb2 hash — selection text 가 길어도 일정 길이 키로 압축. */
function hashString(s: string): string {
  let h = 5381;
  for (let i = 0; i < s.length; i++) {
    h = (h * 33) ^ s.charCodeAt(i);
  }
  // unsigned 32bit hex
  return (h >>> 0).toString(16);
}

export function makeKey(
  actionId: string,
  selection: string,
  provider: string,
  binaryPath: string,
): string {
  const norm = selection.trim().replace(/\s+/g, " ");
  return `${actionId}::${provider}::${hashString(binaryPath)}::${hashString(norm)}::${norm.length}`;
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

// 색상 검증 — Status/Label 의 color 필드에 사용.
//
// 허용:
//   - #RGB, #RRGGBB (대소문자 모두 OK)
//   - 작은 CSS 명명 색상 allowlist
//
// 비허용:
//   - rgb(), hsl() 등 함수 표기
//   - 알파 채널 (#RRGGBBAA)
//   - 임의의 문자열

const NAMED_COLORS: ReadonlySet<string> = new Set([
  "black",
  "white",
  "red",
  "green",
  "blue",
  "yellow",
  "cyan",
  "magenta",
  "gray",
  "grey",
  "orange",
  "purple",
  "pink",
  "brown",
  "lime",
  "navy",
  "teal",
  "olive",
  "maroon",
  "silver",
  "gold",
  "indigo",
  "violet",
  "transparent",
]);

const HEX_RE = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export function isValidColor(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  if (s === "") return false;
  if (HEX_RE.test(s)) return true;
  if (NAMED_COLORS.has(s.toLowerCase())) return true;
  return false;
}

export function assertValidColor(v: unknown, label = "color"): string {
  if (!isValidColor(v)) {
    throw new Error(`${label}: 유효하지 않은 색상 형식입니다 (${String(v)})`);
  }
  return v;
}

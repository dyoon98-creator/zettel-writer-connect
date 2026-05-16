// findBinary.ts — Tauri 의 ai_find_binary 를 Node fs 로 대체.
//
// GUI 앱은 launchd 의 짧은 PATH 만 가져 nvm/homebrew 가 안 보이는 문제가
// 있다. 옵시디언 데스크톱은 Electron 이라 같은 문제를 공유한다. 그래서
// 1) 기본 PATH 검색을 시도하고, 2) 실패하면 알려진 후보 위치를 직접 stat
// 한다. zsh login shell 호출은 GUI 앱에서 비용/지연이 커서 생략.

import { electronRequire } from "./electronBridge";

const KNOWN_PREFIXES: readonly string[] = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
  // pnpm / volta / mise / asdf 의 default shim 위치들.
  // 사용자의 홈 디렉토리는 process.env.HOME 으로 시도.
];

function homeDir(): string | null {
  const env = electronRequire<{ env: Record<string, string | undefined> }>(
    "process",
  );
  return env?.env.HOME ?? null;
}

function pathEnv(): string[] {
  const proc = electronRequire<{ env: Record<string, string | undefined> }>(
    "process",
  );
  const path = proc?.env.PATH ?? "";
  return path.split(":").filter(Boolean);
}

/** binary 이름으로 가장 그럴듯한 절대경로를 반환. 없으면 빈 문자열. */
export async function findBinary(name: string): Promise<string> {
  const fs = electronRequire<typeof import("node:fs")>("node:fs") ??
    electronRequire<typeof import("fs")>("fs");
  if (!fs) return "";

  const home = homeDir();
  const candidates: string[] = [];
  for (const p of pathEnv()) candidates.push(`${p}/${name}`);
  for (const p of KNOWN_PREFIXES) candidates.push(`${p}/${name}`);
  if (home) {
    candidates.push(`${home}/.local/bin/${name}`);
    candidates.push(`${home}/.cargo/bin/${name}`);
    candidates.push(`${home}/.bun/bin/${name}`);
    candidates.push(`${home}/.volta/bin/${name}`);
  }

  for (const cand of candidates) {
    try {
      const stat = fs.statSync(cand);
      if (stat.isFile()) return cand;
    } catch {
      /* not present */
    }
  }
  return "";
}

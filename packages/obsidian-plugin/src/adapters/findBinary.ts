// findBinary.ts — Tauri 의 ai_find_binary 를 Node fs 로 대체.
//
// 핵심 어려움: 옵시디언은 macOS GUI 앱으로 시작되어 launchd 의 짧은 PATH
// (보통 /usr/bin:/bin:/usr/sbin:/sbin) 만 상속받는다. 사용자가 zsh/.zshrc
// 에서 PATH 에 nvm/homebrew/cargo 등을 추가했더라도 GUI 환경에는 안 보인다.
// 그래서 login shell 을 한 번 spawn 해 진짜 PATH 를 가져온 뒤 캐싱한다.

import { electronRequire } from "./electronBridge";

const KNOWN_PREFIXES: readonly string[] = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
];

let cachedExpandedPath: string[] | null = null;

function homeDir(): string | null {
  const proc = electronRequire<{ env: Record<string, string | undefined> }>(
    "process",
  );
  return proc?.env.HOME ?? null;
}

function rawPathEnv(): string[] {
  const proc = electronRequire<{ env: Record<string, string | undefined> }>(
    "process",
  );
  const path = proc?.env.PATH ?? "";
  return path.split(":").filter(Boolean);
}

/** zsh/bash login shell 을 한 번 spawn 해 진짜 사용자 PATH 를 얻는다. 1회 캐시. */
function getExpandedPath(): string[] {
  if (cachedExpandedPath) return cachedExpandedPath;

  const cp = electronRequire<typeof import("node:child_process")>(
    "node:child_process",
  ) ?? electronRequire<typeof import("child_process")>("child_process");
  const proc = electronRequire<{ env: Record<string, string | undefined> }>(
    "process",
  );
  const shell = proc?.env.SHELL ?? "/bin/zsh";

  if (cp) {
    try {
      const out = cp.execSync(`${shell} -ilc 'echo -n $PATH'`, {
        timeout: 2000,
        encoding: "utf8",
      });
      const list = out.trim().split(":").filter(Boolean);
      if (list.length > 0) {
        cachedExpandedPath = list;
        return list;
      }
    } catch {
      /* fall through to raw PATH */
    }
  }
  const raw = rawPathEnv();
  cachedExpandedPath = raw;
  return raw;
}

/** nvm 의 모든 node 버전 bin 디렉토리를 동적으로 수집. */
function nvmDirs(home: string): string[] {
  const fs = electronRequire<typeof import("node:fs")>("node:fs") ??
    electronRequire<typeof import("fs")>("fs");
  if (!fs) return [];
  const out: string[] = [];
  try {
    const versionsDir = `${home}/.nvm/versions/node`;
    const entries = fs.readdirSync(versionsDir);
    for (const e of entries) out.push(`${versionsDir}/${e}/bin`);
  } catch {
    /* nvm 없음 */
  }
  return out;
}

/** binary 이름으로 가장 그럴듯한 절대경로를 반환. 없으면 빈 문자열. */
export async function findBinary(name: string): Promise<string> {
  const fs = electronRequire<typeof import("node:fs")>("node:fs") ??
    electronRequire<typeof import("fs")>("fs");
  if (!fs) return "";

  const home = homeDir();
  const candidates: string[] = [];

  // 1) login shell 로 확장된 PATH (사용자 .zshrc 반영)
  for (const p of getExpandedPath()) candidates.push(`${p}/${name}`);

  // 2) raw process.env.PATH (GUI launchd 단축 PATH 도 포함될 수 있음)
  for (const p of rawPathEnv()) candidates.push(`${p}/${name}`);

  // 3) 알려진 시스템 prefix
  for (const p of KNOWN_PREFIXES) candidates.push(`${p}/${name}`);

  // 4) 홈 디렉토리의 알려진 toolchain 위치들
  if (home) {
    candidates.push(`${home}/.local/bin/${name}`);
    candidates.push(`${home}/.cargo/bin/${name}`);
    candidates.push(`${home}/.bun/bin/${name}`);
    candidates.push(`${home}/.volta/bin/${name}`);
    // nvm — 모든 node 버전의 bin dir 동적 등록
    for (const dir of nvmDirs(home)) candidates.push(`${dir}/${name}`);
  }

  // 5) 흔한 GUI 앱 번들 bin (cmux 등)
  candidates.push(`/Applications/cmux.app/Contents/Resources/bin/${name}`);

  // dedup + 첫 매치 반환
  const seen = new Set<string>();
  for (const cand of candidates) {
    if (seen.has(cand)) continue;
    seen.add(cand);
    try {
      const stat = fs.statSync(cand);
      if (stat.isFile()) return cand;
    } catch {
      /* not present */
    }
  }
  return "";
}

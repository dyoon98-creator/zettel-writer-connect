// findBinary.ts — Tauri 의 ai_find_binary 를 Node fs 로 대체.
//
// 핵심 어려움: 옵시디언은 macOS GUI 앱으로 시작되어 launchd 의 짧은 PATH
// (보통 /usr/bin:/bin:/usr/sbin:/sbin) 만 상속받는다. 사용자가 zsh/.zshrc
// 에서 PATH 에 nvm/homebrew/cargo 등을 추가했더라도 GUI 환경에는 안 보인다.
// 그래서 login shell 을 한 번 spawn 해 진짜 PATH 를 가져온 뒤 캐싱한다.
//
// 2026-08-31 실측 — 이 probe 가 «조용히» 실패하면 codex 가 exit 127
// (`env: node: No such file or directory`) 로 죽는다. codex 는
// `#!/usr/bin/env node` 스크립트라서, 찾아낸 codex 경로가 맞아도 PATH 에
// node 가 없으면 실행이 안 된다. 실패 경로 셋을 각각 막았다.
//
//   ① probe 가 느려서 timeout — `zsh -ilc` 는 이 기계에서 958~1755ms 가
//      걸렸고 상한이 2000ms 였다. 옵시디언 시작·색인 중이면 그냥 넘긴다.
//      `-lc`(login·비대화) 가 같은 PATH 를 111ms 에 주므로 그것을 먼저 쓰고,
//      결과에 node 가 없을 때만 `-ilc` 로 올린다. 상한도 10s 로 올렸다.
//   ② 실패를 영구 캐시 — 한 번 실패하면 세션 내내 짧은 PATH 를 썼다.
//      실패는 캐시하지 않고 PROBE_MAX_ATTEMPTS 회까지 다시 시도한다.
//   ③ probe 가 아예 안 되는 환경 — 셸이 없거나 막힌 경우. 이때도 node 만은
//      보이도록 정적 후보 디렉터리에서 찾아 PATH 앞에 붙인다
//      (`ensureNodeVisible`). 이것이 마지막 방어선이다.

import { electronRequire } from "./electronBridge";

const KNOWN_PREFIXES: readonly string[] = [
  "/opt/homebrew/bin",
  "/usr/local/bin",
  "/usr/bin",
  "/bin",
];

/** probe 실패 시 재시도 상한. 매번 재시도하면 실패 환경에서 10s 씩 멈춘다. */
const PROBE_MAX_ATTEMPTS = 2;
/** login shell probe 상한(ms). `-ilc` 는 이 기계에서 최대 1755ms 걸렸다. */
const PROBE_TIMEOUT_MS = 10_000;

let cachedExpandedPath: string[] | null = null;
let probeAttempts = 0;
let cachedPathString: string | null = null;

/**
 * PATH 문자열 형태로 반환 — child_process.spawn 의 env.PATH 에 그대로 쓸 수 있다.
 * node 가 반드시 보이도록 보정한 뒤 돌려준다.
 */
export function getExpandedPathString(): string {
  if (cachedPathString !== null) return cachedPathString;
  const s = ensureNodeVisible(getExpandedPath()).join(":");
  // probe 가 성공해 확정된 경우에만 문자열도 캐시한다.
  if (cachedExpandedPath) cachedPathString = s;
  return s;
}

/** 테스트 전용 — 모듈 캐시를 비운다. */
export function __resetPathCacheForTest(): void {
  cachedExpandedPath = null;
  cachedPathString = null;
  probeAttempts = 0;
}

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

/**
 * zsh/bash login shell 을 한 번 spawn 해 진짜 사용자 PATH 를 얻는다.
 *
 * 성공만 캐시한다. 실패를 캐시하면 세션 내내 짧은 PATH 를 쓰게 되어, 한 번
 * 느렸을 뿐인 기계에서 codex 가 계속 exit 127 로 죽는다 (2026-08-31 실측).
 * 대신 PROBE_MAX_ATTEMPTS 회를 넘기면 그때는 fallback 을 확정 캐시한다 —
 * 셸이 아예 없는 환경에서 매번 10s 씩 멈추지 않게 한다.
 */
function getExpandedPath(): string[] {
  if (cachedExpandedPath) return cachedExpandedPath;

  const cp = electronRequire<typeof import("node:child_process")>(
    "node:child_process",
  ) ?? electronRequire<typeof import("child_process")>("child_process");
  const proc = electronRequire<{ env: Record<string, string | undefined> }>(
    "process",
  );
  const shell = proc?.env.SHELL ?? "/bin/zsh";

  if (cp && probeAttempts < PROBE_MAX_ATTEMPTS) {
    probeAttempts += 1;
    // `-lc`(login·비대화) 를 먼저 쓴다 — 이 기계에서 111ms 로 `-ilc`(958ms)
    // 보다 8배 이상 빠르고 PATH 는 같았다. 다만 PATH 를 `.zshrc` 에만 적어
    // 둔 사용자는 `-lc` 로 안 잡히므로, node 가 안 보이면 `-ilc` 로 올린다.
    for (const flags of ["-lc", "-ilc"] as const) {
      let list: string[];
      try {
        const out = cp.execSync(`${shell} ${flags} 'echo -n $PATH'`, {
          timeout: PROBE_TIMEOUT_MS,
          encoding: "utf8",
        });
        list = out.trim().split(":").filter(Boolean);
      } catch {
        continue; // 다음 flags 로. 둘 다 실패하면 아래 fallback.
      }
      if (list.length === 0) continue;
      // node 가 보이면 그것으로 확정. 안 보이면 `-ilc` 를 한 번 더 본다.
      if (hasNode(list) || flags === "-ilc") {
        cachedExpandedPath = list;
        return list;
      }
    }
  }

  const raw = rawPathEnv();
  // 재시도 여지가 남아 있으면 캐시하지 않는다 — 다음 호출이 다시 시도한다.
  if (probeAttempts >= PROBE_MAX_ATTEMPTS) cachedExpandedPath = raw;
  return raw;
}

/** 주어진 디렉터리 목록에 실행 가능한 node 가 있나. */
function hasNode(dirs: readonly string[]): boolean {
  return dirs.some((d) => isFile(`${d}/node`));
}

function isFile(path: string): boolean {
  const fs = electronRequire<typeof import("node:fs")>("node:fs") ??
    electronRequire<typeof import("fs")>("fs");
  if (!fs) return false;
  try {
    return fs.statSync(path).isFile();
  } catch {
    return false;
  }
}

/**
 * PATH 에 node 가 없으면 정적 후보에서 찾아 맨 앞에 붙인다.
 *
 * codex 는 `#!/usr/bin/env node` 스크립트라 PATH 에 node 가 없으면 exit 127
 * 로 죽는다. login shell probe 가 실패해도 여기서 막는다 — 마지막 방어선이다.
 */
function ensureNodeVisible(paths: readonly string[]): string[] {
  if (hasNode(paths)) return [...paths];
  for (const dir of staticBinDirs()) {
    if (isFile(`${dir}/node`)) return [dir, ...paths];
  }
  return [...paths];
}

/**
 * 셸 probe 없이도 쓸 수 있는 정적 bin 디렉터리 목록.
 * 순서는 findBinary 의 기존 탐색 순서(알려진 prefix → 홈 toolchain → 앱 번들)
 * 를 그대로 지킨다 — 바꾸면 어느 바이너리가 이기는지가 달라진다.
 */
function staticBinDirs(): string[] {
  const home = homeDir();
  const dirs: string[] = [...KNOWN_PREFIXES];
  if (home) {
    dirs.push(`${home}/.local/bin`);
    dirs.push(`${home}/.cargo/bin`);
    dirs.push(`${home}/.bun/bin`);
    dirs.push(`${home}/.volta/bin`);
    for (const dir of nvmDirs(home)) dirs.push(dir);
  }
  dirs.push("/Applications/cmux.app/Contents/Resources/bin");
  return dirs;
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

  const candidates: string[] = [];

  // 1) login shell 로 확장된 PATH (사용자 .zshrc 반영)
  for (const p of getExpandedPath()) candidates.push(`${p}/${name}`);

  // 2) raw process.env.PATH (GUI launchd 단축 PATH 도 포함될 수 있음)
  for (const p of rawPathEnv()) candidates.push(`${p}/${name}`);

  // 3) 셸 없이도 아는 정적 후보 — 알려진 prefix → 홈 toolchain(nvm 포함)
  //    → GUI 앱 번들 bin 순서. ensureNodeVisible 과 같은 목록을 쓴다.
  for (const p of staticBinDirs()) candidates.push(`${p}/${name}`);

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

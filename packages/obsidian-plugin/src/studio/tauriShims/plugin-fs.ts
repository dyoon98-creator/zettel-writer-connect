// tauriShims/plugin-fs.ts — `@tauri-apps/plugin-fs` 의 옵시디언용 stub.
// desktop 의 writeFile / mkdir 호출을 Node fs/promises 로 라우팅.

import { electronRequire } from "../../adapters/electronBridge";

export async function writeFile(
  path: string,
  data: Uint8Array,
): Promise<void> {
  const fs =
    electronRequire<typeof import("node:fs/promises")>("node:fs/promises") ??
    electronRequire<typeof import("fs/promises")>("fs/promises");
  if (!fs) throw new Error("Node fs/promises 모듈을 사용할 수 없습니다.");
  await fs.writeFile(path, data);
}

export async function mkdir(
  path: string,
  opts?: { recursive?: boolean },
): Promise<void> {
  const fs =
    electronRequire<typeof import("node:fs/promises")>("node:fs/promises") ??
    electronRequire<typeof import("fs/promises")>("fs/promises");
  if (!fs) throw new Error("Node fs/promises 모듈을 사용할 수 없습니다.");
  try {
    await fs.mkdir(path, { recursive: opts?.recursive ?? false });
  } catch {
    /* race tolerant */
  }
}

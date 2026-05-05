// SnapshotIO — 장면별 인-앱 버전 히스토리.
//
// Scrivener 의 Snapshots 와 같은 역할: 장면 본문을 명시적/자동으로 동결한다.
// 디스크 레이아웃:
//   <projectFolder>/.snapshots/<scene-id>/<ISO-stamp>.md
//   <projectFolder>/.snapshots/<scene-id>/<ISO-stamp>.json   (메타)
//
// 본문 .md 는 raw scene body (frontmatter 없음 — 원본 frontmatter 는 메타에 일부 보관).
// 메타 .json 은 라벨/원본 경로/원본 word_count 등을 담는다.

import { VaultAdapter } from "../adapters/VaultAdapter";

export interface SnapshotMeta {
  /** ISO 8601 timestamp — 파일명과 매칭. */
  takenAt: string;
  /** 작가가 붙인 짧은 라벨 (없으면 빈 문자열). */
  label: string;
  /** 스냅샷 시점의 본문 글자 수 (캐시). */
  charCount: number;
  /** 원본 scene 의 binder node id. */
  sceneId: string;
}

export interface Snapshot extends SnapshotMeta {
  /** 본문 — read 시에만 채워짐. listSnapshots 는 메타만 반환. */
  body?: string;
}

const SNAP_DIR = ".snapshots";

function snapDir(projectFolder: string, sceneId: string): string {
  return `${projectFolder.replace(/\/+$/, "")}/${SNAP_DIR}/${sanitizeSceneId(sceneId)}`;
}

/** 파일시스템 안전 — 슬래시·콜론 등 제거. */
function sanitizeSceneId(id: string): string {
  return id.replace(/[^A-Za-z0-9_\-.]/g, "_");
}

/** ISO 타임스탬프를 파일명 안전하게 — `:` 와 `.` 를 `-` 로.
 *  ms 까지 보존해 같은 초 안에 두 번 take 해도 충돌하지 않는다. */
function stampForFilename(iso: string): string {
  return iso.replace(/:/g, "-").replace(/\./g, "-");
}

function nowStamp(): string {
  return stampForFilename(new Date().toISOString());
}

interface ParsedFilename {
  stamp: string;
  ext: "md" | "json";
}

function parseFilename(name: string): ParsedFilename | null {
  const m = name.match(/^(.+)\.(md|json)$/i);
  if (!m) return null;
  return { stamp: m[1], ext: m[2].toLowerCase() as "md" | "json" };
}

function metaToJson(m: SnapshotMeta): string {
  return JSON.stringify(m, null, 2);
}

function parseMeta(raw: string, fallback: { stamp: string; sceneId: string }): SnapshotMeta {
  try {
    const parsed = JSON.parse(raw) as Partial<SnapshotMeta>;
    return {
      takenAt: typeof parsed.takenAt === "string" ? parsed.takenAt : fallback.stamp,
      label: typeof parsed.label === "string" ? parsed.label : "",
      charCount: typeof parsed.charCount === "number" ? parsed.charCount : 0,
      sceneId: typeof parsed.sceneId === "string" ? parsed.sceneId : fallback.sceneId,
    };
  } catch {
    return {
      takenAt: fallback.stamp,
      label: "",
      charCount: 0,
      sceneId: fallback.sceneId,
    };
  }
}

export interface TakeSnapshotInput {
  projectFolder: string;
  sceneId: string;
  /** 동결할 본문 (frontmatter 미포함). */
  body: string;
  /** 작가가 붙인 라벨. 비어 있어도 OK. */
  label?: string;
}

export const SnapshotIO = {
  /** sceneId 의 모든 스냅샷 메타를 최신순으로 반환. 본문은 포함하지 않음. */
  async list(
    vault: VaultAdapter,
    projectFolder: string,
    sceneId: string,
  ): Promise<SnapshotMeta[]> {
    const dir = snapDir(projectFolder, sceneId);
    const exists = await vault.fileExists(dir);
    if (!exists) return [];

    const entries = await vault.listDir(dir);
    // .json 메타만 필터.
    const metas: SnapshotMeta[] = [];
    for (const e of entries) {
      if (e.isDirectory) continue;
      const parsed = parseFilename(e.name);
      if (!parsed || parsed.ext !== "json") continue;
      try {
        const raw = await vault.readFile(`${dir}/${e.name}`);
        metas.push(parseMeta(raw, { stamp: parsed.stamp, sceneId }));
      } catch {
        // 손상 메타는 건너뜀.
      }
    }
    metas.sort((a, b) => (a.takenAt < b.takenAt ? 1 : -1));
    return metas;
  },

  /** 단일 스냅샷의 본문을 읽는다. */
  async read(
    vault: VaultAdapter,
    projectFolder: string,
    sceneId: string,
    takenAt: string,
  ): Promise<Snapshot | null> {
    const dir = snapDir(projectFolder, sceneId);
    const stamp = stampForFilename(takenAt);
    const bodyPath = `${dir}/${stamp}.md`;
    const metaPath = `${dir}/${stamp}.json`;
    if (!(await vault.fileExists(bodyPath))) return null;
    const body = await vault.readFile(bodyPath);
    let meta: SnapshotMeta;
    try {
      const raw = await vault.readFile(metaPath);
      meta = parseMeta(raw, { stamp, sceneId });
    } catch {
      meta = { takenAt: stamp, label: "", charCount: body.length, sceneId };
    }
    return { ...meta, body };
  },

  /** 새 스냅샷을 만든다. 반환값은 생성된 스냅샷 메타. */
  async take(vault: VaultAdapter, input: TakeSnapshotInput): Promise<SnapshotMeta> {
    const { projectFolder, sceneId, body, label } = input;
    const dir = snapDir(projectFolder, sceneId);
    await vault.ensureDir(dir);
    const stamp = nowStamp();
    const meta: SnapshotMeta = {
      takenAt: stamp,
      label: label ?? "",
      charCount: body.length,
      sceneId,
    };
    await vault.writeFile(`${dir}/${stamp}.md`, body);
    await vault.writeFile(`${dir}/${stamp}.json`, metaToJson(meta));
    return meta;
  },

  /** 라벨만 갱신. */
  async setLabel(
    vault: VaultAdapter,
    projectFolder: string,
    sceneId: string,
    takenAt: string,
    label: string,
  ): Promise<void> {
    const dir = snapDir(projectFolder, sceneId);
    const stamp = stampForFilename(takenAt);
    const metaPath = `${dir}/${stamp}.json`;
    if (!(await vault.fileExists(metaPath))) return;
    const raw = await vault.readFile(metaPath);
    const meta = parseMeta(raw, { stamp, sceneId });
    meta.label = label;
    await vault.writeFile(metaPath, metaToJson(meta));
  },

  /** 스냅샷 삭제. */
  async remove(
    vault: VaultAdapter,
    projectFolder: string,
    sceneId: string,
    takenAt: string,
  ): Promise<void> {
    const dir = snapDir(projectFolder, sceneId);
    const stamp = stampForFilename(takenAt);
    await Promise.all([
      vault.deleteFile(`${dir}/${stamp}.md`).catch(() => undefined),
      vault.deleteFile(`${dir}/${stamp}.json`).catch(() => undefined),
    ]);
  },
};

// ---- 단순 라인 diff -------------------------------------------------------
//
// 외부 lib 추가 없이 미리보기용으로만 쓰는 LCS 기반 라인 diff.
// 큰 본문에서는 O(N*M) 이지만 한 장면 단위면 충분.

export type DiffOp = "equal" | "add" | "remove";
export interface DiffLine {
  op: DiffOp;
  text: string;
}

export function diffLines(oldText: string, newText: string): DiffLine[] {
  const a = oldText.split("\n");
  const b = newText.split("\n");
  const n = a.length;
  const m = b.length;

  // LCS table.
  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      if (a[i] === b[j]) dp[i][j] = dp[i + 1][j + 1] + 1;
      else dp[i][j] = Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }

  const out: DiffLine[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      out.push({ op: "equal", text: a[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      out.push({ op: "remove", text: a[i] });
      i++;
    } else {
      out.push({ op: "add", text: b[j] });
      j++;
    }
  }
  while (i < n) {
    out.push({ op: "remove", text: a[i++] });
  }
  while (j < m) {
    out.push({ op: "add", text: b[j++] });
  }
  return out;
}

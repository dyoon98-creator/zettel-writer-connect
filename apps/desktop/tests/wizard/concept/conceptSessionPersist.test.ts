// @TASK P3-T9 — conceptSessionPersist 단위 테스트

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ConceptDraftSession } from "@ai-manuscript-studio/core";

// ─── hoisted mock 변수 ───────────────────────────────────────────────────────

const files = new Map<string, string>();
let vaultBase: string | null = "/mock-vault";

// vi.hoisted 로 vaultAdapter mock 구현 변수를 미리 올린다
const mockEnsureDir = vi.hoisted(() => vi.fn(async () => undefined));
const mockWriteFile = vi.hoisted(() =>
  vi.fn(async (rel: string, content: string) => {
    if (!vaultBase) throw new Error("no vault");
    files.set(`${vaultBase}/${rel}`, content);
  }),
);
const mockReadFile = vi.hoisted(() =>
  vi.fn(async (rel: string) => {
    if (!vaultBase) throw new Error("no vault");
    const v = files.get(`${vaultBase}/${rel}`);
    if (v === undefined) throw new Error(`ENOENT: ${rel}`);
    return v;
  }),
);
const mockListDir = vi.hoisted(() =>
  vi.fn(async (rel: string) => {
    if (!vaultBase) throw new Error("no vault");
    const prefix = `${vaultBase}/${rel}/`;
    const direct = new Map<string, boolean>();
    for (const k of files.keys()) {
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash === -1) direct.set(rest, false);
      else direct.set(rest.slice(0, slash), true);
    }
    return [...direct].map(([name, isDirectory]) => ({ name, isDirectory }));
  }),
);
const mockDeleteFile = vi.hoisted(() =>
  vi.fn(async (rel: string) => {
    if (!vaultBase) throw new Error("no vault");
    files.delete(`${vaultBase}/${rel}`);
  }),
);
const mockGetVaultBasePath = vi.hoisted(() => vi.fn(() => vaultBase));

// ─── vi.mock — hoisted 변수를 factory 에서 참조 ────────────────────────────

vi.mock("../../../src/vaultAdapter", () => ({
  getVaultBasePath: mockGetVaultBasePath,
  tauriVaultAdapter: {
    ensureDir: mockEnsureDir,
    writeFile: mockWriteFile,
    readFile: mockReadFile,
    listDir: mockListDir,
    deleteFile: mockDeleteFile,
  },
}));

// ─── import 은 mock 선언 이후 ────────────────────────────────────────────────

import {
  saveSession,
  listSessions,
  archiveSession,
  deleteSession,
  SESSION_DIR,
} from "../../../src/wizard/concept/conceptSessionPersist";

// ─── fixture ─────────────────────────────────────────────────────────────────

function makeSession(overrides: Partial<ConceptDraftSession> = {}): ConceptDraftSession {
  return {
    schema: "concept-draft-v1",
    id: `test-${Math.random().toString(36).slice(2, 8)}`,
    seed: "테스트 시드 문장",
    tone: "novel",
    genre: "world",
    attachedNotes: [],
    conversation: [],
    conceptParagraph: "",
    synopsis: "",
    outline: [],
    stage: "concept",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  files.clear();
  vaultBase = "/mock-vault";
  // 구현을 재주입 (clearAllMocks 호출 안 함 — mockImplementation 이 사라지지 않게)
  mockGetVaultBasePath.mockImplementation(() => vaultBase);
  mockWriteFile.mockImplementation(async (rel: string, content: string) => {
    if (!vaultBase) throw new Error("no vault");
    files.set(`${vaultBase}/${rel}`, content);
  });
  mockReadFile.mockImplementation(async (rel: string) => {
    if (!vaultBase) throw new Error("no vault");
    const v = files.get(`${vaultBase}/${rel}`);
    if (v === undefined) throw new Error(`ENOENT: ${rel}`);
    return v;
  });
  mockListDir.mockImplementation(async (rel: string) => {
    if (!vaultBase) throw new Error("no vault");
    const prefix = `${vaultBase}/${rel}/`;
    const direct = new Map<string, boolean>();
    for (const k of files.keys()) {
      if (!k.startsWith(prefix)) continue;
      const rest = k.slice(prefix.length);
      const slash = rest.indexOf("/");
      if (slash === -1) direct.set(rest, false);
      else direct.set(rest.slice(0, slash), true);
    }
    return [...direct].map(([name, isDirectory]) => ({ name, isDirectory }));
  });
  mockDeleteFile.mockImplementation(async (rel: string) => {
    if (!vaultBase) throw new Error("no vault");
    files.delete(`${vaultBase}/${rel}`);
  });
  mockEnsureDir.mockImplementation(async () => undefined);
});

// ─── 1. saveSession → round-trip ─────────────────────────────────────────────

describe("saveSession", () => {
  it("JSON 파일을 SESSION_DIR/<id>.json 에 쓴다", async () => {
    const s = makeSession({ id: "abc123" });
    await saveSession(s);

    const stored = files.get(`/mock-vault/${SESSION_DIR}/abc123.json`);
    expect(stored).toBeDefined();
    const parsed = JSON.parse(stored!);
    expect(parsed.id).toBe("abc123");
    expect(parsed.seed).toBe("테스트 시드 문장");
  });

  it("round-trip: writeFile 로 저장 후 복원 가능", async () => {
    const s = makeSession({ id: "rtrip", synopsis: "시놉시스 내용" });
    await saveSession(s);

    const raw = files.get(`/mock-vault/${SESSION_DIR}/rtrip.json`);
    expect(raw).toBeDefined();
    const parsed: ConceptDraftSession = JSON.parse(raw!);
    expect(parsed.synopsis).toBe("시놉시스 내용");
    expect(parsed.stage).toBe("concept");
  });
});

// ─── 2. listSessions — 정상 + stage="done" 제외 ──────────────────────────────

describe("listSessions", () => {
  it("미완료 세션만 반환하고 done 세션은 제외한다", async () => {
    const active = makeSession({ id: "s-active", stage: "synopsis" });
    const done = makeSession({ id: "s-done", stage: "done" });
    await saveSession(active);
    await saveSession(done);

    const results = await listSessions();
    const ids = results.map((x) => x.id);
    expect(ids).toContain("s-active");
    expect(ids).not.toContain("s-done");
  });

  it("N개 미완료 세션을 모두 반환한다", async () => {
    const sessions = [
      makeSession({ id: "multi-1", stage: "concept" }),
      makeSession({ id: "multi-2", stage: "outline" }),
      makeSession({ id: "multi-3", stage: "synopsis" }),
    ];
    for (const s of sessions) await saveSession(s);

    const results = await listSessions();
    expect(results.length).toBeGreaterThanOrEqual(3);
    const ids = results.map((x) => x.id);
    expect(ids).toContain("multi-1");
    expect(ids).toContain("multi-2");
    expect(ids).toContain("multi-3");
  });

  it("invalid JSON 파일 1개 + 정상 1개 → 정상만 반환", async () => {
    const good = makeSession({ id: "g-good" });
    await saveSession(good);
    // invalid JSON 파일 직접 주입
    files.set(`/mock-vault/${SESSION_DIR}/bad.json`, "{ not valid json {{");

    const results = await listSessions();
    const ids = results.map((x) => x.id);
    expect(ids).toContain("g-good");
    expect(ids.some((id) => id === "bad")).toBe(false);
  });

  it(".json 이 아닌 파일(.md)은 무시한다", async () => {
    const s = makeSession({ id: "md-test" });
    await saveSession(s);
    // .md 사이드카를 files 에 직접 추가
    files.set(`/mock-vault/${SESSION_DIR}/md-test.md`, "# 사이드카");

    const results = await listSessions();
    // .json 만 처리되므로 md-test 가 1개만 존재
    expect(results.filter((x) => x.id === "md-test").length).toBe(1);
  });
});

// ─── 3. archiveSession — _archive/ 로 이동 ───────────────────────────────────

describe("archiveSession", () => {
  it("원본 JSON 을 삭제하고 _archive/ 에 타임스탬프 suffix 로 복사한다", async () => {
    const s = makeSession({ id: "arch-me" });
    await saveSession(s);

    expect(files.has(`/mock-vault/${SESSION_DIR}/arch-me.json`)).toBe(true);

    await archiveSession("arch-me");

    // 원본 삭제 확인
    expect(files.has(`/mock-vault/${SESSION_DIR}/arch-me.json`)).toBe(false);

    // _archive/ 아래에 1개 파일
    const archiveFiles = [...files.keys()].filter((k) =>
      k.startsWith(`/mock-vault/${SESSION_DIR}/_archive/arch-me-`),
    );
    expect(archiveFiles.length).toBe(1);
    // 내용이 원본과 동일
    const archived = JSON.parse(files.get(archiveFiles[0])!);
    expect(archived.id).toBe("arch-me");
  });
});

// ─── 4. deleteSession ────────────────────────────────────────────────────────

describe("deleteSession", () => {
  it("JSON 파일을 삭제한다", async () => {
    const s = makeSession({ id: "del-me" });
    await saveSession(s);
    expect(files.has(`/mock-vault/${SESSION_DIR}/del-me.json`)).toBe(true);

    await deleteSession("del-me");
    expect(files.has(`/mock-vault/${SESSION_DIR}/del-me.json`)).toBe(false);
  });
});

// ─── 5. vaultBasePath null → silent no-op ────────────────────────────────────

describe("vaultBasePath null", () => {
  it("saveSession 은 no-op 이고 에러를 throw 하지 않는다", async () => {
    vaultBase = null;
    mockGetVaultBasePath.mockReturnValue(null);

    const s = makeSession({ id: "no-vault" });
    await expect(saveSession(s)).resolves.toBeUndefined();
    // 아무 파일도 쓰이지 않음
    expect(files.size).toBe(0);
  });

  it("listSessions 는 빈 배열을 반환한다", async () => {
    vaultBase = null;
    mockGetVaultBasePath.mockReturnValue(null);

    const result = await listSessions();
    expect(result).toEqual([]);
  });
});

// researchStore.ts — 현재 프로젝트의 리서치 노트 상태 (Zustand).
//
// 설계 원칙:
//  - 항목 메타는 store 에, 본문은 lazy 로 채운다 (선택 시 readResearchBody).
//  - 스토어는 디스크와 단방향 동기화 — listResearch / writeResearchItem 직접 호출.
//  - voiceRewriter 는 별도 모듈에서 호출하지만 store 의 isRewriting 플래그를 켠다.

import { create } from "zustand";
import { tauriVaultAdapter } from "../vaultAdapter";
import { tauriNoticeAdapter } from "../noticeAdapter";
import {
  deleteResearchFile,
  listResearch,
  readResearchBody,
  writeResearchItem,
  type ResearchItem,
} from "../research/researchIO";
import {
  runResearch,
  type ResearchSourceKind,
} from "../research/researchRunner";

export interface RunResearchInput {
  prompt: string;
  sourceKind: ResearchSourceKind;
  attachedLinks: string[];
}

interface ResearchStoreState {
  projectFolder: string | null;
  items: ResearchItem[];
  selectedId: string | null;

  isRunning: boolean;
  runStartedAt: number | null;
  runError: string | null;

  isRewriting: boolean;

  // ---- lifecycle ----
  loadProject: (projectFolder: string) => Promise<void>;
  reset: () => void;

  // ---- selection ----
  selectResearch: (id: string | null) => Promise<void>;

  // ---- mutations ----
  runResearch: (input: RunResearchInput) => Promise<void>;
  deleteResearch: (id: string) => Promise<void>;

  // ---- helpers (테스트/외부 모듈용) ----
  setRewriting: (v: boolean) => void;
  upsertItem: (item: ResearchItem) => void;
}

function newId(): string {
  // crypto.randomUUID 가 jsdom 에서 가끔 비어 있음 — fallback.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `r-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export const useResearchStore = create<ResearchStoreState>((set, get) => ({
  projectFolder: null,
  items: [],
  selectedId: null,

  isRunning: false,
  runStartedAt: null,
  runError: null,
  isRewriting: false,

  async loadProject(projectFolder) {
    set({ projectFolder, items: [], selectedId: null, runError: null });
    try {
      const items = await listResearch(tauriVaultAdapter, projectFolder);
      set({ items });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ runError: `리서치 폴더를 읽지 못했습니다: ${msg}` });
    }
  },

  reset() {
    set({
      projectFolder: null,
      items: [],
      selectedId: null,
      isRunning: false,
      runStartedAt: null,
      runError: null,
      isRewriting: false,
    });
  },

  async selectResearch(id) {
    set({ selectedId: id });
    if (!id) return;
    const { items, projectFolder } = get();
    if (!projectFolder) return;
    const idx = items.findIndex((x) => x.id === id);
    if (idx < 0) return;
    if (items[idx].body && items[idx].body.length > 0) return; // 이미 채워져 있음.
    try {
      const body = await readResearchBody(tauriVaultAdapter, projectFolder, id);
      const next = items.slice();
      next[idx] = { ...next[idx], body };
      set({ items: next });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`리서치 본문을 불러올 수 없습니다: ${msg}`);
    }
  },

  async runResearch(input) {
    const { projectFolder } = get();
    if (!projectFolder) {
      tauriNoticeAdapter.error("프로젝트가 열려 있지 않습니다.");
      return;
    }
    if (!input.prompt.trim()) {
      tauriNoticeAdapter.warn("리서치 prompt 를 입력해주세요.");
      return;
    }
    set({ isRunning: true, runStartedAt: Date.now(), runError: null });
    try {
      const result = await runResearch({
        userPrompt: input.prompt,
        sourceKind: input.sourceKind,
        attachedLinks: input.attachedLinks,
      });
      const allLinks = Array.from(
        new Set([...(input.attachedLinks ?? []), ...result.extractedLinks]),
      );
      const item: ResearchItem = {
        id: newId(),
        title: result.title || "(제목 없음)",
        prompt: input.prompt.slice(0, 500),
        source: input.sourceKind,
        links: allLinks,
        createdAt: new Date().toISOString(),
        filePath: `research/__pending__.md`, // writeResearchItem 후 실제 path 로 보정.
        body: result.body,
      };
      item.filePath = `research/${item.id}.md`;
      await writeResearchItem(tauriVaultAdapter, projectFolder, item);

      const next = [item, ...get().items];
      set({
        items: next,
        selectedId: item.id,
        isRunning: false,
        runStartedAt: null,
      });
      tauriNoticeAdapter.info(
        `리서치 추가됨: ${item.title} (${allLinks.length}개 링크)`,
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ isRunning: false, runStartedAt: null, runError: msg });
      tauriNoticeAdapter.error(`리서치 실패: ${msg}`);
    }
  },

  async deleteResearch(id) {
    const { projectFolder, items, selectedId } = get();
    if (!projectFolder) return;
    try {
      await deleteResearchFile(tauriVaultAdapter, projectFolder, id);
      set({
        items: items.filter((x) => x.id !== id),
        selectedId: selectedId === id ? null : selectedId,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`리서치 삭제 실패: ${msg}`);
    }
  },

  setRewriting(v) {
    set({ isRewriting: v });
  },

  upsertItem(item) {
    const cur = get().items;
    const idx = cur.findIndex((x) => x.id === item.id);
    const next = idx >= 0 ? cur.slice() : [item, ...cur];
    if (idx >= 0) next[idx] = item;
    set({ items: next });
  },
}));

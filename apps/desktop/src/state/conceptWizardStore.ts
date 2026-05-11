// conceptWizardStore.ts — Concept Wizard 5단계 마법사의 in-flight 상태 (Zustand).
//
// 책임:
//  - 시드 → 컨셉 다턴 → 시놉시스 → 12-30장 목차 단계의 누적 상태를 한 ConceptDraftSession
//    객체로 관리.
//  - chapter 조작 (reorder/merge/split/remove/update) — pure 함수형 갱신.
//  - persist (sessionStorage) — `Cmd+.` 로 잠시 닫고 binder 참조 후 재개 가능하게.
//    영속 파일 시스템은 P3-T9 에서 추가.
//
// 기존 인터뷰 마법사 (apps/desktop/src/wizard/wizardStore.ts) 와는 완전 별개.
// 두 스토어가 동시에 살아 있어도 충돌하지 않도록 storage key 도 분리한다.

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import {
  CONCEPT_DRAFT_SCHEMA,
  type ConceptDraftSession,
  type ConceptDraftStage,
  type ConceptMemo,
  type ConceptMessage,
  type ConceptTone,
  type Genre,
  type MemoAnalysis,
  type OutlineChapter,
  type TreatmentCard,
  type TreatmentCardRole,
} from "@ai-manuscript-studio/core";
import { saveSession } from "../wizard/concept/conceptSessionPersist";

// ---- module-level debounce timer (autosave) --------------------------------
let saveTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSave(session: ConceptDraftSession | null): void {
  if (!session) return;
  if (saveTimer !== undefined) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    saveTimer = undefined;
    void saveSession(session);
  }, 500);
}

export interface ConceptWizardStartInput {
  seed: string;
  tone: ConceptTone;
  genre: Genre;
  attachedNotes: string[];
}

export interface ConceptWizardState {
  session: ConceptDraftSession | null;
  isOpen: boolean;
  /** Cmd+. 로 잠시 닫고 binder 참조 중인 상태. resumeFromBinder 로 복귀. */
  pausedForBinder: boolean;

  // ---- lifecycle ----
  start: (opts: ConceptWizardStartInput) => void;
  close: () => void;
  /** vault 파일에서 복구한 세션으로 모달 열기. */
  loadFromSession: (s: ConceptDraftSession) => void;
  /** 빈 세션으로 모달만 열기 — Step1Seed 가 store.start 를 호출해 세션을 생성한다. */
  openEmpty: () => void;

  // ---- conversation ----
  appendMessage: (role: "user" | "assistant", content: string) => void;

  // ---- per-stage outputs ----
  setConceptParagraph: (text: string) => void;
  setSynopsis: (text: string) => void;

  // ---- outline 조작 (legacy — 신규 작성은 treatment 사용) ----
  setOutline: (chs: OutlineChapter[]) => void;
  updateChapter: (
    id: string,
    patch: Partial<Pick<OutlineChapter, "title" | "summary">>,
  ) => void;
  reorderChapters: (orderedIds: string[]) => void;
  mergeChapters: (idA: string, idB: string) => void;
  splitChapter: (
    id: string,
    into: { title: string; summary: string }[],
  ) => void;
  removeChapter: (id: string) => void;

  // ---- v2: memo (의식의 흐름) ----
  setMemoRaw: (text: string) => void;
  setMemoAnalysis: (analysis: MemoAnalysis | undefined) => void;
  setMemoSelected: (ids: string[]) => void;

  // ---- v2: treatment cards ----
  setTreatment: (cards: TreatmentCard[]) => void;
  addTreatmentCard: (role: TreatmentCardRole, atIndex?: number) => string;
  updateTreatmentCard: (id: string, patch: Partial<Omit<TreatmentCard, "id">>) => void;
  removeTreatmentCard: (id: string) => void;
  reorderTreatmentCards: (orderedIds: string[]) => void;

  // ---- stage 전이 ----
  goStage: (next: ConceptDraftStage) => void;

  // ---- attached notes ----
  attachNote: (link: string) => void;
  detachNote: (link: string) => void;

  // ---- pause/resume (Cmd+. 워크플로우) ----
  pauseForBinder: () => void;
  resumeFromBinder: () => void;
}

// --------------------------------------------------------------- helpers

function nowIso(): string {
  return new Date().toISOString();
}

function newSessionId(): string {
  // crypto.randomUUID 가 jsdom 에서 가끔 비어 있음 — fallback (researchStore 와 같은 패턴).
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const c: any = (globalThis as any).crypto;
  if (c && typeof c.randomUUID === "function") return c.randomUUID();
  return `cw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** "ch-01", "ch-12" 형식. 1부터. zero-pad 2자리. */
function chapterIdFor(n: number): string {
  return `ch-${String(n).padStart(2, "0")}`;
}

/** "tc-01" 트리트먼트 카드 id. */
function treatmentCardIdFor(n: number): string {
  return `tc-${String(n).padStart(2, "0")}`;
}

function nextTreatmentCardNumber(cards: TreatmentCard[]): number {
  let max = 0;
  for (const c of cards) {
    const m = /^tc-(\d+)$/.exec(c.id);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max + 1;
}

/** 현재 outline 의 가장 높은 ch- 번호를 찾아 다음 번호 반환. */
function nextChapterNumber(outline: OutlineChapter[]): number {
  let max = 0;
  for (const c of outline) {
    const m = /^ch-(\d+)$/.exec(c.id);
    if (m) {
      const n = parseInt(m[1], 10);
      if (Number.isFinite(n) && n > max) max = n;
    }
  }
  return max + 1;
}

/** session 갱신 헬퍼 — null 이면 no-op, updatedAt 자동 갱신. */
function patchSession(
  session: ConceptDraftSession | null,
  patch: Partial<ConceptDraftSession>,
): ConceptDraftSession | null {
  if (!session) return null;
  return { ...session, ...patch, updatedAt: nowIso() };
}

// --------------------------------------------------------------- store

export const STORAGE_KEY = "concept-wizard-store-v1";

export const useConceptWizardStore = create<ConceptWizardState>()(
  persist(
    (set, get) => ({
      session: null,
      isOpen: false,
      pausedForBinder: false,

      // -------- lifecycle --------

      start({ seed, tone, genre, attachedNotes }) {
        const at = nowIso();
        const session: ConceptDraftSession = {
          schema: CONCEPT_DRAFT_SCHEMA,
          id: newSessionId(),
          seed,
          tone,
          genre,
          // attachedNotes 입력은 보존하되 중복 제거 (UX 안전망).
          attachedNotes: Array.from(new Set(attachedNotes)),
          conversation: [],
          conceptParagraph: "",
          synopsis: "",
          outline: [],
          // v2: start 직후 의식의 흐름 메모 단계로 진입.
          // (스킵 가능 — Step2Memo 에서 빈 채로 "다음" 누르면 concept 로.)
          stage: "memo",
          createdAt: at,
          updatedAt: at,
        };
        set({ session, isOpen: true, pausedForBinder: false });
        scheduleSave(session);
      },

      close() {
        // 마지막 저장 — stage="done" 인 세션이 여기서 한 번 저장되고,
        // listSessions() 가 done 을 제외하므로 다음 앱 시작에서 자동 정리됨.
        scheduleSave(get().session);
        set({ session: null, isOpen: false, pausedForBinder: false });
      },

      loadFromSession(s) {
        set({ session: s, isOpen: true, pausedForBinder: false });
      },

      openEmpty() {
        set({ session: null, isOpen: true, pausedForBinder: false });
      },

      // -------- conversation --------

      appendMessage(role, content) {
        const cur = get().session;
        if (!cur) return;
        const msg: ConceptMessage = { role, content, at: nowIso() };
        const next = patchSession(cur, { conversation: [...cur.conversation, msg] });
        set({ session: next });
        scheduleSave(next);
      },

      // -------- per-stage outputs --------

      setConceptParagraph(text) {
        const cur = get().session;
        if (!cur) return;
        const next = patchSession(cur, { conceptParagraph: text });
        set({ session: next });
        scheduleSave(next);
      },

      setSynopsis(text) {
        const cur = get().session;
        if (!cur) return;
        const next = patchSession(cur, { synopsis: text });
        set({ session: next });
        scheduleSave(next);
      },

      // -------- outline --------

      setOutline(chs) {
        const cur = get().session;
        if (!cur) return;
        const next = patchSession(cur, { outline: chs.slice() });
        set({ session: next });
        scheduleSave(next);
      },

      updateChapter(id, patch) {
        const cur = get().session;
        if (!cur) return;
        const outline = cur.outline.map((c) =>
          c.id === id ? { ...c, ...patch } : c,
        );
        const next = patchSession(cur, { outline });
        set({ session: next });
        scheduleSave(next);
      },

      reorderChapters(orderedIds) {
        const cur = get().session;
        if (!cur) return;
        const byId = new Map(cur.outline.map((c) => [c.id, c]));
        const reordered: OutlineChapter[] = [];
        for (const id of orderedIds) {
          const ch = byId.get(id);
          if (ch) {
            reordered.push(ch);
            byId.delete(id);
          }
        }
        // orderedIds 에 빠진 챕터는 원래 순서대로 뒤에 보존 — 데이터 유실 방지.
        for (const ch of cur.outline) {
          if (byId.has(ch.id)) reordered.push(ch);
        }
        const next = patchSession(cur, { outline: reordered });
        set({ session: next });
        scheduleSave(next);
      },

      mergeChapters(idA, idB) {
        const cur = get().session;
        if (!cur) return;
        const a = cur.outline.find((c) => c.id === idA);
        const b = cur.outline.find((c) => c.id === idB);
        if (!a || !b) return;

        const merged: OutlineChapter = {
          id: chapterIdFor(nextChapterNumber(cur.outline)),
          title: `${a.title} / ${b.title}`,
          summary: `${a.summary}\n\n${b.summary}`,
        };
        // A 의 위치에 merged 박고 B 제거.
        const outline: OutlineChapter[] = [];
        for (const c of cur.outline) {
          if (c.id === idA) {
            outline.push(merged);
            continue;
          }
          if (c.id === idB) continue;
          outline.push(c);
        }
        const next = patchSession(cur, { outline });
        set({ session: next });
        scheduleSave(next);
      },

      splitChapter(id, into) {
        const cur = get().session;
        if (!cur) return;
        if (into.length === 0) return;
        const idx = cur.outline.findIndex((c) => c.id === id);
        if (idx < 0) return;

        // 새 id 들을 outline 전체 기준 next number 부터 연속 할당.
        let n = nextChapterNumber(cur.outline);
        const newChapters: OutlineChapter[] = into.map((part) => {
          const ch: OutlineChapter = {
            id: chapterIdFor(n),
            title: part.title,
            summary: part.summary,
          };
          n += 1;
          return ch;
        });

        const outline = [
          ...cur.outline.slice(0, idx),
          ...newChapters,
          ...cur.outline.slice(idx + 1),
        ];
        const next = patchSession(cur, { outline });
        set({ session: next });
        scheduleSave(next);
      },

      removeChapter(id) {
        const cur = get().session;
        if (!cur) return;
        const outline = cur.outline.filter((c) => c.id !== id);
        const next = patchSession(cur, { outline });
        set({ session: next });
        scheduleSave(next);
      },

      // -------- memo (v2) --------

      setMemoRaw(text) {
        const cur = get().session;
        if (!cur) return;
        const memo: ConceptMemo = { ...(cur.memo ?? { raw: "" }), raw: text };
        const next = patchSession(cur, { memo });
        set({ session: next });
        scheduleSave(next);
      },

      setMemoAnalysis(analysis) {
        const cur = get().session;
        if (!cur) return;
        const memo: ConceptMemo = {
          ...(cur.memo ?? { raw: "" }),
          analysis,
        };
        const next = patchSession(cur, { memo });
        set({ session: next });
        scheduleSave(next);
      },

      setMemoSelected(ids) {
        const cur = get().session;
        if (!cur) return;
        const memo: ConceptMemo = {
          ...(cur.memo ?? { raw: "" }),
          selected: ids.slice(),
        };
        const next = patchSession(cur, { memo });
        set({ session: next });
        scheduleSave(next);
      },

      // -------- treatment (v2) --------

      setTreatment(cards) {
        const cur = get().session;
        if (!cur) return;
        const next = patchSession(cur, { treatment: cards.slice() });
        set({ session: next });
        scheduleSave(next);
      },

      addTreatmentCard(role, atIndex) {
        const cur = get().session;
        if (!cur) return "";
        const cards = cur.treatment ?? [];
        const id = treatmentCardIdFor(nextTreatmentCardNumber(cards));
        const card: TreatmentCard = {
          id,
          title: "(제목 없음)",
          role,
          summary: "",
        };
        const idx = typeof atIndex === "number" ? atIndex : cards.length;
        const nextCards = [
          ...cards.slice(0, idx),
          card,
          ...cards.slice(idx),
        ];
        const next = patchSession(cur, { treatment: nextCards });
        set({ session: next });
        scheduleSave(next);
        return id;
      },

      updateTreatmentCard(id, patch) {
        const cur = get().session;
        if (!cur) return;
        const cards = cur.treatment ?? [];
        const nextCards = cards.map((c) => (c.id === id ? { ...c, ...patch } : c));
        const next = patchSession(cur, { treatment: nextCards });
        set({ session: next });
        scheduleSave(next);
      },

      removeTreatmentCard(id) {
        const cur = get().session;
        if (!cur) return;
        const cards = cur.treatment ?? [];
        const nextCards = cards.filter((c) => c.id !== id);
        const next = patchSession(cur, { treatment: nextCards });
        set({ session: next });
        scheduleSave(next);
      },

      reorderTreatmentCards(orderedIds) {
        const cur = get().session;
        if (!cur) return;
        const cards = cur.treatment ?? [];
        const byId = new Map(cards.map((c) => [c.id, c]));
        const reordered: TreatmentCard[] = [];
        for (const id of orderedIds) {
          const c = byId.get(id);
          if (c) {
            reordered.push(c);
            byId.delete(id);
          }
        }
        for (const c of cards) {
          if (byId.has(c.id)) reordered.push(c);
        }
        const next = patchSession(cur, { treatment: reordered });
        set({ session: next });
        scheduleSave(next);
      },

      // -------- stage --------

      goStage(nextStage) {
        const cur = get().session;
        if (!cur) return;
        const next = patchSession(cur, { stage: nextStage });
        set({ session: next });
        scheduleSave(next);
      },

      // -------- attached notes --------

      attachNote(link) {
        const cur = get().session;
        if (!cur) return;
        if (cur.attachedNotes.includes(link)) return;
        const next = patchSession(cur, {
          attachedNotes: [...cur.attachedNotes, link],
        });
        set({ session: next });
        scheduleSave(next);
      },

      detachNote(link) {
        const cur = get().session;
        if (!cur) return;
        const attachedNotes = cur.attachedNotes.filter((x) => x !== link);
        if (attachedNotes.length === cur.attachedNotes.length) return;
        const next = patchSession(cur, { attachedNotes });
        set({ session: next });
        scheduleSave(next);
      },

      // -------- pause/resume --------

      pauseForBinder() {
        set({ isOpen: false, pausedForBinder: true });
      },

      resumeFromBinder() {
        set({ isOpen: true, pausedForBinder: false });
      },
    }),
    {
      name: STORAGE_KEY,
      // sessionStorage — 브라우저/렌더러 세션이 살아 있는 동안만 보존.
      // 영속 디스크 저장은 P3-T9 에서 ProjectMeta.pendingWizard 에 sessionId 만 박고
      // 본체는 vault 파일로 옮길 예정.
      storage: createJSONStorage(() =>
        typeof sessionStorage !== "undefined"
          ? sessionStorage
          : memoryStorageFallback(),
      ),
      partialize: (state) => ({
        session: state.session,
        isOpen: state.isOpen,
        pausedForBinder: state.pausedForBinder,
      }),
    },
  ),
);

// SSR/test 에서 sessionStorage 가 없는 경우의 안전망 — in-memory shim.
function memoryStorageFallback(): Storage {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear: () => store.clear(),
    getItem: (k: string) => store.get(k) ?? null,
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    removeItem: (k: string) => {
      store.delete(k);
    },
    setItem: (k: string, v: string) => {
      store.set(k, String(v));
    },
  };
}

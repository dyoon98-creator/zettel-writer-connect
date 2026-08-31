// wizardDraft.ts — 시드된 «빈 장면»에 실제 초고를 채워 넣는다.
//
// 왜 필요한가 (2026-08-31 대표 지시).
//
// 지금까지 마법사는 컨셉·기획을 정하고 `structureProposal[]` 만큼 폴더와
// «빈 장면»을 만드는 데서 끝났다. 대표가 원한 것은 「설정 마법사 → 기획
// 인터뷰 → 글까지 쫙」이다. 빈 파일은 글이 아니다.
//
// 이 모듈은 시드 «다음»에 붙는다. binder 를 훑어 장(章)마다 첫 장면을 찾고,
// 컨셉·기획·그 장의 시놉시스를 재료로 AI 를 한 번씩 불러 본문을 쓴다.
//
// 설계 원칙 셋.
//   ① 한 장이 실패해도 나머지는 계속한다 — 아홉 장 중 하나 때문에 전부
//      잃지 않는다. 실패한 장은 개수로 보고한다.
//   ② 이미 본문이 있는 장면은 «건드리지 않는다» — 작가가 쓴 것을 덮지 않는다.
//   ③ 중간에 취소할 수 있다(AbortSignal) — 아홉 번 호출은 몇 분이 걸린다.

import type { BinderTree, BinderNode } from "@ai-manuscript-studio/core";
import { startAiInvocation } from "../ai/streamingHandle";
import { tauriVaultAdapter } from "../vaultAdapter";

/** 한 장(章)에 대해 쓸 거리. */
interface DraftTarget {
  sceneId: string;
  chapterTitle: string;
  chapterSynopsis: string;
  sceneTitle: string;
}

export interface DraftProgress {
  done: number;
  total: number;
  current: string;
}

export interface DraftDeps {
  provider: "codex" | "claude-code";
  binaryPath: string;
  extraArgs?: string;
  /** 장면 본문을 store 에 넣고 저장한다. projectStore 의 두 함수를 그대로 받는다. */
  setSceneDraft: (id: string, body: string) => void;
  saveScene: (id: string) => Promise<void>;
  /** 장면 현재 본문 — 비어 있을 때만 쓴다. */
  readSceneBody: (id: string) => string | null;
  onProgress?: (p: DraftProgress) => void;
  signal?: AbortSignal;
  /** 한 장당 상한. 장문이라 기본을 넉넉히 준다. */
  timeoutSecs?: number;
}

export interface DraftResult {
  written: number;
  skipped: number;
  failed: number;
  /** 실패한 장 제목 — 사용자에게 무엇이 안 됐는지 그대로 보여 준다. */
  failedTitles: string[];
  aborted: boolean;
}

/**
 * binder 를 훑어 «장(章) 폴더 → 그 안 첫 장면» 쌍을 순서대로 뽑는다.
 *
 * 주의할 함정 하나. 원고 루트 폴더 «자신»을 장으로 세면 안 된다. 루트 바로
 * 아래에는 `concept-summary.md` 같은 기획 문서가 들어 있어서, 루트를 장으로
 * 취급하면 그 파일을 초고로 «덮어쓴다». 컨셉 마법사 결과가 사라진다.
 * 그래서 대상은 «원고 루트의 자식 폴더»로 한정한다.
 */
export function collectDraftTargets(binder: BinderTree | null): DraftTarget[] {
  if (!binder) return [];
  const roots = (binder as unknown as { root?: BinderNode[] }).root ?? [];
  const out: DraftTarget[] = [];

  const kidsOf = (n: BinderNode): BinderNode[] =>
    (n as { children?: BinderNode[] }).children ?? [];

  // 장 폴더 목록 — label "manuscript" 인 루트가 정본. 없으면 «최상위 폴더가
  // 하나뿐일 때» 그것을 루트로 본다(옛 프로젝트 호환).
  const labeled = roots.find(
    (n) => n.type === "folder" && (n as { label?: string }).label === "manuscript",
  );
  const base =
    labeled ??
    (roots.length === 1 && roots[0]?.type === "folder" ? roots[0] : null);
  const chapters = (base ? kidsOf(base) : roots).filter(
    (n) => n.type === "folder",
  );

  const firstDocument = (node: BinderNode): BinderNode | null => {
    for (const k of kidsOf(node)) {
      if (k.type === "document") return k;
      const deeper = firstDocument(k);
      if (deeper) return deeper;
    }
    return null;
  };

  for (const chap of chapters) {
    const scene = firstDocument(chap);
    if (!scene) continue; // 장면이 없는 장은 쓸 자리가 없다
    out.push({
      sceneId: scene.id,
      chapterTitle: chap.title,
      chapterSynopsis: (chap as { synopsis?: string }).synopsis ?? "",
      sceneTitle: scene.title,
    });
  }
  return out;
}

/**
 * 한 장의 프롬프트. 「무엇을 쓰는가」보다 「무엇을 쓰지 않는가」를 먼저 못박는다 —
 * 안 그러면 모델이 장 제목을 다시 설명하거나 개요를 되풀이한다.
 */
export function buildChapterPrompt(input: {
  concept: string;
  planning: string;
  chapterTitle: string;
  chapterSynopsis: string;
  index: number;
  total: number;
}): string {
  return `당신은 이 원고의 대필 작가입니다. 아래 기획을 읽고 **${input.index}장 본문만** 씁니다.

# 이 글의 기획

${input.planning.trim()}

# 컨셉·트리트먼트

${input.concept.trim()}

# 지금 쓸 장

- 전체 ${input.total}장 중 **${input.index}장**
- 제목: ${input.chapterTitle}
- 이 장이 맡은 것: ${input.chapterSynopsis || "(기획의 해당 대목을 따르십시오)"}

# 쓰기 전에 생각할 것

먼저 스스로 정하십시오. 이 장이 «독자의 마음을 어디에서 어디로» 옮기는가.
그 이동이 일어나는 «구체적인 장면» 하나를 고르십시오. 그 장면을 쓰는 것이
이 장입니다. 요약하지 말고 겪게 하십시오.

# 지킬 것

- 기획에 적힌 **톤과 사람(1인칭/3인칭)** 을 그대로 따릅니다.
- 장 제목을 본문에 **다시 쓰지 않습니다**. 개요를 되풀이하지 않습니다.
- 「~할 것이다」식 예고, 「이 장에서는」식 메타 문장을 쓰지 않습니다.
- 앞뒤 장을 넘겨다보지 않습니다. 이 장만 완결합니다.
- 분량은 800~1500자. 문단은 3~6개.

# 출력 형식

본문만 출력하십시오. 제목·머리말·설명·따옴표 감싸기 없이, 바로 첫 문장부터 씁니다.`;
}

/** 모델이 자꾸 붙이는 껍데기를 걷어낸다. */
export function stripWrapper(text: string): string {
  let s = text.trim();
  // ```로 감싼 경우
  const fence = s.match(/^```[a-zA-Z]*\n([\s\S]*?)\n```$/);
  if (fence) s = fence[1].trim();
  // 첫 줄이 장 제목 헤딩이면 떼어낸다
  s = s.replace(/^#{1,6}\s+.*\n+/, "");
  return s.trim();
}

/**
 * 장마다 AI 를 한 번씩 불러 본문을 채운다.
 *
 * 이미 본문이 있는 장면은 건너뛴다. 한 장이 실패해도 멈추지 않는다.
 */
export async function draftChapters(
  projectFolder: string,
  binder: BinderTree | null,
  deps: DraftDeps,
): Promise<DraftResult> {
  const targets = collectDraftTargets(binder);
  const result: DraftResult = {
    written: 0,
    skipped: 0,
    failed: 0,
    failedTitles: [],
    aborted: false,
  };
  if (targets.length === 0) return result;

  // 재료는 한 번만 읽는다 — 장마다 다시 읽으면 아홉 번 읽는다.
  const concept = await readOrEmpty(`${projectFolder}/concept-summary.md`);
  const planning = await readOrEmpty(`${projectFolder}/planning.md`);

  let index = 0;
  for (const t of targets) {
    index += 1;
    if (deps.signal?.aborted) {
      result.aborted = true;
      break;
    }

    deps.onProgress?.({
      done: result.written + result.skipped + result.failed,
      total: targets.length,
      current: t.chapterTitle,
    });

    const existing = deps.readSceneBody(t.sceneId);
    if (existing && existing.trim().length > 0) {
      result.skipped += 1;
      continue;
    }

    try {
      const handle = startAiInvocation({
        provider: deps.provider,
        binaryPath: deps.binaryPath,
        extraArgs: splitArgs(deps.extraArgs),
        prompt: buildChapterPrompt({
          concept,
          planning,
          chapterTitle: t.chapterTitle,
          chapterSynopsis: t.chapterSynopsis,
          index,
          total: targets.length,
        }),
        timeoutSecs: deps.timeoutSecs ?? 300,
        signal: deps.signal,
      });

      const outcome = await handle.done;
      const body = stripWrapper(outcome.fullText ?? "");
      if (body.length === 0) throw new Error("빈 응답");

      deps.setSceneDraft(t.sceneId, body);
      await deps.saveScene(t.sceneId);
      result.written += 1;
    } catch (err) {
      if (deps.signal?.aborted) {
        result.aborted = true;
        break;
      }
      result.failed += 1;
      result.failedTitles.push(t.chapterTitle);
      // eslint-disable-next-line no-console
      console.warn(`[wizardDraft] ${t.chapterTitle} 실패`, err);
    }
  }

  deps.onProgress?.({
    done: result.written + result.skipped + result.failed,
    total: targets.length,
    current: "",
  });
  return result;
}

async function readOrEmpty(path: string): Promise<string> {
  try {
    return await tauriVaultAdapter.readFile(path);
  } catch {
    return "";
  }
}

/** CLIWizardBridge 와 같은 규칙 — 공백으로 자르되 빈 토큰은 버린다. */
function splitArgs(raw?: string): string[] {
  return (raw ?? "").split(/\s+/).filter(Boolean);
}

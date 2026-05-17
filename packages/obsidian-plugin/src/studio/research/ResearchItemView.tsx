// ResearchItemView.tsx — 선택된 ResearchItem 의 본문 미리보기 + 리라이트 액션.
//
// 사용자가 미리보기 영역에서 텍스트를 드래그-선택하면 "내 목소리로 삽입" 버튼이 활성화된다.
// 클릭 시 voiceRewriter.rewriteSelectionInVoice 가 활성 에디터 커서에 토큰을 흘려넣는다.

import { useCallback, useEffect, useRef, useState } from "react";
import { marked } from "marked";

import type { ResearchItem } from "./researchIO";
import { rewriteSelectionInVoice } from "./voiceRewriter";
import * as editorRegistry from "../editor/editorRegistry";
import { useProjectStore } from "../state/projectStore";
import { useResearchStore } from "../state/researchStore";
import { tauriNoticeAdapter } from "../noticeAdapter";

interface ResearchItemViewProps {
  item: ResearchItem;
}

/** 리서치 결과의 참고 링크들을 binder node 의 customMetadata.links 에 누적. */
async function mergeResearchLinksIntoNode(
  nodeId: string,
  newLinks: string[],
  updateMetadata: (id: string, m: Record<string, string>) => Promise<void>,
): Promise<void> {
  const ps = useProjectStore.getState();
  const node = ps.binder
    ? findBinderNodeById(ps.binder.root, nodeId)
    : null;
  if (!node) return;
  const meta = node.customMetadata ?? {};
  let existing: string[] = [];
  const raw = meta.links;
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        existing = parsed.filter((x): x is string => typeof x === "string");
      }
    } catch {
      existing = raw
        .split(/[\n,]+/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    }
  }
  const merged = Array.from(new Set([...existing, ...newLinks]));
  if (merged.length === existing.length) return; // 변화 없음.
  await updateMetadata(nodeId, { ...meta, links: JSON.stringify(merged) });
}

function findBinderNodeById(
  nodes: ReadonlyArray<unknown>,
  id: string,
): { customMetadata?: Record<string, string> } | null {
  for (const n of nodes as Array<{
    id: string;
    type: string;
    children?: unknown[];
    customMetadata?: Record<string, string>;
  }>) {
    if (n.id === id) return n;
    if (n.type === "folder" && n.children) {
      const r = findBinderNodeById(n.children as ReadonlyArray<unknown>, id);
      if (r) return r;
    }
  }
  return null;
}

export function ResearchItemView(props: ResearchItemViewProps): JSX.Element {
  const { item } = props;
  const previewRef = useRef<HTMLDivElement | null>(null);
  const [selection, setSelection] = useState<string>("");
  const isRewriting = useResearchStore((s) => s.isRewriting);
  const setRewriting = useResearchStore((s) => s.setRewriting);

  const selectedNodeIds = useProjectStore((s) => s.selectedNodeIds);
  const binder = useProjectStore((s) => s.binder);
  const updateNodeCustomMetadata = useProjectStore(
    (s) => s.updateNodeCustomMetadata,
  );

  // editorRegistry 가 register/unregister 될 때마다 재렌더 — 활성 에디터가
  // 비동기로 mount 되어 has() 결과가 바뀔 수 있다.
  const [, forceTick] = useState(0);
  useEffect(() => {
    return editorRegistry.subscribe(() => forceTick((x) => x + 1));
  }, []);

  // 삽입 대상 docId 결정 — 우선순위:
  //   1) 바인더에서 단일 document 가 선택되어 있고 editorRegistry 에 등록된 경우
  //   2) 그 외 (폴더 선택 / 다중 선택 / 무선택) → editorRegistry 에 등록된 가장 최근 에디터
  //
  // 이전 버전은 (1) 만 인정했기 때문에 폴더만 선택된 상태에서 리서치 미리보기에서
  // 텍스트를 선택해도 버튼이 영구 비활성화되는 버그가 있었다. (2) 의 fallback 으로
  // "지금 화면에 마운트된 에디터" 가 하나라도 있으면 그 커서에 삽입한다.
  const targetDocId = (() => {
    if (binder && selectedNodeIds.length === 1) {
      const id = selectedNodeIds[0];
      if (editorRegistry.has(id)) return id;
    }
    return editorRegistry.getMostRecentId();
  })();
  const targetIsFallback =
    !!targetDocId &&
    (selectedNodeIds.length !== 1 || selectedNodeIds[0] !== targetDocId);

  // 미리보기 안에서 selection 변경 감지.
  // selectionchange 는 document 전역이라, 우리 영역 내부 selection 만 추출.
  useEffect(() => {
    const handler = (): void => {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || !previewRef.current) {
        setSelection("");
        return;
      }
      const range = sel.getRangeAt(0);
      if (
        previewRef.current.contains(range.startContainer) &&
        previewRef.current.contains(range.endContainer)
      ) {
        setSelection(sel.toString());
      } else {
        setSelection("");
      }
    };
    document.addEventListener("selectionchange", handler);
    return () => document.removeEventListener("selectionchange", handler);
  }, []);

  const html = useCallback(() => {
    const body = item.body || "(본문 로드 중…)";
    try {
      // marked 는 sync 모드 사용 — 큰 문서는 짧으니 OK.
      return marked.parse(body, { async: false }) as string;
    } catch {
      return `<pre>${body.replace(/[<>&]/g, (c) =>
        c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;",
      )}</pre>`;
    }
  }, [item.body]);

  const handleRewrite = async (): Promise<void> => {
    if (!targetDocId) {
      tauriNoticeAdapter.warn(
        "삽입할 활성 에디터가 없습니다. 바인더에서 장면을 하나 열어주세요.",
      );
      return;
    }
    if (!selection.trim()) return;
    setRewriting(true);
    try {
      await rewriteSelectionInVoice({
        activeDocId: targetDocId,
        selectionText: selection,
        researchTitle: item.title,
      });
      // 본문 삽입 직후 — 이 리서치 결과의 참고 링크를 활성 장면의
      // customMetadata.links 에 누적해서 인스펙터 "참고 링크" 패널에 노출.
      // 중복 url 은 NodeLinksEditor 에서 dedup 되므로 그냥 push 만 한다.
      if (item.links.length > 0) {
        await mergeResearchLinksIntoNode(
          targetDocId,
          item.links,
          updateNodeCustomMetadata,
        );
      }
    } finally {
      setRewriting(false);
    }
  };

  const handleAttachLinks = async (): Promise<void> => {
    if (!targetDocId) {
      tauriNoticeAdapter.warn("활성 에디터가 없어 링크를 첨부할 수 없습니다.");
      return;
    }
    if (item.links.length === 0) {
      tauriNoticeAdapter.info("이 리서치 결과에 첨부할 링크가 없습니다.");
      return;
    }
    await mergeResearchLinksIntoNode(
      targetDocId,
      item.links,
      updateNodeCustomMetadata,
    );
    tauriNoticeAdapter.info(
      `참고 링크 ${item.links.length}개를 인스펙터에 추가했습니다.`,
    );
  };

  const rewriteDisabled =
    !targetDocId || !selection.trim() || isRewriting;

  const hint = !targetDocId
    ? "바인더에서 본문을 쓸 장면을 먼저 열어주세요"
    : !selection.trim()
      ? "본문에서 변환할 텍스트를 드래그로 선택하세요"
      : targetIsFallback
        ? "현재 열려 있는 에디터에 삽입됩니다 (바인더 선택과 다를 수 있음)"
        : null;

  return (
    <div className="research-item-view">
      <div className="research-item-view-sticky">
        <div className="research-item-view-header">
          <div className="research-item-view-title">{item.title}</div>
          <div className="research-item-view-meta">
            <span>{new Date(item.createdAt).toLocaleString("ko-KR")}</span>
            {item.links.length > 0 && (
              <span> · 링크 {item.links.length}개</span>
            )}
          </div>
        </div>

        <div className="research-item-view-actions">
          <button
            type="button"
            // 버튼 mousedown 시 default 동작(포커스 이동)이 일어나면 미리보기에서
            // 잡아둔 텍스트 선택이 풀려 click 시점에 selection.trim() == "" 가 된다.
            // preventDefault 로 포커스 이동을 막아 선택을 보존한다.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => void handleRewrite()}
            disabled={rewriteDisabled}
            title={
              hint ??
              (isRewriting
                ? "리라이트 진행 중…"
                : "선택한 텍스트를 내 문체로 다시 써서 활성 에디터 커서에 삽입")
            }
          >
            {isRewriting ? "리라이트 중…" : "내 문체로 본문에 삽입"}
          </button>
          {item.links.length > 0 && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => void handleAttachLinks()}
              disabled={!targetDocId}
              title={
                targetDocId
                  ? `이 리서치 결과의 참고 링크 ${item.links.length}개를 인스펙터에 첨부`
                  : "활성 에디터가 없습니다"
              }
            >
              참고 링크 {item.links.length}개 인스펙터에 첨부
            </button>
          )}
          {selection && (
            <span className="research-item-view-selsize">
              {selection.length.toLocaleString()}자 선택
            </span>
          )}
        </div>

        {hint && (
          <div className="research-item-view-hint" data-testid="rewrite-hint">
            {hint}
          </div>
        )}
      </div>

      <div
        ref={previewRef}
        className="research-item-view-body"
        // marked 결과는 trusted source(Codex CLI 자체 출력)지만, 사용자 환경에서
        // 외부 링크가 들어올 수 있으므로 a[target=_blank] noreferrer 부착.
        // marked.parse 는 raw HTML 을 그대로 두지 않게 설정 가능하나 기본도 충분.
        dangerouslySetInnerHTML={{ __html: html() }}
      />

      {item.links.length > 0 && (
        <div className="research-item-view-links">
          <div className="research-item-view-links-title">참고 링크</div>
          <ul>
            {item.links.map((u) => (
              <li key={u}>
                <a href={u} target="_blank" rel="noreferrer noopener">
                  {u.length > 80 ? `${u.slice(0, 80)}…` : u}
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

// EditorPane.tsx — 가운데 패널.
// 현재 선택에 따라 분기:
//   - 0개   → 안내 화면
//   - 1개 (folder) → "코크보드를 보거나 첫 장면을 추가해주세요"
//   - 1개 (document) → 첨부면 DocumentViewer / 아니면 SimpleMarkdownEditor
//   - 2개 이상 → ScrivenerEditor
//
// 외부 파일 드롭은 BinderPane(트리)에서만 처리. EditorPane 영역에서는 첨부 노드가
// 선택됐을 때 그 파일을 표시만 한다 (스크리브너의 Research 폴더 패턴).

import { useEffect } from "react";
import type { BinderDocument, BinderNode } from "@ai-manuscript-studio/core";
import { useProjectStore } from "../state/projectStore";
import { descendantDocuments, findBinderNode } from "../state/binderQueries";
import { useThemePreference } from "../theme/themeStore";
import { RichEditor } from "./RichEditor";
import { ScrivenerEditor } from "./ScrivenerEditor";
import { DocumentViewer } from "./DocumentViewer";
import { Corkboard } from "../corkboard/Corkboard";
import { tauriNoticeAdapter } from "../noticeAdapter";

const ATTACHMENT_KEY = "attachment";
const ATTACHMENT_NAME_KEY = "attachment_name";

export function EditorPane(): JSX.Element {
  const meta = useProjectStore((s) => s.meta);
  const binder = useProjectStore((s) => s.binder);
  const selectedIds = useProjectStore((s) => s.selectedNodeIds);
  const viewMode = useProjectStore((s) => s.viewMode);
  const sceneCache = useProjectStore((s) => s.sceneCache);
  const ensureSceneLoaded = useProjectStore((s) => s.ensureSceneLoaded);
  const setSceneDraft = useProjectStore((s) => s.setSceneDraft);
  const saveScene = useProjectStore((s) => s.saveScene);
  const updateNodeCustomMetadata = useProjectStore(
    (s) => s.updateNodeCustomMetadata,
  );

  const { theme, bodyFont } = useThemePreference();
  const dark = theme === "dark";

  const selectedNodes: BinderNode[] = [];
  if (binder) {
    for (const id of selectedIds) {
      const n = findBinderNode(binder, id);
      if (n) selectedNodes.push(n);
    }
  }

  const documents = selectedNodes.filter(
    (n): n is BinderDocument => n.type === "document",
  );
  const folders = selectedNodes.filter((n) => n.type === "folder");
  const singleFolder = folders.length === 1 && documents.length === 0
    ? folders[0]
    : null;

  const folderDescendants = singleFolder
    ? descendantDocuments(singleFolder)
    : [];

  // shortcut 노드 — folder/document 무관하게 linkedFile 이 있으면 본문 cache 로드.
  const singleShortcut =
    selectedNodes.length === 1 && selectedNodes[0].linkedFile
      ? selectedNodes[0]
      : null;

  useEffect(() => {
    if (singleShortcut) {
      void ensureSceneLoaded(singleShortcut.id);
    } else if (documents.length === 1) {
      void ensureSceneLoaded(documents[0].id);
    }
  }, [singleShortcut?.id, documents, ensureSceneLoaded]);

  useEffect(() => {
    if (singleFolder && viewMode !== "corkboard") {
      for (const d of folderDescendants) void ensureSceneLoaded(d.id);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    singleFolder?.id,
    folderDescendants.map((d) => d.id).join("|"),
    viewMode,
  ]);

  if (!meta || !binder) {
    return (
      <>
        <div className="pane-header">에디터</div>
        <div className="pane-body">
          <div className="pane-empty">프로젝트가 열려 있지 않습니다.</div>
        </div>
      </>
    );
  }

  const detachAttachment = async (target: BinderDocument): Promise<void> => {
    const next = { ...(target.customMetadata ?? {}) };
    delete next[ATTACHMENT_KEY];
    delete next[ATTACHMENT_NAME_KEY];
    await updateNodeCustomMetadata(target.id, next);
    tauriNoticeAdapter.info("첨부를 해제했습니다. (파일은 디스크에 남음)");
  };

  // shortcut 노드 — folder 든 document 든 linkedFile 이 있으면 그 외부 파일을 RichEditor 로
  // 표시한다 (Scrivener "folder-with-text"). 자식은 binder 트리에 그대로 남아 사이드바에서 접근 가능.
  if (singleShortcut) {
    const cache = sceneCache[singleShortcut.id];
    return (
      <>
        <EditorTabBar nodes={selectedNodes} />
        <div className="pane-body editor-pane-body editor-pane-body--flush">
          {!cache ? (
            <p className="pane-hint" style={{ padding: 16 }}>
              연결된 파일을 불러오는 중…
            </p>
          ) : (
            <RichEditor
              docId={singleShortcut.id}
              body={cache.body}
              draft={cache.draft}
              onChange={(next) => setSceneDraft(singleShortcut.id, next)}
              onSave={() => void saveScene(singleShortcut.id)}
              dark={dark}
              bodyFont={bodyFont}
            />
          )}
        </div>
      </>
    );
  }

  // 코크보드.
  if (singleFolder && viewMode === "corkboard") {
    return (
      <>
        <EditorTabBar nodes={selectedNodes} />
        <div className="pane-body editor-pane-body">
          <Corkboard folder={singleFolder} />
        </div>
      </>
    );
  }

  // 폴더 Scrivenings.
  if (singleFolder && folderDescendants.length > 0) {
    return (
      <>
        <EditorTabBar nodes={selectedNodes} />
        <div className="pane-body editor-pane-body editor-pane-body--flush">
          <ScrivenerEditor documents={folderDescendants} />
        </div>
      </>
    );
  }

  // 다중 선택 Scrivenings.
  if (documents.length > 1) {
    return (
      <>
        <EditorTabBar nodes={selectedNodes} />
        <div className="pane-body editor-pane-body editor-pane-body--flush">
          <ScrivenerEditor documents={documents} />
        </div>
      </>
    );
  }

  // 단일 document — attachment 또는 markdown.
  if (documents.length === 1) {
    const d = documents[0];
    const cache = sceneCache[d.id];
    const attachmentPath = d.customMetadata?.[ATTACHMENT_KEY];
    const attachmentName = d.customMetadata?.[ATTACHMENT_NAME_KEY];

    return (
      <>
        <EditorTabBar nodes={selectedNodes} />
        <div className="pane-body editor-pane-body editor-pane-body--flush">
          {attachmentPath ? (
            <DocumentViewer
              attachmentPath={attachmentPath}
              displayName={attachmentName}
              onDetach={() => void detachAttachment(d)}
            />
          ) : !cache ? (
            <p className="pane-hint" style={{ padding: 16 }}>
              불러오는 중…
            </p>
          ) : (
            <RichEditor
              docId={d.id}
              body={cache.body}
              draft={cache.draft}
              onChange={(next) => setSceneDraft(d.id, next)}
              onSave={() => void saveScene(d.id)}
              dark={dark}
              bodyFont={bodyFont}
            />
          )}
        </div>
      </>
    );
  }

  // 빈 폴더 / 선택 없음.
  return (
    <>
      <EditorTabBar nodes={selectedNodes} />
      <div className="pane-body">
        {singleFolder ? (
          <div className="pane-empty">
            <p className="pane-hint">
              폴더 "{singleFolder.title}" 안에 아직 장면이 없습니다.
              <br />
              + 버튼으로 장면을 추가하거나 헤더에서 "코크보드"로 전환하세요.
              <br />
              또는 PDF·이미지를 바인더 트리에 끌어다 놓으면 첨부 노드가 추가됩니다.
            </p>
          </div>
        ) : (
          <div className="pane-empty">
            <p className="pane-hint">바인더에서 장면을 선택해주세요.</p>
          </div>
        )}
      </div>
    </>
  );
}

interface EditorTabBarProps {
  nodes: BinderNode[];
}

function EditorTabBar(props: EditorTabBarProps): JSX.Element {
  const toggleSelection = useProjectStore((s) => s.toggleSelection);
  return (
    <div className="editor-tabbar">
      {props.nodes.length === 0 ? (
        <span className="editor-tabbar-empty">선택된 항목 없음</span>
      ) : (
        props.nodes.map((n) => (
          <button
            key={n.id}
            className="editor-tab"
            title={n.title}
            onClick={() => toggleSelection(n.id, "single")}
          >
            <span className="editor-tab-icon">
              {n.type === "folder" ? "▣" : "📄"}
            </span>
            <span className="editor-tab-title">{n.title || "(제목 없음)"}</span>
          </button>
        ))
      )}
    </div>
  );
}

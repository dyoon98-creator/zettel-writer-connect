// SourceNotesPane.tsx — project.json의 sourceNotes 위키링크 리스트.
// Phase F에서 옵시디언 점프를 실제로 처리. 현재는 클릭 시 안내 노티스만.

import { tauriNoticeAdapter } from "../noticeAdapter";

export interface SourceNotesPaneProps {
  sourceNotes: string[];
}

export function SourceNotesPane(props: SourceNotesPaneProps): JSX.Element {
  const { sourceNotes } = props;
  return (
    <div className="section">
      <div className="section-label">출처 자료 ({sourceNotes.length}개)</div>
      {sourceNotes.length === 0 ? (
        <div className="pane-hint">아직 출처 자료가 연결되지 않았습니다.</div>
      ) : (
        <ul className="source-notes-list">
          {sourceNotes.map((link, i) => (
            <li key={`${link}-${i}`}>
              <button
                className="source-note-link"
                onClick={() =>
                  tauriNoticeAdapter.info(
                    `옵시디언으로 점프 (Phase F): ${link}`,
                  )
                }
                title={link}
              >
                {link}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

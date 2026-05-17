// DocumentViewer.tsx — BinderDocument 의 customMetadata.attachment 가 가리키는
// 파일을 webview 안에 표시.
//
// 지원 타입:
//   - .pdf            → <iframe>
//   - .png/.jpg/...   → <img>
//   - .txt/.md/.json/.csv 등 텍스트 → <pre>
//   - 그 외           → 다운로드 / 외부에서 열기 안내
//
// 첨부 경로는 BinderDocument.customMetadata.attachment 에 vault 절대 경로로 보관.
// 같은 노드의 .md 파일은 그대로 유지 — 사용자가 첨부와 함께 노트를 적을 수 있음.

import { useMemo } from "react";

import { tauriNoticeAdapter } from "../noticeAdapter";
import { toAssetUrl } from "../vaultAdapter";

export interface DocumentViewerProps {
  /** vault 절대 경로 또는 vault-relative. */
  attachmentPath: string;
  /** 파일 원본명 (표시용). 없으면 경로의 basename. */
  displayName?: string;
  /** 사용자가 새 파일로 교체. */
  onReplace?: () => void;
  /** 사용자가 첨부 해제 → 일반 노트로 되돌림. */
  onDetach?: () => void;
}

type Kind = "pdf" | "image" | "text" | "audio" | "video" | "other";

const IMAGE_EXT = ["png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico", "avif"];
const TEXT_EXT = ["txt", "md", "markdown", "json", "csv", "tsv", "log", "yml", "yaml", "xml", "html", "htm"];
const AUDIO_EXT = ["mp3", "wav", "m4a", "ogg", "flac"];
const VIDEO_EXT = ["mp4", "mov", "webm", "mkv", "avi"];

function classifyExt(path: string): Kind {
  const m = path.toLowerCase().match(/\.([a-z0-9]+)$/);
  if (!m) return "other";
  const ext = m[1];
  if (ext === "pdf") return "pdf";
  if (IMAGE_EXT.includes(ext)) return "image";
  if (TEXT_EXT.includes(ext)) return "text";
  if (AUDIO_EXT.includes(ext)) return "audio";
  if (VIDEO_EXT.includes(ext)) return "video";
  return "other";
}

function basename(path: string): string {
  const norm = path.replace(/\\/g, "/").replace(/\/+$/, "");
  const idx = norm.lastIndexOf("/");
  return idx >= 0 ? norm.slice(idx + 1) : norm;
}

export function DocumentViewer(props: DocumentViewerProps): JSX.Element {
  const { attachmentPath, displayName, onReplace, onDetach } = props;

  const url = useMemo(() => {
    try {
      return toAssetUrl(attachmentPath);
    } catch (e) {
      tauriNoticeAdapter.error(
        `첨부 URL 생성 실패: ${e instanceof Error ? e.message : String(e)}`,
      );
      return "";
    }
  }, [attachmentPath]);

  const kind = classifyExt(attachmentPath);
  const name = displayName ?? basename(attachmentPath);

  return (
    <div className="doc-viewer">
      <div className="doc-viewer-toolbar">
        <span className="doc-viewer-name" title={attachmentPath}>
          📎 {name}
        </span>
        <span className="doc-viewer-kind">
          {kind === "pdf" && "PDF"}
          {kind === "image" && "이미지"}
          {kind === "text" && "텍스트"}
          {kind === "audio" && "오디오"}
          {kind === "video" && "비디오"}
          {kind === "other" && "파일"}
        </span>
        <span className="doc-viewer-spacer" />
        {onReplace && (
          <button
            type="button"
            className="doc-viewer-action"
            onClick={onReplace}
            title="다른 파일로 교체"
          >
            교체
          </button>
        )}
        {onDetach && (
          <button
            type="button"
            className="doc-viewer-action doc-viewer-action--danger"
            onClick={onDetach}
            title="첨부 해제 (파일은 디스크에 남음)"
          >
            첨부 해제
          </button>
        )}
      </div>
      <div className="doc-viewer-body">
        {url === "" ? (
          <div className="doc-viewer-fallback">
            <p>첨부 파일을 불러올 수 없습니다.</p>
            <code>{attachmentPath}</code>
          </div>
        ) : kind === "pdf" ? (
          <iframe
            src={url}
            className="doc-viewer-iframe"
            title={name}
          />
        ) : kind === "image" ? (
          <div className="doc-viewer-image-wrap">
            <img src={url} alt={name} className="doc-viewer-image" />
          </div>
        ) : kind === "audio" ? (
          <div className="doc-viewer-media-wrap">
            <audio src={url} controls className="doc-viewer-audio" />
          </div>
        ) : kind === "video" ? (
          <div className="doc-viewer-media-wrap">
            <video src={url} controls className="doc-viewer-video" />
          </div>
        ) : kind === "text" ? (
          <iframe
            src={url}
            className="doc-viewer-iframe doc-viewer-iframe--text"
            title={name}
          />
        ) : (
          <div className="doc-viewer-fallback">
            <p>이 파일 형식은 앱 안에서 미리볼 수 없습니다.</p>
            <p>경로:</p>
            <code>{attachmentPath}</code>
            <p style={{ marginTop: 12 }}>
              <a href={url} target="_blank" rel="noreferrer">
                새 창에서 열기
              </a>
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

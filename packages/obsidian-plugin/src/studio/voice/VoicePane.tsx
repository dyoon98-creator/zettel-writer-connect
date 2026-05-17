// VoicePane.tsx — '내 문체' 모달.
//
// 사용자가 글로벌 voice 폴더의 .md 파일들을 관리하고 AI 분석을 트리거.
// 분석 결과(StyleGuide)는 voiceRewriter 가 자동으로 사용한다.
//
// UX:
//   - 폴더 절대경로 표시 + "Finder/Explorer 로 열기"
//   - 파일 목록 (이름 / 크기 / 수정시각 / 삭제)
//   - stale 배지 + "재분석" 버튼
//   - 가드 5축 미리보기 (있을 때만)

import { useEffect, useState } from "react";

import { tauriNoticeAdapter } from "../noticeAdapter";

import { analyzeStyle } from "./analyzeStyle";
import {
  checkFreshness,
  deleteStyleGuide,
  type FreshnessReport,
} from "./styleGuide";
import { voiceIO } from "./voiceIO";
import { useVoiceStore } from "./voiceStore";

function formatBytes(n: number): string {
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)}KB`;
  return `${(n / 1024 / 1024).toFixed(2)}MB`;
}

function formatModified(ms: number): string {
  if (!ms) return "—";
  return new Date(ms).toLocaleString("ko-KR");
}

export function VoicePane(): JSX.Element | null {
  const isOpen = useVoiceStore((s) => s.isOpen);
  const close = useVoiceStore((s) => s.close);
  const isAnalyzing = useVoiceStore((s) => s.isAnalyzing);
  const setAnalyzing = useVoiceStore((s) => s.setAnalyzing);

  const [folder, setFolder] = useState<string>("");
  const [isCustom, setIsCustom] = useState<boolean>(false);
  const [defaultFolder, setDefaultFolder] = useState<string>("");
  const [report, setReport] = useState<FreshnessReport | null>(null);
  const [loading, setLoading] = useState(false);

  const reload = async (): Promise<void> => {
    setLoading(true);
    try {
      const [info, fresh] = await Promise.all([
        voiceIO.folderInfo(),
        checkFreshness(),
      ]);
      setFolder(info.path);
      setIsCustom(info.isCustom);
      setDefaultFolder(info.defaultPath);
      setReport(fresh);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`내 문체 폴더 로드 실패: ${msg}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePickFolder = async (): Promise<void> => {
    try {
      const picked = await voiceIO.pickFolder(folder || undefined);
      if (!picked) return;
      await voiceIO.setFolder(picked);
      tauriNoticeAdapter.info(`내 문체 폴더가 변경되었습니다: ${picked}`);
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`폴더 변경 실패: ${msg}`);
    }
  };

  const handleResetFolder = async (): Promise<void> => {
    if (
      !window.confirm(
        `기본 폴더로 되돌릴까요?\n\n${defaultFolder || "(기본 위치)"}`,
      )
    ) {
      return;
    }
    try {
      await voiceIO.resetFolder();
      tauriNoticeAdapter.info("기본 폴더로 되돌렸습니다.");
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`되돌리기 실패: ${msg}`);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    void reload();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleAnalyze = async (): Promise<void> => {
    if (isAnalyzing) return;
    setAnalyzing(true);
    try {
      const r = await analyzeStyle();
      if (r) await reload();
    } finally {
      setAnalyzing(false);
    }
  };

  const handleDelete = async (name: string): Promise<void> => {
    if (!window.confirm(`"${name}" 을(를) 삭제할까요?`)) return;
    try {
      await voiceIO.deleteFile(name);
      await reload();
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      tauriNoticeAdapter.error(`삭제 실패: ${msg}`);
    }
  };

  const handleResetCache = async (): Promise<void> => {
    if (!window.confirm("저장된 가드 캐시를 삭제할까요? (다음 재분석 시 새로 생성)")) {
      return;
    }
    await deleteStyleGuide();
    await reload();
  };

  const guide = report?.guide ?? null;

  return (
    <div className="voice-overlay" data-testid="voice-overlay">
      <div className="voice-overlay-window">
        <header className="voice-overlay-header">
          <h1>내 문체</h1>
          <span className="voice-overlay-spacer" />
          <button
            type="button"
            className="voice-overlay-cancel"
            onClick={close}
          >
            닫기
          </button>
        </header>

        <div className="voice-overlay-body">
          <section className="voice-section">
            <div className="voice-folder-row">
              <code className="voice-folder-path" title={folder}>
                {folder || "(경로 로딩 중)"}
              </code>
              {isCustom && (
                <span className="voice-folder-badge" title="사용자 지정 폴더">
                  사용자 지정
                </span>
              )}
              <button
                type="button"
                className="voice-btn"
                onClick={() => void handlePickFolder()}
                title="폴더 선택 다이얼로그를 엽니다"
              >
                폴더 선택…
              </button>
              {isCustom && (
                <button
                  type="button"
                  className="voice-btn"
                  onClick={() => void handleResetFolder()}
                  title={`기본 위치로 되돌리기: ${defaultFolder}`}
                >
                  기본으로
                </button>
              )}
              <button
                type="button"
                className="voice-btn"
                onClick={() => void voiceIO.openFolder()}
              >
                Finder 로 열기
              </button>
              <button
                type="button"
                className="voice-btn"
                onClick={() => void reload()}
                disabled={loading}
              >
                새로고침
              </button>
            </div>

            {report && (
              <div
                className={
                  "voice-status" +
                  (report.isStale
                    ? " voice-status--stale"
                    : report.hasGuide
                      ? " voice-status--ok"
                      : " voice-status--empty")
                }
              >
                {report.message}
              </div>
            )}

            <div className="voice-actions-row">
              <button
                type="button"
                className="voice-btn voice-btn--primary"
                onClick={() => void handleAnalyze()}
                disabled={isAnalyzing || loading || (report?.files.length ?? 0) === 0}
                title={
                  (report?.files.length ?? 0) === 0
                    ? ".md 파일을 먼저 폴더에 넣어주세요"
                    : "AI 가 글들을 읽고 보이스 가드를 생성합니다"
                }
              >
                {isAnalyzing ? "분석 중…" : "재분석"}
              </button>
              {guide && (
                <button
                  type="button"
                  className="voice-btn"
                  onClick={() => void handleResetCache()}
                  disabled={isAnalyzing}
                >
                  캐시 삭제
                </button>
              )}
            </div>
          </section>

          <section className="voice-section">
            <h2 className="voice-section-title">파일</h2>
            {report && report.files.length === 0 ? (
              <p className="voice-empty">아직 파일이 없습니다.</p>
            ) : (
              <ul className="voice-file-list">
                {report?.files.map((f) => (
                  <li key={f.absPath} className="voice-file-row">
                    <span className="voice-file-name" title={f.absPath}>
                      {f.name}
                    </span>
                    <span className="voice-file-meta">
                      {formatBytes(f.size)} · {formatModified(f.modifiedMs)}
                    </span>
                    <button
                      type="button"
                      className="voice-file-del"
                      onClick={() => void handleDelete(f.name)}
                      title="삭제"
                    >
                      ✕
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {guide && (
            <section className="voice-section">
              <h2 className="voice-section-title">현재 가드 (14단계 심층 분석)</h2>

              {/* §1 첫인상 키워드 5개 */}
              <div className="voice-keyword-row">
                {guide.guide.firstImpression.map((kw, i) => (
                  <span key={i} className="voice-keyword-chip">
                    #{kw}
                  </span>
                ))}
              </div>

              {/* §2~§10 각 영역 */}
              <div className="voice-guide-grid">
                <GuideAxis label="문장 호흡 (§2)" value={guide.guide.sentenceBreath} />
                <GuideAxis label="문장 구조 (§3)" value={guide.guide.sentenceStructure} />
                <GuideAxis label="어휘 성향 (§4)" value={guide.guide.vocabularyTendency} />
                <GuideAxis label="사고 전개 (§5)" value={guide.guide.thoughtFlow} />
                <GuideAxis label="독자와의 거리 (§6)" value={guide.guide.readerDistance} />
                <GuideAxis label="정서·태도 (§7)" value={guide.guide.emotionAndAttitude} />
                <GuideAxis label="비유·이미지 (§8)" value={guide.guide.metaphorAndImagery} />
                <GuideAxis label="강점 (§9)" value={guide.guide.strengths} />
                <GuideAxis label="약점 (§10)" value={guide.guide.weaknesses} full />
              </div>

              {/* §11 DNA */}
              <details className="voice-deep-block" open>
                <summary>내 문체 DNA (§11)</summary>
                <div className="voice-dna-grid">
                  <DnaRow label="문체 이름" value={guide.guide.styleDna.name} />
                  <DnaRow label="핵심 인상" value={guide.guide.styleDna.coreImpression} />
                  <DnaRow label="한 문장 정의" value={guide.guide.styleDna.oneLineDefinition} />
                  <DnaRow label="문장 호흡" value={guide.guide.styleDna.sentenceBreath} />
                  <DnaRow label="문장 구조" value={guide.guide.styleDna.sentenceStructure} />
                  <DnaRow label="어휘 성향" value={guide.guide.styleDna.vocabulary} />
                  <DnaRow label="사고 전개" value={guide.guide.styleDna.thoughtFlow} />
                  <DnaRow label="감정 온도" value={guide.guide.styleDna.emotionTemperature} />
                  <DnaRow label="독자와의 거리" value={guide.guide.styleDna.readerDistance} />
                  <DnaRow label="자주 쓰는 문장 패턴" value={guide.guide.styleDna.frequentSentencePatterns} />
                  <DnaRow label="자주 쓰는 사고 패턴" value={guide.guide.styleDna.frequentThoughtPatterns} />
                  <DnaRow label="강점" value={guide.guide.styleDna.strengths} />
                  <DnaRow label="약점" value={guide.guide.styleDna.weaknesses} />
                  <DnaRow label="유지해야 할 것" value={guide.guide.styleDna.keep} />
                  <DnaRow label="줄여야 할 것" value={guide.guide.styleDna.reduce} />
                  <DnaRow label="절대 잃으면 안 되는 특징" value={guide.guide.styleDna.nonNegotiable} />
                </div>
              </details>

              {/* §14 압축 프롬프트 — 다른 대화창에서 그대로 사용 가능 */}
              <details className="voice-deep-block">
                <summary>압축 문체 지침 프롬프트 (§14, 1,500자 이내)</summary>
                <div className="voice-compressed-prompt">
                  <pre>{guide.guide.compressedPrompt}</pre>
                  <button
                    type="button"
                    className="voice-btn"
                    onClick={() => {
                      void navigator.clipboard.writeText(guide.guide.compressedPrompt);
                      tauriNoticeAdapter.info("압축 프롬프트를 클립보드에 복사했습니다.");
                    }}
                  >
                    클립보드에 복사
                  </button>
                </div>
              </details>

              <p className="voice-guide-meta">
                {new Date(guide.analyzedAt).toLocaleString("ko-KR")} 분석 ·{" "}
                {guide.provider}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

interface GuideAxisProps {
  label: string;
  value: string;
  full?: boolean;
}

function GuideAxis(props: GuideAxisProps): JSX.Element {
  return (
    <div className={"voice-axis" + (props.full ? " voice-axis--full" : "")}>
      <span className="voice-axis-label">{props.label}</span>
      <span className="voice-axis-value">{props.value}</span>
    </div>
  );
}

function DnaRow({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className="voice-dna-row">
      <span className="voice-dna-label">{label}</span>
      <span className="voice-dna-value">{value}</span>
    </div>
  );
}

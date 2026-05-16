// SettingsPanel.tsx — 우상단 톱니 → 팝오버 형태의 설정 패널.
//
// 모든 변경은 settingsStore.update() 로 즉시 반영 + debounce 후 디스크 저장.

import { useState } from "react";
import {
  type AppSettings,
  useSettingsStore,
} from "../state/settingsStore";
import { useSkillpackStore } from "../state/skillpackStore";

function GearIcon(): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

export function SettingsPanel(): JSX.Element {
  const [open, setOpen] = useState(false);
  const settings = useSettingsStore((s) => s.settings);
  const update = useSettingsStore((s) => s.update);
  const reloadSkillpacks = useSkillpackStore((s) => s.reload);

  return (
    <>
      <button
        type="button"
        className="settings-toggle"
        title="설정"
        aria-label="설정"
        data-testid="settings-toggle"
        onClick={() => setOpen((v) => !v)}
      >
        <GearIcon />
      </button>
      {open && (
        <div
          className="settings-popover"
          role="dialog"
          aria-label="설정"
          data-testid="settings-popover"
        >
          <div className="settings-popover-header">
            <strong>설정</strong>
            <button
              type="button"
              className="settings-popover-close"
              onClick={() => setOpen(false)}
              aria-label="닫기"
            >
              ×
            </button>
          </div>
          <div className="settings-popover-body">
            <Field label="AI 어댑터">
              <select
                value={settings.aiProvider}
                onChange={(e) =>
                  void update({ aiProvider: e.target.value as AppSettings["aiProvider"] })
                }
                data-testid="settings-provider"
              >
                <option value="codex">Codex CLI</option>
                <option value="claude-code">Claude Code CLI</option>
                <option value="mock">목업 (테스트용)</option>
              </select>
            </Field>

            <Field label="Codex CLI 경로">
              <input
                type="text"
                value={settings.codexPath}
                onChange={(e) => void update({ codexPath: e.target.value })}
                placeholder="/usr/local/bin/codex"
                data-testid="settings-codex-path"
              />
            </Field>

            <Field label="Claude Code CLI 경로">
              <input
                type="text"
                value={settings.claudeCodePath}
                onChange={(e) => void update({ claudeCodePath: e.target.value })}
                placeholder="/usr/local/bin/claude"
                data-testid="settings-claude-path"
              />
            </Field>

            <Field label="추가 인자">
              <input
                type="text"
                value={settings.codexExtraArgs}
                onChange={(e) => void update({ codexExtraArgs: e.target.value })}
                placeholder="--model gpt-5"
                data-testid="settings-extra-args"
              />
            </Field>

            <FieldRow>
              <input
                type="checkbox"
                id="settings-confirm"
                checked={settings.confirmBeforeRun}
                onChange={(e) => void update({ confirmBeforeRun: e.target.checked })}
                data-testid="settings-confirm-toggle"
              />
              <label htmlFor="settings-confirm">실행 전 확인</label>
            </FieldRow>

            <FieldRow>
              <input
                type="checkbox"
                id="settings-execlog"
                checked={settings.enableExecLog}
                onChange={(e) => void update({ enableExecLog: e.target.checked })}
              />
              <label htmlFor="settings-execlog">실행 로그 저장</label>
            </FieldRow>

            <Field label="제외 폴더 (쉼표 구분)">
              <input
                type="text"
                value={settings.excludedFolders}
                onChange={(e) => void update({ excludedFolders: e.target.value })}
                data-testid="settings-excluded-folders"
              />
            </Field>

            <Field label="라이선스 키">
              <input
                type="password"
                value={settings.licenseKey}
                onChange={(e) => void update({ licenseKey: e.target.value })}
                data-testid="settings-license-key"
              />
            </Field>

            <FieldRow>
              <input
                type="checkbox"
                id="settings-mock"
                checked={settings.useMockBridge}
                onChange={(e) => void update({ useMockBridge: e.target.checked })}
                data-testid="settings-mock-bridge"
              />
              <label htmlFor="settings-mock">마법사를 목업으로 실행</label>
            </FieldRow>

            <div className="settings-footer">
              <button
                type="button"
                className="settings-action"
                onClick={() => void reloadSkillpacks()}
                data-testid="settings-reload-skillpacks"
              >
                스킬팩 새로고침
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function Field(props: { label: string; children: React.ReactNode }): JSX.Element {
  return (
    <div className="settings-field">
      <div className="settings-field-label">{props.label}</div>
      {props.children}
    </div>
  );
}

function FieldRow(props: { children: React.ReactNode }): JSX.Element {
  return <div className="settings-field-row">{props.children}</div>;
}

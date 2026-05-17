// SettingsPopover.tsx — 헤더 우측 작은 톱니바퀴 버튼.
// Phase D 한정: 테마 + 본문 폰트 두 가지만.

import { useEffect, useRef, useState } from "react";
import { useThemeStore } from "./themeStore";

// 옵시디언 기본 폰트(Inter) 에 ⚙ 글리프가 없는 환경 대비 inline SVG.
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

export function SettingsPopover(): JSX.Element {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement | null>(null);
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);
  const bodyFont = useThemeStore((s) => s.bodyFont);
  const setBodyFont = useThemeStore((s) => s.setBodyFont);

  useEffect(() => {
    function onDoc(e: MouseEvent): void {
      if (!open) return;
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="settings-popover-anchor" ref={ref}>
      <button
        className="header-icon-btn"
        onClick={() => setOpen((v) => !v)}
        title="환경설정"
        aria-label="환경설정"
      >
        <GearIcon />
      </button>
      {open && (
        <div className="settings-popover" role="dialog">
          <div className="settings-row">
            <span className="settings-label">테마</span>
            <div className="settings-segments">
              <button
                className={theme === "light" ? "settings-segment--active" : ""}
                onClick={() => setTheme("light")}
              >
                밝게
              </button>
              <button
                className={theme === "dark" ? "settings-segment--active" : ""}
                onClick={() => setTheme("dark")}
              >
                어둡게
              </button>
            </div>
          </div>
          <div className="settings-row">
            <span className="settings-label">본문 폰트</span>
            <div className="settings-segments">
              <button
                className={bodyFont === "serif" ? "settings-segment--active" : ""}
                onClick={() => setBodyFont("serif")}
              >
                명조
              </button>
              <button
                className={bodyFont === "sans" ? "settings-segment--active" : ""}
                onClick={() => setBodyFont("sans")}
              >
                고딕
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

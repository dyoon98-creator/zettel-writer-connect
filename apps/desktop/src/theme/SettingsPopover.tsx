// SettingsPopover.tsx — 헤더 우측 작은 톱니바퀴 버튼.
// Phase D 한정: 테마 + 본문 폰트 두 가지만.

import { useEffect, useRef, useState } from "react";
import { useThemeStore } from "./themeStore";

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
        ⚙
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

// themeStore.ts — light/dark + 본문 폰트 선호도. localStorage에 영속.
//
// Phase F에서 settings 파일로 옮길 예정 (지금은 가벼운 zustand store).

import { useEffect, useState } from "react";
import { create } from "zustand";

export type ThemeName = "light" | "dark";
export type BodyFont = "serif" | "sans";

const LS_THEME = "ams.theme";
const LS_FONT = "ams.bodyFont";

function readLocalTheme(): ThemeName {
  try {
    const v = localStorage.getItem(LS_THEME);
    if (v === "dark" || v === "light") return v;
  } catch {
    /* SSR / no-storage */
  }
  return "light";
}

function readLocalFont(): BodyFont {
  try {
    const v = localStorage.getItem(LS_FONT);
    if (v === "serif" || v === "sans") return v;
  } catch {
    /* swallow */
  }
  return "serif";
}

interface ThemeStoreState {
  theme: ThemeName;
  bodyFont: BodyFont;
  setTheme: (t: ThemeName) => void;
  setBodyFont: (f: BodyFont) => void;
}

export const useThemeStore = create<ThemeStoreState>((set) => ({
  theme: readLocalTheme(),
  bodyFont: readLocalFont(),
  setTheme(t) {
    set({ theme: t });
    try {
      localStorage.setItem(LS_THEME, t);
    } catch {
      /* swallow */
    }
  },
  setBodyFont(f) {
    set({ bodyFont: f });
    try {
      localStorage.setItem(LS_FONT, f);
    } catch {
      /* swallow */
    }
  },
}));

/** 컴포넌트에서 쓸 수 있는 얇은 훅. */
export function useThemePreference(): {
  theme: ThemeName;
  bodyFont: BodyFont;
} {
  const theme = useThemeStore((s) => s.theme);
  const bodyFont = useThemeStore((s) => s.bodyFont);
  return { theme, bodyFont };
}

/** body[data-theme]에 현재 theme를 쓰고 (CSS 변수 스왑), font-family도 갱신. */
export function useApplyThemeToDocument(): void {
  const { theme, bodyFont } = useThemePreference();
  useEffect(() => {
    document.body.dataset.theme = theme;
    document.body.dataset.bodyFont = bodyFont;
  }, [theme, bodyFont]);
}

/** SSR-safe useState wrapper for components that need to know the initial theme. */
export function useInitialTheme(): ThemeName {
  const [theme] = useState<ThemeName>(() => readLocalTheme());
  return theme;
}

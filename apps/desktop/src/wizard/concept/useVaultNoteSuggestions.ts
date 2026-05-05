// useVaultNoteSuggestions.ts — vault 안 노트 제목 목록을 한 번 fetch + 메모이즈.
//
// 컨셉 마법사 Step1Seed / Step2Concept 의 노트 첨부 input 에 datalist 자동완성을
// 채우는 데 사용. vault 가 바뀌면 다시 fetch.

import { useEffect, useRef, useState } from "react";

import { useProjectStore } from "../../state/projectStore";
import { listVaultNotes } from "../../vaultAdapter";

export interface VaultNoteSuggestionsState {
  notes: string[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useVaultNoteSuggestions(): VaultNoteSuggestionsState {
  const vaultPath = useProjectStore((s) => s.vaultPath);
  const [notes, setNotes] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const lastFetchedVaultRef = useRef<string | null>(null);
  const refreshTokenRef = useRef<number>(0);

  useEffect(() => {
    if (!vaultPath) {
      setNotes([]);
      lastFetchedVaultRef.current = null;
      return;
    }
    let cancelled = false;
    const token = refreshTokenRef.current;
    setIsLoading(true);
    setError(null);
    void (async () => {
      try {
        const list = await listVaultNotes(500);
        if (cancelled || token !== refreshTokenRef.current) return;
        setNotes(list);
        lastFetchedVaultRef.current = vaultPath;
      } catch (e) {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [vaultPath, refreshTokenRef.current]);

  const refresh = (): void => {
    refreshTokenRef.current += 1;
    // dependency tick — useEffect 가 다시 발사되도록 강제로 re-render.
    setNotes((prev) => prev.slice());
  };

  return { notes, isLoading, error, refresh };
}

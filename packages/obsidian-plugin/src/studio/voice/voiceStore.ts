// voiceStore.ts — '내 문체' 패널의 open 상태와 분석 진행 상태를 보관.
//
// VoicePane 자체의 데이터(파일 목록 / 가드)는 패널 mount 시 로드 → 로컬 state 로
// 관리. 글로벌하게 공유될 필요가 있는 건 진행 중 플래그(분석 1회만 동시) 와
// open/close 정도라 가볍게 둔다.

import { create } from "zustand";

export interface VoiceStoreState {
  isOpen: boolean;
  isAnalyzing: boolean;
  open: () => void;
  close: () => void;
  setAnalyzing: (v: boolean) => void;
}

export const useVoiceStore = create<VoiceStoreState>((set) => ({
  isOpen: false,
  isAnalyzing: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
  setAnalyzing: (v) => set({ isAnalyzing: v }),
}));

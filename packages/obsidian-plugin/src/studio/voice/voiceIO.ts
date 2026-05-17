// voiceIO.ts — 글로벌 "내 문체" 폴더 Tauri 커맨드 wrapper.
//
// Rust 측 voice_* 명령을 호출. 폴더 자체는 Rust 가 첫 호출 시 자동 생성한다.
// 모든 함수는 단순 invoke wrapper — 비즈니스 로직은 styleGuide / analyzeStyle 에.

import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

export interface VoiceFileEntry {
  /** 파일명 (디렉토리 포함하지 않음). */
  name: string;
  /** 절대 경로. Finder 열기 / 사용자 표시용. */
  absPath: string;
  /** 마지막 수정 시각 (ms). 정렬 / stale 비교에 사용. */
  modifiedMs: number;
  /** 바이트 크기. 너무 큰 파일은 분석에서 잘릴 수 있음. */
  size: number;
}

export interface VoiceFolderInfo {
  /** 현재 사용 중인 voice 폴더 절대경로. */
  path: string;
  /** true 면 사용자가 직접 지정한 폴더, false 면 기본 위치. */
  isCustom: boolean;
  /** 기본 위치 절대경로 (사용자에게 '되돌리기' 안내용). */
  defaultPath: string;
}

export const voiceIO = {
  async path(): Promise<string> {
    return await invoke<string>("voice_path");
  },

  async folderInfo(): Promise<VoiceFolderInfo> {
    return await invoke<VoiceFolderInfo>("voice_folder_info");
  },

  /**
   * 시스템 폴더 선택 다이얼로그를 띄워 사용자가 고른 절대경로를 반환.
   * 사용자가 취소하면 null.
   */
  async pickFolder(currentPath?: string): Promise<string | null> {
    const result = await openDialog({
      directory: true,
      multiple: false,
      title: "내 문체 폴더 선택",
      defaultPath: currentPath,
    });
    if (typeof result === "string") return result;
    return null;
  },

  async setFolder(path: string): Promise<VoiceFolderInfo> {
    return await invoke<VoiceFolderInfo>("voice_set_folder", { path });
  },

  async resetFolder(): Promise<VoiceFolderInfo> {
    return await invoke<VoiceFolderInfo>("voice_reset_folder");
  },

  async listFiles(): Promise<VoiceFileEntry[]> {
    return await invoke<VoiceFileEntry[]>("voice_list_files");
  },

  async readFile(absPath: string): Promise<string> {
    return await invoke<string>("voice_read_file", { path: absPath });
  },

  async writeFile(name: string, content: string): Promise<string> {
    return await invoke<string>("voice_write_file", { name, content });
  },

  async deleteFile(name: string): Promise<void> {
    await invoke("voice_delete_file", { name });
  },

  async openFolder(): Promise<void> {
    await invoke("voice_open_folder");
  },
};

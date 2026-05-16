// skillpackStore.ts — 데스크톱 앱의 스킬팩 로더 (브라우저 friendly).
//
// 코어의 `SkillPackLoader`는 Node `fs`를 쓰므로 그대로 import할 수 없다.
// 대신 VaultAdapter (Tauri invoke) 위에서 같은 동작을 다시 구현한다.
//
// - vaultPath / settings.skillpackFolder 로 폴더 listing
// - 각 폴더 안 skillpack.json 파싱 + 프롬프트 파일 읽기
// - 라이선스 검증은 Web Crypto API (HMAC-SHA256) 로 수행
// - 결과는 `LoadedSkillPack[]` 으로 정규화하여 ActionRegistry 에 주입 가능

import { create } from "zustand";
import {
  sanitizeManifestBrowser,
  type LicenseStatus,
  type LoadedSkillPack,
  type SkillPackManifest,
} from "./skillpackTypes";
import { tauriVaultAdapter } from "../vaultAdapter";
import { tauriNoticeAdapter } from "../noticeAdapter";
import { useSettingsStore } from "./settingsStore";
import { useProjectStore } from "./projectStore";

// ---- Web Crypto HMAC ------------------------------------------------------

async function hmacSha256Hex(message: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let hex = "";
  for (let i = 0; i < bytes.length; i += 1) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}

async function verifyLicense(
  manifest: SkillPackManifest,
  userKey: string,
): Promise<LicenseStatus> {
  if (manifest.tier === "free") return { kind: "free" };
  const trimmed = userKey.trim();
  if (!trimmed) {
    return { kind: "missing", reason: "라이선스 키가 입력되지 않았습니다." };
  }
  if (!manifest.license) {
    return { kind: "invalid", reason: "스킬팩에 라이선스 정보가 없습니다." };
  }
  const expected = await hmacSha256Hex(trimmed, manifest.license.issuer);
  if (expected !== manifest.license.checksum) {
    return { kind: "invalid", reason: "라이선스 키가 맞지 않습니다." };
  }
  return { kind: "ok" };
}

// ---- Loader ---------------------------------------------------------------

async function loadSkillpacks(
  vaultPath: string,
  skillpackFolder: string,
  licenseKey: string,
): Promise<LoadedSkillPack[]> {
  const folderRel = skillpackFolder;
  const out: LoadedSkillPack[] = [];

  let entries: { name: string; isDirectory: boolean }[];
  try {
    entries = await tauriVaultAdapter.listDir(folderRel);
  } catch {
    return out; // 폴더 자체가 없으면 비어있는 결과
  }

  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    if (!entry.isDirectory) continue;

    const packRel = `${folderRel}/${entry.name}`;
    const manifestPath = `${packRel}/skillpack.json`;

    let raw: string;
    try {
      raw = await tauriVaultAdapter.readFile(manifestPath);
    } catch {
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      tauriNoticeAdapter.warn(
        `스킬팩 [${entry.name}]: 매니페스트 JSON 파싱 실패`,
      );
      continue;
    }

    const manifest = sanitizeManifestBrowser(parsed);
    if (!manifest) {
      tauriNoticeAdapter.warn(
        `스킬팩 [${entry.name}]: 매니페스트 형식이 올바르지 않습니다.`,
      );
      continue;
    }

    const promptByActionId: Record<string, string> = {};
    for (const action of manifest.actions) {
      const promptPath = `${packRel}/${action.prompt_file}`;
      try {
        const body = await tauriVaultAdapter.readFile(promptPath);
        promptByActionId[action.id] = body;
      } catch {
        tauriNoticeAdapter.warn(
          `스킬팩 [${manifest.id}]: 프롬프트 파일을 읽을 수 없습니다 (${action.prompt_file})`,
        );
      }
    }

    const license = await verifyLicense(manifest, licenseKey);
    out.push({
      manifest,
      folderPath: packRel,
      promptByActionId,
      license,
    });
  }

  // vaultPath 변수는 cache invalidation 키로만 사용 — 실제 호출에선 vault adapter
  // 가 abs() 변환 시 사용한다.
  void vaultPath;
  return out;
}

// ---- Zustand store --------------------------------------------------------

export interface SkillpackStoreState {
  packs: LoadedSkillPack[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export const useSkillpackStore = create<SkillpackStoreState>((set) => ({
  packs: [],
  loading: false,
  error: null,
  async reload() {
    const settings = useSettingsStore.getState().settings;
    const vaultPath = useProjectStore.getState().vaultPath;
    if (!vaultPath) {
      set({ packs: [], error: null });
      return;
    }
    set({ loading: true, error: null });
    try {
      const packs = await loadSkillpacks(
        vaultPath,
        settings.skillpackFolder,
        settings.licenseKey,
      );
      set({ packs, loading: false });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      set({ loading: false, error: msg });
    }
  },
}));

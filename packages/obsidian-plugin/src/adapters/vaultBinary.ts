// vaultBinary.ts — Tauri 의 vault_copy_file / 첨부 binary 쓰기 헬퍼를
// 옵시디언 Vault adapter (binary write) + Electron fs (외부 절대경로 copy)
// 로 대체.
//
// 사용처: 컨셉 마법사가 사용자가 드래그한 PDF / 이미지를 _attachments 로
// 가져오거나, 음성 파일을 vault 안으로 저장할 때.

import type { App } from "obsidian";
import { electronRequire } from "./electronBridge";

export interface VaultBinaryHelperOptions {
  app: App;
}

export class ObsidianVaultBinaryHelper {
  constructor(private readonly app: App) {}

  /** vault-relative 경로에 binary 데이터 쓰기 (부모 디렉토리 자동 생성). */
  async writeAttachmentBinary(
    rel: string,
    data: Uint8Array | ArrayBuffer,
  ): Promise<void> {
    const slash = rel.lastIndexOf("/");
    if (slash > 0) {
      const parent = rel.slice(0, slash);
      const exists = await this.app.vault.adapter.exists(parent);
      if (!exists) {
        try {
          await this.app.vault.createFolder(parent);
        } catch {
          /* race-tolerant */
        }
      }
    }
    const buf = data instanceof Uint8Array ? data.buffer.slice(
      data.byteOffset,
      data.byteOffset + data.byteLength,
    ) : data;
    await this.app.vault.adapter.writeBinary(rel, buf as ArrayBuffer);
  }

  /**
   * 외부 절대경로의 파일을 vault 안 (또는 임의 절대경로) 으로 복사.
   * binary 안전. Tauri webview 의 native drag-drop 으로 받은 OS 절대경로를
   * vault 안으로 가져올 때 사용.
   */
  async copyExternalFile(srcAbs: string, dstAbsOrRel: string): Promise<void> {
    const base = this.getBasePath();
    const dst = dstAbsOrRel.startsWith("/") || !base
      ? dstAbsOrRel
      : `${base}/${dstAbsOrRel}`;
    const fs = electronRequire<typeof import("node:fs/promises")>(
      "node:fs/promises",
    ) ?? electronRequire<typeof import("fs/promises")>("fs/promises");
    if (!fs) throw new Error("Node fs/promises 모듈을 사용할 수 없습니다.");
    const path = electronRequire<typeof import("node:path")>("node:path") ??
      electronRequire<typeof import("path")>("path");
    if (path) {
      try {
        await fs.mkdir(path.dirname(dst), { recursive: true });
      } catch {
        /* race */
      }
    }
    await fs.copyFile(srcAbs, dst);
  }

  /** 절대 경로 (또는 vault-relative) → file:// URL. iframe / img src 용. */
  toAssetUrl(absPathOrRel: string): string {
    const base = this.getBasePath();
    const abs = absPathOrRel.startsWith("/") || !base
      ? absPathOrRel
      : `${base}/${absPathOrRel}`;
    return `file://${encodeURI(abs)}`;
  }

  private getBasePath(): string | null {
    const adapter = this.app.vault.adapter as unknown as {
      getBasePath?: () => string;
    };
    return typeof adapter.getBasePath === "function"
      ? adapter.getBasePath()
      : null;
  }
}

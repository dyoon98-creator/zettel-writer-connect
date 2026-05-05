// SkillPackLoader — scan `<vault>/<skillpackFolder>/` for skillpack folders,
// parse `skillpack.json`, eagerly load each declared prompt file, and verify
// the license. Errors are surfaced via NoticeAdapter; never throws into the
// caller.
//
// Filesystem-only: never makes network calls. The host (plugin/desktop) tells
// us whether to short-circuit on mobile via the `isMobile` callback; if it
// returns true, we surface a single notice and return [].

import * as fs from "fs";
import * as path from "path";
import { LicenseChecker } from "./LicenseChecker";
import { validateTemplate } from "./PromptTemplate";
import {
  LicenseStatus,
  LoadedSkillPack,
  SkillPackActionManifest,
  SkillPackManifest,
} from "./types";
import { log } from "../utils/logger";
import { ProjectStatus } from "../types";
import { VaultAdapter } from "../adapters/VaultAdapter";
import { NoticeAdapter } from "../adapters/NoticeAdapter";

const VALID_STATUSES: ReadonlySet<ProjectStatus> = new Set([
  "idea",
  "planning",
  "outline",
  "researching",
  "drafting",
  "feedback",
  "revising",
  "final",
  "published",
]);

const VALID_SAVE_TARGETS = new Set([
  "feedback",
  "revising",
  "materials",
  "draft",
  "plan",
]);

interface LoaderDeps {
  vault: VaultAdapter;
  notice: NoticeAdapter;
  /** Returns the configured skillpack folder (vault-relative). */
  getSkillpackFolder: () => string;
  licenseChecker: LicenseChecker;
  /** Optional: when true, the loader short-circuits to []. */
  isMobile?: () => boolean;
}

export class SkillPackLoader {
  private packs: LoadedSkillPack[] = [];
  private mobileNoticeShown = false;

  constructor(private deps: LoaderDeps) {}

  /** Run a fresh scan and replace the in-memory list. Idempotent. */
  async reload(): Promise<LoadedSkillPack[]> {
    this.packs = await this.scan(
      this.deps.vault,
      this.deps.getSkillpackFolder(),
    );
    return this.packs;
  }

  /** Last-known list (cheap accessor; does NOT trigger a rescan). */
  list(): LoadedSkillPack[] {
    return this.packs;
  }

  /**
   * Public scan entry — kept on the instance so tests can call without going
   * through `reload()`. The function is pure-ish: it reads the disk, but
   * doesn't mutate `this.packs`.
   */
  async scan(vault: VaultAdapter, skillpackFolder: string): Promise<LoadedSkillPack[]> {
    if (this.deps.isMobile?.()) {
      if (!this.mobileNoticeShown) {
        this.mobileNoticeShown = true;
        try {
          this.deps.notice.warn("AI 원고실 스킬팩은 데스크톱 전용입니다.");
        } catch {
          /* test env */
        }
      }
      return [];
    }

    const basePath = vault.getBasePath();
    if (!basePath) {
      // Mobile-like fallback: no FileSystemAdapter (e.g. live-preview env).
      return [];
    }

    const folderAbs = path.join(basePath, skillpackFolder);
    if (!safeIsDir(folderAbs)) {
      // Folder absent is normal — user simply hasn't installed any pack.
      return [];
    }

    const out: LoadedSkillPack[] = [];
    const entries = safeReaddir(folderAbs);
    for (const entry of entries) {
      if (entry.startsWith(".")) continue; // skip dotfiles like .exec-log.jsonl
      const packAbs = path.join(folderAbs, entry);
      if (!safeIsDir(packAbs)) continue;

      const manifestPath = path.join(packAbs, "skillpack.json");
      if (!safeIsFile(manifestPath)) continue;

      const loaded = this.loadOnePack(
        packAbs,
        manifestPath,
        `${skillpackFolder}/${entry}`,
      );
      if (loaded) out.push(loaded);
    }

    return out;
  }

  // ---- internals ----

  private loadOnePack(
    packAbs: string,
    manifestPath: string,
    vaultRelativePath: string,
  ): LoadedSkillPack | null {
    let raw: string;
    try {
      raw = fs.readFileSync(manifestPath, "utf8");
    } catch (e) {
      this.notifyError(vaultRelativePath, `매니페스트를 읽을 수 없습니다 (${(e as Error).message})`);
      return null;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch (e) {
      this.notifyError(vaultRelativePath, `매니페스트 JSON 파싱 실패: ${(e as Error).message}`);
      return null;
    }

    const manifest = sanitizeManifest(parsed);
    if (!manifest) {
      this.notifyError(vaultRelativePath, "매니페스트 형식이 올바르지 않습니다 (필수 필드 누락)");
      return null;
    }

    // Read prompt files; drop actions whose prompt cannot be read.
    const promptByActionId: Record<string, string> = {};
    const validActions: SkillPackActionManifest[] = [];
    for (const action of manifest.actions) {
      const promptAbs = path.join(packAbs, action.prompt_file);
      let body: string;
      try {
        body = fs.readFileSync(promptAbs, "utf8");
      } catch {
        this.notifyError(
          manifest.id,
          `액션 [${action.id}] 의 프롬프트 파일을 읽을 수 없습니다: ${action.prompt_file}`,
        );
        continue;
      }
      promptByActionId[action.id] = body;
      validActions.push(action);
      // Validate placeholders (warn-only; never drops the action).
      validateTemplate(manifest.id, action.id, action.placeholders, body, this.deps.notice);
    }

    if (validActions.length === 0) {
      // Nothing usable; surface but still return the (empty-action) pack so
      // settings UI can show its presence. Caller can filter if needed.
    }

    const license: LicenseStatus = this.deps.licenseChecker.verify({
      ...manifest,
      actions: validActions,
    });

    return {
      manifest: { ...manifest, actions: validActions },
      folderPath: vaultRelativePath,
      promptByActionId,
      license,
    };
  }

  private notifyError(packId: string, msg: string): void {
    const full = `스킬팩 [${packId}]: ${msg}`;
    log.warn(full);
    try {
      this.deps.notice.warn(full);
    } catch {
      /* test env */
    }
  }
}

// ---- helpers ----

function safeIsDir(p: string): boolean {
  try {
    return fs.statSync(p).isDirectory();
  } catch {
    return false;
  }
}

function safeIsFile(p: string): boolean {
  try {
    return fs.statSync(p).isFile();
  } catch {
    return false;
  }
}

function safeReaddir(p: string): string[] {
  try {
    return fs.readdirSync(p);
  } catch {
    return [];
  }
}

/** Validate + coerce an unknown JSON blob into a SkillPackManifest. */
export function sanitizeManifest(raw: unknown): SkillPackManifest | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;

  const id = typeof r.id === "string" ? r.id.trim() : "";
  const name = typeof r.name === "string" ? r.name.trim() : "";
  const version = typeof r.version === "string" ? r.version.trim() : "";
  const vendor = typeof r.vendor === "string" ? r.vendor.trim() : "";
  const tier = r.tier === "free" || r.tier === "paid" ? r.tier : null;
  if (!id || !name || !version || !vendor || !tier) return null;

  const actionsRaw = Array.isArray(r.actions) ? r.actions : null;
  if (!actionsRaw) return null;

  const actions: SkillPackActionManifest[] = [];
  for (const a of actionsRaw) {
    if (!a || typeof a !== "object") continue;
    const ar = a as Record<string, unknown>;
    const aid = typeof ar.id === "string" ? ar.id.trim() : "";
    const label = typeof ar.label === "string" ? ar.label.trim() : "";
    const promptFile =
      typeof ar.prompt_file === "string" ? ar.prompt_file.trim() : "";
    const saveTo = typeof ar.save_to === "string" ? ar.save_to.trim() : "";
    if (!aid || !label || !promptFile || !VALID_SAVE_TARGETS.has(saveTo)) continue;

    const statusShow: ProjectStatus[] = Array.isArray(ar.status_show)
      ? ar.status_show
          .filter((x): x is string => typeof x === "string")
          .filter((x): x is ProjectStatus =>
            VALID_STATUSES.has(x as ProjectStatus),
          )
      : [];

    const placeholders = Array.isArray(ar.placeholders)
      ? ar.placeholders.filter((x): x is string => typeof x === "string")
      : undefined;

    actions.push({
      id: aid,
      label,
      status_show: statusShow,
      prompt_file: promptFile,
      save_to: saveTo as SkillPackActionManifest["save_to"],
      section_anchor:
        typeof ar.section_anchor === "string" ? ar.section_anchor : undefined,
      requires_user_input:
        typeof ar.requires_user_input === "boolean"
          ? ar.requires_user_input
          : undefined,
      placeholders,
    });
  }

  let license: SkillPackManifest["license"];
  if (r.license && typeof r.license === "object") {
    const lr = r.license as Record<string, unknown>;
    const lt = lr.type === "key" ? "key" : null;
    const issuer = typeof lr.issuer === "string" ? lr.issuer : "";
    const checksum = typeof lr.checksum === "string" ? lr.checksum : "";
    if (lt && issuer && checksum) {
      license = { type: "key", issuer, checksum };
    }
  }

  return {
    id,
    name,
    version,
    vendor,
    tier,
    license,
    actions,
  };
}

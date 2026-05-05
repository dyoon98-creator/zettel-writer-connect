// skillpackTypes.ts — 코어 skillpack 타입을 desktop 앱이 쓰기 좋게 재익스포트.
//
// 코어의 `sanitizeManifest`는 Node-only entry(`./node`) 에 들어 있으므로,
// 같은 검증 로직을 브라우저용으로 한 번 더 작성한다.

import type {
  LicenseStatus,
  LoadedSkillPack,
  SkillPackActionManifest,
  SkillPackManifest,
} from "@ai-manuscript-studio/core";

// 코어가 SaveTarget 검증에 쓰는 셋과 동일하게.
const VALID_SAVE_TARGETS = new Set([
  "feedback",
  "revising",
  "materials",
  "draft",
  "plan",
]);

const VALID_STATUSES = new Set([
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

export function sanitizeManifestBrowser(raw: unknown): SkillPackManifest | null {
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
    if (!aid || !label || !promptFile || !VALID_SAVE_TARGETS.has(saveTo))
      continue;

    const statusShow = Array.isArray(ar.status_show)
      ? (ar.status_show.filter(
          (x) => typeof x === "string" && VALID_STATUSES.has(x),
        ) as SkillPackActionManifest["status_show"])
      : [];

    const placeholders = Array.isArray(ar.placeholders)
      ? (ar.placeholders.filter((x) => typeof x === "string") as string[])
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

  return { id, name, version, vendor, tier, license, actions };
}

export type {
  LicenseStatus,
  LoadedSkillPack,
  SkillPackManifest,
  SkillPackActionManifest,
};

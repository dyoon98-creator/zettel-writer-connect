// Smoke test for the Writer Starter Pack shipped under <vault>/_skillpacks/.
//
// This test couples to a vault path that lives outside the monorepo. We
// resolve it via the `AMS_TEST_VAULT_PATH` env var. When the var is missing
// or the pack isn't on disk, we skip rather than fail.

import * as fs from "fs";
import * as path from "path";
import { sanitizeManifest } from "../src/skillpack/SkillPackLoader";
import { LicenseChecker } from "../src/skillpack/LicenseChecker";
import { SUPPORTED_PLACEHOLDERS } from "../src/skillpack/PromptTemplate";
import { ProjectStatus } from "../src/types";

const DEV_KEY = "DEV-WSP-2026";

function resolvePackDir(): string | null {
  // Priority 1: explicit env var → <vault-root>/_skillpacks/writer-starter-pack
  if (process.env.AMS_TEST_VAULT_PATH) {
    const p = path.join(
      process.env.AMS_TEST_VAULT_PATH,
      "_skillpacks",
      "writer-starter-pack",
    );
    if (fs.existsSync(p)) return p;
  }
  // No best-guess fallback in v2 — the monorepo lives outside the vault, so
  // the only deterministic location is the env var.
  return null;
}

const packDir = resolvePackDir();
const SUPPORTED = new Set<string>(SUPPORTED_PLACEHOLDERS);
const VALID_STATUSES: ReadonlySet<ProjectStatus> = new Set<ProjectStatus>([
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

const describeIfAvailable = packDir ? describe : describe.skip;

describeIfAvailable("Writer Starter Pack (smoke)", () => {
  // Lazy-resolve so the suite never trips on a null packDir at import time
  // when AMS_TEST_VAULT_PATH is unset (the suite is then describe.skip'd).
  const dir = (packDir ?? "") as string;
  const manifestPath = dir ? path.join(dir, "skillpack.json") : "";
  const raw = dir ? fs.readFileSync(manifestPath, "utf8") : "";
  const manifest = dir ? sanitizeManifest(JSON.parse(raw)) : null;

  it("manifest parses and has the expected identity", () => {
    expect(manifest).not.toBeNull();
    expect(manifest!.id).toBe("writer-starter-pack");
    expect(manifest!.tier).toBe("paid");
    expect(manifest!.vendor).toBe("futurewave");
    expect(manifest!.license?.issuer).toBe("futurewave");
  });

  it("declares all 5 expected actions with sensible status_show", () => {
    expect(manifest!.actions.map((a) => a.id).sort()).toEqual(
      [
        "wsp.basic-revise",
        "wsp.first-sentence",
        "wsp.planning-questions",
        "wsp.reader-feedback",
        "wsp.title-candidates",
      ].sort(),
    );
    for (const a of manifest!.actions) {
      // Status entries that survived sanitization must be valid.
      for (const s of a.status_show) {
        expect(VALID_STATUSES.has(s)).toBe(true);
      }
    }
    // Spot-check: planning-questions only appears in "planning".
    const planning = manifest!.actions.find(
      (a) => a.id === "wsp.planning-questions",
    );
    expect(planning?.status_show).toEqual(["planning"]);
    expect(planning?.requires_user_input).toBe(true);
    // basic-revise is revising-only.
    const revise = manifest!.actions.find((a) => a.id === "wsp.basic-revise");
    expect(revise?.status_show).toEqual(["revising"]);
  });

  it("every prompt file resolves, is non-empty, and ≥ 100 chars", () => {
    for (const a of manifest!.actions) {
      const promptAbs = path.join(dir, a.prompt_file);
      expect(fs.existsSync(promptAbs)).toBe(true);
      const body = fs.readFileSync(promptAbs, "utf8");
      expect(body.trim().length).toBeGreaterThanOrEqual(100);
    }
  });

  it("every declared placeholder is in SUPPORTED_PLACEHOLDERS", () => {
    for (const a of manifest!.actions) {
      for (const p of a.placeholders ?? []) {
        expect(SUPPORTED.has(p)).toBe(true);
      }
    }
  });

  it("LicenseChecker accepts the dev key DEV-WSP-2026", () => {
    const checker = new LicenseChecker(() => DEV_KEY);
    const status = checker.verify(manifest!);
    expect(status.kind).toBe("ok");
  });

  it("LicenseChecker rejects a wrong key as 'invalid'", () => {
    const checker = new LicenseChecker(() => "WRONG");
    const status = checker.verify(manifest!);
    expect(status.kind).toBe("invalid");
  });

  it("LicenseChecker reports 'missing' when key is empty", () => {
    const checker = new LicenseChecker(() => "");
    const status = checker.verify(manifest!);
    expect(status.kind).toBe("missing");
  });
});

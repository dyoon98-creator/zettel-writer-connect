// SkillPackLoader integration test against on-disk fixture packs.

import * as path from "path";
import {
  SkillPackLoader,
  sanitizeManifest,
} from "../src/skillpack/SkillPackLoader";
import { LicenseChecker } from "../src/skillpack/LicenseChecker";
import { InMemoryNoticeAdapter } from "../src/adapters/InMemoryNoticeAdapter";
import { InMemoryVaultAdapter } from "../src/adapters/InMemoryVaultAdapter";

const FIXTURE_BASE = path.resolve(__dirname, "fixtures");
// Inside FIXTURE_BASE, the loader will look for `<skillpackFolder>/<pack>/skillpack.json`.
// Our fixtures live under `fixtures/skillpacks/...`, so we pass "skillpacks" as
// the folder.
const SKILLPACK_FOLDER = "skillpacks";

function makeVault(): InMemoryVaultAdapter {
  // Vault content is irrelevant; the loader uses fs.* directly with the
  // basePath returned by getBasePath().
  return new InMemoryVaultAdapter({ basePath: FIXTURE_BASE });
}

describe("SkillPackLoader", () => {
  beforeEach(() => {
    // Loader emits console.warn on malformed/missing-prompt fixtures by design.
    jest.spyOn(console, "warn").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("loads the sample free pack with all declared prompts", async () => {
    const checker = new LicenseChecker(() => "");
    const notice = new InMemoryNoticeAdapter();
    const vault = makeVault();
    const loader = new SkillPackLoader({
      vault,
      notice,
      getSkillpackFolder: () => SKILLPACK_FOLDER,
      licenseChecker: checker,
    });
    const packs = await loader.scan(vault, SKILLPACK_FOLDER);

    const sample = packs.find((p) => p.manifest.id === "sample-pack");
    expect(sample).toBeDefined();
    expect(sample?.license.kind).toBe("free");
    expect(sample?.manifest.actions.map((a) => a.id)).toEqual([
      "sample.draft-help",
      "sample.title",
    ]);
    expect(sample?.promptByActionId["sample.draft-help"]).toContain("초안:");
    expect(sample?.promptByActionId["sample.title"]).toContain("{{title}}");
  });

  it("malformed JSON pack is skipped silently with a Notice", async () => {
    const checker = new LicenseChecker(() => "");
    const notice = new InMemoryNoticeAdapter();
    const vault = makeVault();
    const loader = new SkillPackLoader({
      vault,
      notice,
      getSkillpackFolder: () => SKILLPACK_FOLDER,
      licenseChecker: checker,
    });
    const packs = await loader.scan(vault, SKILLPACK_FOLDER);
    expect(packs.find((p) => p.manifest.id === "malformed-pack")).toBeUndefined();
    // Should not crash and should still load the OK pack.
    expect(packs.find((p) => p.manifest.id === "sample-pack")).toBeDefined();
    // A notice should have been emitted for the malformed pack.
    expect(notice.contains("매니페스트 JSON 파싱 실패")).toBe(true);
  });

  it("action with missing prompt file is dropped from the loaded pack", async () => {
    const checker = new LicenseChecker(() => "");
    const notice = new InMemoryNoticeAdapter();
    const vault = makeVault();
    const loader = new SkillPackLoader({
      vault,
      notice,
      getSkillpackFolder: () => SKILLPACK_FOLDER,
      licenseChecker: checker,
    });
    const packs = await loader.scan(vault, SKILLPACK_FOLDER);
    const missing = packs.find((p) => p.manifest.id === "missing-prompt-pack");
    expect(missing).toBeDefined();
    expect(missing?.manifest.actions.length).toBe(0);
    expect(missing?.promptByActionId["missing.action"]).toBeUndefined();
  });

  it("paid pack license verifies with the correct key", async () => {
    const checker = new LicenseChecker(() => "TEST-LICENSE-KEY-1234");
    const notice = new InMemoryNoticeAdapter();
    const vault = makeVault();
    const loader = new SkillPackLoader({
      vault,
      notice,
      getSkillpackFolder: () => SKILLPACK_FOLDER,
      licenseChecker: checker,
    });
    const packs = await loader.scan(vault, SKILLPACK_FOLDER);
    const paid = packs.find((p) => p.manifest.id === "paid-pack");
    expect(paid).toBeDefined();
    expect(paid?.license.kind).toBe("ok");
  });

  it("paid pack with missing key returns LicenseStatus.missing", async () => {
    const checker = new LicenseChecker(() => "");
    const notice = new InMemoryNoticeAdapter();
    const vault = makeVault();
    const loader = new SkillPackLoader({
      vault,
      notice,
      getSkillpackFolder: () => SKILLPACK_FOLDER,
      licenseChecker: checker,
    });
    const packs = await loader.scan(vault, SKILLPACK_FOLDER);
    const paid = packs.find((p) => p.manifest.id === "paid-pack");
    expect(paid?.license.kind).toBe("missing");
  });

  it("mobile platform short-circuits to []", async () => {
    const checker = new LicenseChecker(() => "");
    const notice = new InMemoryNoticeAdapter();
    const vault = makeVault();
    const loader = new SkillPackLoader({
      vault,
      notice,
      getSkillpackFolder: () => SKILLPACK_FOLDER,
      licenseChecker: checker,
      isMobile: () => true,
    });
    const packs = await loader.scan(vault, SKILLPACK_FOLDER);
    expect(packs).toEqual([]);
  });

  it("non-existent skillpack folder yields []", async () => {
    const checker = new LicenseChecker(() => "");
    const notice = new InMemoryNoticeAdapter();
    const vault = makeVault();
    const loader = new SkillPackLoader({
      vault,
      notice,
      getSkillpackFolder: () => "this-folder-does-not-exist",
      licenseChecker: checker,
    });
    const packs = await loader.scan(vault, "this-folder-does-not-exist");
    expect(packs).toEqual([]);
  });

  it("reload() updates list() result", async () => {
    const checker = new LicenseChecker(() => "");
    const notice = new InMemoryNoticeAdapter();
    const vault = makeVault();
    const loader = new SkillPackLoader({
      vault,
      notice,
      getSkillpackFolder: () => SKILLPACK_FOLDER,
      licenseChecker: checker,
    });
    expect(loader.list()).toEqual([]);
    const after = await loader.reload();
    expect(after.length).toBeGreaterThan(0);
    expect(loader.list().length).toBe(after.length);
  });
});

describe("sanitizeManifest", () => {
  it("rejects manifest missing required fields", () => {
    expect(sanitizeManifest({})).toBeNull();
    expect(sanitizeManifest({ id: "x" })).toBeNull();
    expect(sanitizeManifest({ id: "x", name: "y" })).toBeNull();
  });

  it("filters action with invalid save_to", () => {
    const m = sanitizeManifest({
      id: "p",
      name: "p",
      version: "1.0.0",
      vendor: "v",
      tier: "free",
      actions: [
        {
          id: "a",
          label: "L",
          prompt_file: "p.md",
          save_to: "wrong-target",
        },
        {
          id: "b",
          label: "L",
          prompt_file: "p.md",
          save_to: "feedback",
        },
      ],
    });
    expect(m?.actions.length).toBe(1);
    expect(m?.actions[0].id).toBe("b");
  });

  it("filters status_show to known statuses only", () => {
    const m = sanitizeManifest({
      id: "p",
      name: "p",
      version: "1.0.0",
      vendor: "v",
      tier: "free",
      actions: [
        {
          id: "a",
          label: "L",
          prompt_file: "p.md",
          save_to: "feedback",
          status_show: ["drafting", "garbage", "feedback"],
        },
      ],
    });
    expect(m?.actions[0].status_show).toEqual(["drafting", "feedback"]);
  });
});

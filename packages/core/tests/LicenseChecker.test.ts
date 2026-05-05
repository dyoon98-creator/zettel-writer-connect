// Honor-system license checker tests.

import { LicenseChecker, computeHmac } from "../src/skillpack/LicenseChecker";
import { SkillPackManifest } from "../src/skillpack/types";

const VALID_KEY = "TEST-LICENSE-KEY-1234";
const ISSUER = "futurewave";
const VALID_CHECKSUM = computeHmac(VALID_KEY, ISSUER);

function freePack(): SkillPackManifest {
  return {
    id: "free",
    name: "Free",
    version: "1.0.0",
    vendor: "v",
    tier: "free",
    actions: [],
  };
}

function paidPack(opts?: {
  noLicense?: boolean;
  badChecksum?: boolean;
}): SkillPackManifest {
  if (opts?.noLicense) {
    return {
      id: "paid",
      name: "Paid",
      version: "1.0.0",
      vendor: "v",
      tier: "paid",
      actions: [],
    };
  }
  return {
    id: "paid",
    name: "Paid",
    version: "1.0.0",
    vendor: "v",
    tier: "paid",
    license: {
      type: "key",
      issuer: ISSUER,
      checksum: opts?.badChecksum ? "deadbeef".repeat(8) : VALID_CHECKSUM,
    },
    actions: [],
  };
}

describe("LicenseChecker", () => {
  it("free tier always returns kind=free", () => {
    const c = new LicenseChecker(() => "");
    expect(c.verify(freePack()).kind).toBe("free");
    const c2 = new LicenseChecker(() => "WRONG-KEY");
    expect(c2.verify(freePack()).kind).toBe("free");
  });

  it("paid + correct key = ok", () => {
    const c = new LicenseChecker(() => VALID_KEY);
    expect(c.verify(paidPack()).kind).toBe("ok");
  });

  it("paid + wrong key = invalid", () => {
    const c = new LicenseChecker(() => "DIFFERENT-KEY");
    const s = c.verify(paidPack());
    expect(s.kind).toBe("invalid");
    if (s.kind === "invalid") {
      expect(s.reason).toContain("라이선스");
    }
  });

  it("paid + empty key = missing", () => {
    const c = new LicenseChecker(() => "");
    const s = c.verify(paidPack());
    expect(s.kind).toBe("missing");
  });

  it("paid + manifest without license = invalid", () => {
    const c = new LicenseChecker(() => VALID_KEY);
    const s = c.verify(paidPack({ noLicense: true }));
    expect(s.kind).toBe("invalid");
  });

  it("paid + bad checksum = invalid", () => {
    const c = new LicenseChecker(() => VALID_KEY);
    const s = c.verify(paidPack({ badChecksum: true }));
    expect(s.kind).toBe("invalid");
  });

  it("trims whitespace on user key", () => {
    const c = new LicenseChecker(() => `  ${VALID_KEY}  `);
    expect(c.verify(paidPack()).kind).toBe("ok");
  });
});

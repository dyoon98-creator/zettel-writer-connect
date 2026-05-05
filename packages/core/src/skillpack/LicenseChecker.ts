// LicenseChecker — honor-system license verification for skillpacks.
//
// IMPORTANT (design intent): this is NOT real DRM. There is no server, no
// signature chain, no machine binding. The "checksum" embedded in a paid
// skillpack manifest is simply an HMAC-SHA256 of the user's license key,
// keyed by `issuer + ":" + checksum-prefix`. A determined user can extract
// the checksum from the unzipped pack and bypass the check trivially.
//
// We accept that. The point is to make the *expected* flow obvious — if the
// user paid for a key, plug it in and the actions unlock; if they didn't,
// they see a clear "라이선스 필요" prompt. We optimize for value delivery,
// not lock-down.

import { createHmac, timingSafeEqual } from "crypto";
import { LicenseStatus, SkillPackManifest } from "./types";

/**
 * Compute the honor-system HMAC for a candidate user key against an issuer.
 *
 * Algorithm: HMAC-SHA256, keyed by the issuer string. The pack publisher
 * (who owns `userKey` and `issuer`) computes this once and embeds it as the
 * manifest's `license.checksum`. Verification recomputes from the user-typed
 * key and compares.
 */
export function computeHmac(userKey: string, issuer: string): string {
  return createHmac("sha256", issuer).update(userKey).digest("hex");
}

/** Constant-time equality on hex strings. Returns false on length mismatch. */
function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(Buffer.from(a, "utf8"), Buffer.from(b, "utf8"));
  } catch {
    return false;
  }
}

export class LicenseChecker {
  constructor(private getLicenseKey: () => string) {}

  /** Run the check for a parsed manifest; returns a status the UI can render. */
  verify(manifest: SkillPackManifest): LicenseStatus {
    if (manifest.tier === "free") {
      return { kind: "free" };
    }

    // Paid path
    const userKey = (this.getLicenseKey() ?? "").trim();
    if (!userKey) {
      return {
        kind: "missing",
        reason: "라이선스 키가 입력되지 않았습니다.",
      };
    }

    const license = manifest.license;
    if (!license) {
      return {
        kind: "invalid",
        reason: "스킬팩에 라이선스 정보가 없습니다.",
      };
    }

    const expected = computeHmac(userKey, license.issuer);
    if (!constantTimeEq(expected, license.checksum)) {
      return {
        kind: "invalid",
        reason: "라이선스 키가 맞지 않습니다.",
      };
    }

    // No expiry support in v0; placeholder for future.
    return { kind: "ok" };
  }
}

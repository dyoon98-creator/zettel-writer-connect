import { normalizeVoiceFolderInput } from "../../src/studio/tauriShims/plugin-dialog";

describe("normalizeVoiceFolderInput — rejection cases", () => {
  it("rejects empty string", () => {
    const r = normalizeVoiceFolderInput("   ");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/비어|empty/i);
  });

  it("rejects relative path without leading slash", () => {
    const r = normalizeVoiceFolderInput("relative/path");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/절대|absolute/i);
  });

  it("rejects path with single dot prefix", () => {
    const r = normalizeVoiceFolderInput("./Documents/voice");
    expect(r.ok).toBe(false);
  });

  it("rejects path with double dot prefix", () => {
    const r = normalizeVoiceFolderInput("../Documents/voice");
    expect(r.ok).toBe(false);
  });

  it("rejects plain filename without any separator", () => {
    const r = normalizeVoiceFolderInput("myvoicefolder");
    expect(r.ok).toBe(false);
  });

  it("rejects path containing NUL character", () => {
    const r = normalizeVoiceFolderInput("/Users/me/voi\0ce");
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatch(/NUL|null|허용되지 않는/i);
  });
});

describe("normalizeVoiceFolderInput — acceptance cases", () => {
  it("accepts macOS absolute path", () => {
    const r = normalizeVoiceFolderInput("/Users/dongchanyoon/Documents/voice");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe("/Users/dongchanyoon/Documents/voice");
  });

  it("accepts Linux absolute path", () => {
    const r = normalizeVoiceFolderInput("/home/user/voice");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe("/home/user/voice");
  });

  it("trims leading/trailing whitespace before accepting", () => {
    const r = normalizeVoiceFolderInput("  /Users/me/voice  ");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe("/Users/me/voice");
  });

  it("accepts Windows drive-letter absolute path", () => {
    const r = normalizeVoiceFolderInput("C:\\Users\\Me\\voice");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe("C:\\Users\\Me\\voice");
  });

  it("accepts UNC path", () => {
    const r = normalizeVoiceFolderInput("\\\\server\\share\\voice");
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.path).toBe("\\\\server\\share\\voice");
  });
});

import { buildLaunchUrl, launchApp } from "../src/launchApp";

describe("buildLaunchUrl", () => {
  it("encodes vault path and project slug", () => {
    const url = buildLaunchUrl("/Users/me/My Vault", "ai-시대의-작가");
    expect(url).toBe(
      "ai-manuscript-studio://open?vault=%2FUsers%2Fme%2FMy%20Vault&project=ai-%EC%8B%9C%EB%8C%80%EC%9D%98-%EC%9E%91%EA%B0%80",
    );
  });

  it("preserves slash and Korean characters round-trippable", () => {
    const url = buildLaunchUrl("/v", "한글");
    expect(decodeURIComponent(url.split("vault=")[1].split("&")[0])).toBe("/v");
    expect(decodeURIComponent(url.split("project=")[1])).toBe("한글");
  });
});

describe("launchApp", () => {
  let originalRequire: unknown;
  let originalOpen: unknown;

  beforeEach(() => {
    originalRequire = (window as unknown as { require?: unknown }).require;
    originalOpen = window.open;
  });

  afterEach(() => {
    (window as unknown as { require?: unknown }).require = originalRequire;
    // jsdom doesn't allow direct delete of window.open in some setups
    Object.defineProperty(window, "open", {
      value: originalOpen,
      writable: true,
      configurable: true,
    });
  });

  it("uses electron shell.openExternal when available", () => {
    const openExternal = jest.fn();
    (window as unknown as { require: (m: string) => unknown }).require = (
      m: string,
    ) => (m === "electron" ? { shell: { openExternal } } : null);

    launchApp({ vaultPath: "/v", projectFolder: "p" });
    expect(openExternal).toHaveBeenCalledWith(
      expect.stringContaining("ai-manuscript-studio://"),
    );
  });

  it("falls back to window.open when electron is missing", () => {
    (window as unknown as { require?: unknown }).require = undefined;
    const fakeOpen = jest.fn(() => ({}) as Window);
    Object.defineProperty(window, "open", {
      value: fakeOpen,
      writable: true,
      configurable: true,
    });

    launchApp({ vaultPath: "/v", projectFolder: "p" });
    expect(fakeOpen).toHaveBeenCalledWith(
      expect.stringContaining("ai-manuscript-studio://"),
      "_blank",
    );
  });

  it("calls notice.error when both paths fail", () => {
    (window as unknown as { require?: unknown }).require = undefined;
    Object.defineProperty(window, "open", {
      value: () => null,
      writable: true,
      configurable: true,
    });
    const notice = { info: jest.fn(), warn: jest.fn(), error: jest.fn() };
    launchApp({ vaultPath: "/v", projectFolder: "p", notice });
    expect(notice.error).toHaveBeenCalledWith(
      expect.stringContaining("URL 핸들러"),
    );
  });
});

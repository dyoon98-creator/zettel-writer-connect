import { App } from "obsidian";
import {
  NewProjectModal,
  GENRE_LABEL_KO,
  type Genre,
} from "../src/NewProjectModal";

describe("GENRE_LABEL_KO — final genre taxonomy (B2.5b)", () => {
  const genres = Object.keys(GENRE_LABEL_KO) as Genre[];
  const labels = Object.values(GENRE_LABEL_KO);

  it("has exactly 6 genres", () => {
    expect(genres).toHaveLength(6);
  });

  it("includes 투자·전략 메모 (first/default)", () => {
    expect(labels).toContain("투자·전략 메모");
  });

  it("includes 투자보고서", () => {
    expect(labels).toContain("투자보고서");
  });

  it("includes 법률·회계·계약 검토", () => {
    expect(labels).toContain("법률·회계·계약 검토");
  });

  it("includes 칼럼/에세이", () => {
    expect(labels).toContain("칼럼/에세이");
  });

  it("includes 강의·발표안", () => {
    expect(labels).toContain("강의·발표안");
  });

  it("includes 장문 원고", () => {
    expect(labels).toContain("장문 원고");
  });

  it("does NOT include removed/merged labels", () => {
    expect(labels).not.toContain("투자메모");
    expect(labels).not.toContain("투자/리서치 메모");
    expect(labels).not.toContain("산업·시장 분석");
    expect(labels).not.toContain("전략 메모");
    expect(labels).not.toContain("보고서/브리핑");
    expect(labels).not.toContain("원고/스크립트");
  });

  it("does NOT include channel/format labels (이메일, 카카오톡, 카톡, 텔레그램, Telegram)", () => {
    for (const label of labels) {
      expect(label).not.toMatch(/이메일|카카오톡|카톡|텔레그램|Telegram/);
    }
  });

  it("first genre (default) is 투자·전략 메모", () => {
    expect(labels[0]).toBe("투자·전략 메모");
  });

  it("first key is investment-strategy-memo", () => {
    expect(genres[0]).toBe("investment-strategy-memo");
  });

  it("genre order matches final taxonomy", () => {
    expect(labels).toEqual([
      "투자·전략 메모",
      "투자보고서",
      "법률·회계·계약 검토",
      "칼럼/에세이",
      "강의·발표안",
      "장문 원고",
    ]);
  });
});

describe("NewProjectModal — no stale desktop-app copy", () => {
  let modal: NewProjectModal;

  beforeEach(() => {
    modal = new NewProjectModal(new App(), jest.fn());
    modal.onOpen();
  });

  it("toggle label does not say 데스크톱 앱에서 열기", () => {
    const text = modal.contentEl.textContent ?? "";
    expect(text).not.toContain("데스크톱 앱에서 열기");
  });

  it("toggle label mentions Obsidian 원고실", () => {
    const text = modal.contentEl.textContent ?? "";
    expect(text).toContain("Obsidian");
    expect(text).toMatch(/원고실/);
  });

  it("does not mention URL scheme", () => {
    const text = modal.contentEl.textContent ?? "";
    expect(text).not.toContain("URL scheme");
  });

  it("does not say 앱이 그 프로젝트로 부팅됩니다", () => {
    const text = modal.contentEl.textContent ?? "";
    expect(text).not.toContain("앱이 그 프로젝트로 부팅됩니다");
  });

  it("header description does not mention 데스크톱 앱", () => {
    const text = modal.contentEl.textContent ?? "";
    expect(text).not.toContain("데스크톱 앱");
  });
});

describe("NewProjectModal — default genre is investment-strategy-memo", () => {
  it("first label in GENRE_LABEL_KO is exactly 투자·전략 메모", () => {
    const firstLabel = Object.values(GENRE_LABEL_KO)[0];
    expect(firstLabel).toBe("투자·전략 메모");
  });

  it("first key in GENRE_LABEL_KO is investment-strategy-memo", () => {
    const firstKey = Object.keys(GENRE_LABEL_KO)[0];
    expect(firstKey).toBe("investment-strategy-memo");
  });
});

// RED: buildConceptSystemPrompt is genre/tone aware — investment-report gets
// investment-domain coaching, not essay-style prompts.

import {
  buildConceptSystemPrompt,
} from "../../../src/studio/wizard/concept/conceptPrompts";
import type { ConceptDraftSession } from "@ai-manuscript-studio/core";
import { CONCEPT_DRAFT_SCHEMA } from "@ai-manuscript-studio/core";

function makeSession(
  genre: ConceptDraftSession["genre"],
  tone: ConceptDraftSession["tone"],
): ConceptDraftSession {
  return {
    schema: CONCEPT_DRAFT_SCHEMA,
    id: "test-session",
    seed: "테스트 시드",
    genre,
    tone,
    attachedNotes: [],
    conversation: [],
    conceptParagraph: "",
    synopsis: "",
    outline: [],
    stage: "concept",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  } as ConceptDraftSession;
}

describe("buildConceptSystemPrompt — genre + tone 컨텍스트 주입", () => {
  it("프롬프트에 genre key 와 tone key 가 포함된다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("investment-report", "analytical-report"),
    );
    expect(prompt).toContain("investment-report");
    expect(prompt).toContain("analytical-report");
  });

  it("investment-report: 투자/비즈니스 개념이 포함된다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("investment-report", "customer-report"),
    );
    // thesis / why-now
    expect(prompt).toMatch(/thesis|투자 thesis|why.now|투자 대상/i);
    // 시장/산업
    expect(prompt).toMatch(/시장|산업|market|industry/i);
    // 재무/valuation
    expect(prompt).toMatch(/재무|밸류에이션|valuation|financial/i);
    // 리스크
    expect(prompt).toMatch(/리스크|risk|downside/i);
    // exit/return
    expect(prompt).toMatch(/exit|return|수익/i);
  });

  it("investment-report: 투자위원회(IC) 언급이 없다 — 고객 보고 컨텍스트만", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("investment-report", "analytical-report"),
    );
    expect(prompt).not.toContain("투자위원회(IC)");
    expect(prompt).not.toContain("IC) 의사결정");
    expect(prompt).not.toContain("IC 의사결정");
  });

  it("investment-report: 고객 보고 컨텍스트가 포함된다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("investment-report", "analytical-report"),
    );
    expect(prompt).toMatch(/고객|client|보고/i);
  });

  it("investment-report: 에세이 전용 토큰이 없다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("investment-report", "analytical-report"),
    );
    expect(prompt).not.toContain("감정의 축");
    expect(prompt).not.toContain("어린 시절");
    expect(prompt).not.toContain("첫 장면");
    expect(prompt).not.toContain("숨은 은유");
    expect(prompt).not.toContain("수필");
    expect(prompt).not.toContain("세계관");
    expect(prompt).not.toContain("유튜브 대본");
    expect(prompt).not.toContain("실용서");
  });

  it("column-essay: 에세이 감성 코치 프롬프트가 반환된다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("column-essay", "column-narrative"),
    );
    // Column-essay should be narrative-focused
    expect(prompt).toContain("column-essay");
    expect(prompt).toContain("column-narrative");
  });

  it("investment-strategy-memo: 투자 컨텍스트 포함", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("investment-strategy-memo", "decision-memo"),
    );
    expect(prompt).toMatch(/투자|investment/i);
    expect(prompt).toContain("investment-strategy-memo");
    expect(prompt).toContain("decision-memo");
  });
});

describe("buildConceptSystemPrompt — Scrivener 원칙 통합", () => {
  // Binder-pieces / card thinking: investment prompts should mention section/card/piece
  it("investment-report: 섹션/조각 단위 쪼개기(바인더 카드) 개념이 포함된다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("investment-report", "analytical-report"),
    );
    expect(prompt).toMatch(/조각|섹션|카드|section|piece|구성 단위/i);
  });

  it("investment-strategy-memo: 섹션/조각 단위 쪼개기 개념이 포함된다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("investment-strategy-memo", "decision-memo"),
    );
    expect(prompt).toMatch(/조각|섹션|카드|section|piece|구성 단위/i);
  });

  it("legal-accounting-review: 섹션/조각 단위 쪼개기 개념이 포함된다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("legal-accounting-review", "legal-accounting-review"),
    );
    expect(prompt).toMatch(/조각|섹션|카드|section|piece|구성 단위/i);
  });

  // Research separation: investment prompts should mention source/research note separation
  it("investment-report: 자료·출처 분리(Research within reach) 언급이 있다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("investment-report", "customer-report"),
    );
    expect(prompt).toMatch(/자료|출처|1차 출처|source|research/i);
  });

  // Snapshot-before-revision: investment prompts should nudge snapshot habit
  it("investment-report: 퇴고 전 스냅샷 습관 언급이 있다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("investment-report", "customer-report"),
    );
    expect(prompt).toMatch(/스냅샷|snapshot|수정 전|개정 전|퇴고 전/i);
  });

  // User-as-author: no prompt should tell AI to make the final decision for the user
  it("investment-report: AI가 최종 판단을 대신하지 않고 저자(사용자)가 결정한다는 원칙이 있다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("investment-report", "analytical-report"),
    );
    expect(prompt).toMatch(/저자|작성자|당신이|사용자가|최종.*결정|결정.*본인/i);
  });

  it("column-essay: AI가 최종 판단을 대신하지 않는다는 원칙이 있다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("column-essay", "column-narrative"),
    );
    expect(prompt).toMatch(/작가|저자|당신이|사용자가/i);
  });

  // Output channel ≠ genre/tone: investment prompts must NOT use channel words (Word/PPT/Telegram) as genre
  it("investment-report: 출력 채널(Word/PPT/Telegram)을 장르/문체로 사용하지 않는다", () => {
    const prompt = buildConceptSystemPrompt(
      makeSession("investment-report", "analytical-report"),
    );
    // Channel words must NOT appear as genre/tone classifiers in the prompt body
    expect(prompt).not.toMatch(/장르.*Word|장르.*PPT|장르.*Telegram|문체.*Word|문체.*PPT/i);
    expect(prompt).not.toMatch(/Word.*장르|PPT.*장르|Telegram.*장르/i);
  });
});

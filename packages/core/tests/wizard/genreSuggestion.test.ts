// genreSuggestion — 「톤을 고르면 장르가 따라온다」 계약.
//
// 왜 이 파일이 있나 (2026-09-01 원본 대조).
//
// 원본(vibelabs-web/zettel-writer-connect)에는 컨셉 마법사 1단계에 톤→장르
// 자동 추천이 있었다. 톤만 고르면 장르가 채워지고, 사용자가 장르를 직접
// 만지면 그때부터 추천을 멈췄다.
//
// 우리는 장르 체계를 창작용(에세이·유튜브·세계관)에서 업무용(투자·법률·강의)
// 으로 갈아엎으면서 그 연결을 «통째로» 잃었다 — 원본 매핑이 가리키던 장르가
// 하나도 남지 않았기 때문이다. 그래서 매핑을 새로 짜고 이 검사로 잠근다.
//
// 여기서 지키는 것 셋.
//   ① 톤 전부가 장르를 갖는다 — 하나라도 빠지면 그 톤에서 추천이 죽는다.
//   ② 추천 결과는 «실재하는» 장르다 — 오타 하나로 화면이 빈 채로 남는다.
//   ③ 모르는 톤이 와도 던지지 않는다 — 옛 저장물이 새 코드로 열릴 수 있다.

import {
  GENRE_SUGGESTED_FOR_TONE,
  suggestGenreForTone,
  DEFAULT_DRAFT_GENRE,
} from "../../src/wizard/types";
import { GENRE_LABEL_KO } from "../../src/types";
import type { ConceptTone } from "../../src/project/schema";

/** 화면이 실제로 보여 주는 톤 8개. schema.ts 의 ConceptTone 과 같아야 한다. */
const ALL_TONES: ConceptTone[] = [
  "decision-memo",
  "analytical-report",
  "customer-report",
  "legal-accounting-review",
  "column-narrative",
  "long-form-reasoning",
  "lecture-presentation",
  "explanatory",
];

describe("톤 → 장르 추천", () => {
  it("톤 8개가 «전부» 장르를 갖는다", () => {
    const missing = ALL_TONES.filter((t) => !GENRE_SUGGESTED_FOR_TONE[t]);
    expect(missing).toEqual([]);
  });

  it("추천된 장르는 모두 «실재하는» 장르다", () => {
    const known = new Set(Object.keys(GENRE_LABEL_KO));
    const bogus = ALL_TONES
      .map((t) => suggestGenreForTone(t))
      .filter((g) => !known.has(g));
    expect(bogus).toEqual([]);
  });

  it.each([
    ["decision-memo", "investment-strategy-memo"],
    ["analytical-report", "investment-report"],
    ["customer-report", "investment-report"],
    ["legal-accounting-review", "legal-accounting-review"],
    ["column-narrative", "column-essay"],
    ["long-form-reasoning", "long-form-manuscript"],
    ["lecture-presentation", "lecture-presentation"],
    ["explanatory", "lecture-presentation"],
  ] as [ConceptTone, string][])("%s → %s", (tone, genre) => {
    expect(suggestGenreForTone(tone)).toBe(genre);
  });

  it("모르는 톤이면 기본 장르로 떨어지고 던지지 않는다", () => {
    expect(suggestGenreForTone("없는-톤" as ConceptTone)).toBe(
      DEFAULT_DRAFT_GENRE,
    );
  });

  it("기본 장르 자체도 실재하는 장르다", () => {
    expect(Object.keys(GENRE_LABEL_KO)).toContain(DEFAULT_DRAFT_GENRE);
  });
});

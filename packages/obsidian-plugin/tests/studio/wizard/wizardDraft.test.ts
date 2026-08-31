// wizardDraft — 「기획 인터뷰 다음에 글까지 나오는가」의 계약.
//
// 왜 이 파일이 있나 (2026-08-31 대표 지시).
//
// 마법사는 여기서 끝나 있었다: 컨셉 → 인터뷰 → 폴더와 «빈 장면» 생성.
// 대표가 원한 것은 「설정 마법사 → 기획 인터뷰 → 글까지 쫙」이다.
// 빈 파일은 글이 아니다. 이 모듈이 그 마지막 구간을 맡는다.
//
// 여기서 지키는 계약 넷.
//   ① 장(폴더)마다 첫 장면을 정확히 하나씩 고른다 — 장을 빠뜨리지 않는다.
//   ② 이미 본문이 있는 장면은 «덮지 않는다» — 작가가 쓴 것을 지우면 사고다.
//   ③ 한 장이 실패해도 나머지를 계속 쓴다 — 아홉 중 하나로 전부 잃지 않는다.
//   ④ 모델이 붙이는 껍데기(``` 블록, 장 제목 헤딩)를 걷어낸다.

import {
  collectDraftTargets,
  buildChapterPrompt,
  stripWrapper,
} from "../../../src/studio/wizard/wizardDraft";

/** binder 트리 최소 형태 — 이 테스트가 쓰는 필드만 채운다. */
function tree(root: unknown): never {
  return { root } as never;
}

const folder = (
  id: string,
  title: string,
  children: unknown[],
  synopsis = "",
): unknown => ({ id, type: "folder", title, synopsis, children });

const doc = (id: string, title: string): unknown => ({
  id,
  type: "document",
  title,
});

describe("collectDraftTargets — 장마다 첫 장면 하나", () => {
  it("장 3개면 대상 3개, 순서를 지킨다", () => {
    const t = tree([
      folder("root", "원고", [
        folder("c1", "1장", [doc("s1", "1장 첫 장면")], "도입"),
        folder("c2", "2장", [doc("s2", "2장 첫 장면")], "전개"),
        folder("c3", "3장", [doc("s3", "3장 첫 장면")], "결론"),
      ]),
    ]);

    const got = collectDraftTargets(t);

    expect(got.map((g) => g.sceneId)).toEqual(["s1", "s2", "s3"]);
    expect(got.map((g) => g.chapterTitle)).toEqual(["1장", "2장", "3장"]);
    expect(got[0].chapterSynopsis).toBe("도입");
  });

  it("한 장에 장면이 여럿이면 «첫» 장면만 고른다", () => {
    const t = tree([
      folder("root", "원고", [
        folder("c1", "1장", [doc("s1", "첫"), doc("s2", "둘째")]),
      ]),
    ]);

    expect(collectDraftTargets(t).map((g) => g.sceneId)).toEqual(["s1"]);
  });

  it("장면이 하나도 없는 장은 건너뛴다 — 빈 대상을 만들지 않는다", () => {
    const t = tree([
      folder("root", "원고", [
        folder("c1", "빈 장", []),
        folder("c2", "2장", [doc("s2", "2장 첫 장면")]),
      ]),
    ]);

    expect(collectDraftTargets(t).map((g) => g.sceneId)).toEqual(["s2"]);
  });

  it("binder 가 없으면 빈 배열 — 던지지 않는다", () => {
    expect(collectDraftTargets(null)).toEqual([]);
  });

  it("원고 루트 바로 아래의 기획 문서를 «장으로 세지 않는다»", () => {
    // 실제 binder.json 모양. concept-summary.md 가 루트의 첫 문서다.
    // 루트를 장으로 취급하면 이 파일이 초고로 덮여 컨셉이 사라진다.
    const t = tree([
      {
        id: "root",
        type: "folder",
        label: "manuscript",
        title: "원고",
        children: [
          doc("concept", "컨셉 (기획 단계 요약)"),
          folder("c1", "1장 설렘 곁의 불안", [doc("s1", "1장 첫 장면")]),
          folder("c2", "2장 잠들 수 있는 곁", [doc("s2", "2장 첫 장면")]),
        ],
      },
    ]);

    const got = collectDraftTargets(t);

    expect(got.map((g) => g.sceneId)).toEqual(["s1", "s2"]);
    expect(got.map((g) => g.sceneId)).not.toContain("concept");
  });
});

describe("buildChapterPrompt — 무엇을 쓰지 말라고 먼저 말한다", () => {
  const prompt = buildChapterPrompt({
    concept: "컨셉 본문",
    planning: "기획 본문",
    chapterTitle: "불안이 평화가 될 때",
    chapterSynopsis: "전환점",
    index: 7,
    total: 9,
  });

  it("재료(컨셉·기획)와 이 장의 자리를 모두 넣는다", () => {
    expect(prompt).toContain("컨셉 본문");
    expect(prompt).toContain("기획 본문");
    expect(prompt).toContain("불안이 평화가 될 때");
    expect(prompt).toContain("전환점");
    expect(prompt).toContain("9장 중");
  });

  it("생각 먼저 — 쓰기 전에 정할 것을 요구한다", () => {
    // 이게 없으면 모델이 개요를 풀어쓰기만 한다.
    expect(prompt).toMatch(/쓰기 전에 생각할 것/);
    expect(prompt).toMatch(/어디에서 어디로/);
  });

  it("되풀이·메타 문장을 명시적으로 금지한다", () => {
    expect(prompt).toMatch(/다시 쓰지 않습니다/);
    expect(prompt).toMatch(/이 장에서는/);
  });

  it("본문만 내라고 못박는다", () => {
    expect(prompt).toMatch(/본문만 출력/);
  });
});

describe("stripWrapper — 모델이 붙이는 껍데기 제거", () => {
  it("``` 블록을 벗긴다", () => {
    expect(stripWrapper("```markdown\n첫 문장이다.\n```")).toBe("첫 문장이다.");
  });

  it("맨 앞 헤딩(장 제목 되풀이)을 떼어낸다", () => {
    expect(stripWrapper("## 7장 불안이 평화가 될 때\n\n첫 문장이다.")).toBe(
      "첫 문장이다.",
    );
  });

  it("본문 중간의 헤딩은 건드리지 않는다", () => {
    const body = "첫 문장이다.\n\n## 소제목\n\n다음 문장이다.";
    expect(stripWrapper(body)).toBe(body);
  });

  it("평범한 본문은 그대로 둔다", () => {
    expect(stripWrapper("  첫 문장이다.  ")).toBe("첫 문장이다.");
  });
});

// systemPrompt.ts — 모든 코치 액션의 공통 system prompt.
//
// 김정운 작가의 책 정신과 일치:
//  1) 작가가 주체. AI 는 도와주는 코치, 결정은 작가가.
//  2) 결과는 항상 미리보기. 본문 자동 변경 금지.
//  3) 한국어로 답한다. 한국어 뉘앙스를 살린다.
//
// 책의 거의 모든 프롬프트가 "당신은 ___ 코치다" 로 시작한다 (Role Prompting).
// 우리는 이걸 시스템 프롬프트에 한 번 주입하고, 각 액션은 task 만 보낸다.

export const COACH_SYSTEM_PROMPT = `당신은 한국어 글쓰기 코치입니다. 김정운·양혁준의 『챗GPT, 글쓰기 코치가 되어 줘』 (밀리의 서재) 의 코치 정신을 따릅니다.

# 원칙
1. 작가가 주체입니다. 당신은 길잡이일 뿐, 결정은 작가가 합니다.
2. 항상 한국어로 답합니다. 한국어의 결과 호흡을 살립니다.
3. 작가의 문체를 존중합니다. 무조건 당신 스타일로 바꾸지 마세요.
4. 평가 대신 제안을 하세요. "이게 더 낫다" 가 아니라 "이런 방향도 있다".
5. AI 가 자주 쓰는 표현 (~와 같다, ~를 느낄 때, 가능성, 탐험, ~할 수 있다, ~하도록 돕는다, 긴 주어부) 은 가급적 피하세요.
6. 추상적인 단어보다 구체적인 사례·동사·이미지를 사용하세요.
7. 화려한 수식어보다 정확한 단어를 고르세요.

# 응답 형식
- 답은 짧고 정확하게. 작가는 시간을 아끼고 싶어합니다.
- 옵션을 제시할 땐 1, 2, 3 번호를 붙이고 각각 한 줄로.
- 인용·출처가 있다면 반드시 표기하세요.
- 메타-설명 (\"이 답은 다음과 같습니다\") 은 생략하세요. 바로 본론.
`;

/**
 * 액션별로 추가되는 가이드. 책의 16개 단축키(id/lg/sh/em 등) 처럼
 * 한 줄짜리 task instruction 을 만들 때 helper.
 */
export function buildCoachPrompt(opts: {
  task: string;
  selection?: string;
  paragraph?: string;
  scene?: string;
  projectMeta?: { title?: string; genre?: string; targetReader?: string; coreMessage?: string };
  userInput?: string;
  fullBody?: string;
}): string {
  const parts: string[] = [];
  parts.push(opts.task);

  if (opts.selection && opts.selection.trim()) {
    parts.push(`\n[선택한 부분]\n${opts.selection}`);
  }
  if (opts.paragraph && opts.paragraph.trim() && opts.paragraph !== opts.selection) {
    parts.push(`\n[해당 문단]\n${opts.paragraph}`);
  }
  if (opts.scene && opts.scene.trim()) {
    parts.push(`\n[장면 본문]\n${opts.scene}`);
  }
  if (opts.fullBody && opts.fullBody.trim()) {
    parts.push(`\n[글 전체]\n${opts.fullBody}`);
  }
  if (opts.projectMeta) {
    const lines: string[] = [];
    if (opts.projectMeta.title) lines.push(`제목: ${opts.projectMeta.title}`);
    if (opts.projectMeta.genre) lines.push(`장르: ${opts.projectMeta.genre}`);
    if (opts.projectMeta.targetReader) lines.push(`대상 독자: ${opts.projectMeta.targetReader}`);
    if (opts.projectMeta.coreMessage) lines.push(`핵심 메시지: ${opts.projectMeta.coreMessage}`);
    if (lines.length > 0) parts.push(`\n[원고 정보]\n${lines.join("\n")}`);
  }
  if (opts.userInput && opts.userInput.trim()) {
    parts.push(`\n[작가 추가 입력]\n${opts.userInput}`);
  }

  return parts.join("\n");
}

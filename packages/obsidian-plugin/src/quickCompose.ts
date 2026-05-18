export type Register = "email" | "kakao" | "telegram" | "report" | "summary" | "memo";
export type EmailSubType = "draft" | "polish";
export type LengthHint = "짧게" | "보통" | "길게";

export interface QuickComposeInput {
  register: Register;
  emailSubType?: EmailSubType;
  intent: string;
  source?: string;
  reader?: string;
  length?: LengthHint;
  styleGuide?: string;
}

const ACTION_TABLE: Record<string, string> = {
  "email:draft":   "comms.email-draft",
  "email:polish":  "comms.email-polish",
  kakao:           "comms.kakao-short",
  telegram:        "comms.telegram-brief",
  report:          "comms.report-polish",
  summary:         "comms.summary-briefing",
  memo:            "comms.memo-capture",
};

export function getActionId(register: Register, emailSubType?: EmailSubType): string {
  if (register === "email") {
    const sub = emailSubType ?? "draft";
    return ACTION_TABLE[`email:${sub}`];
  }
  return ACTION_TABLE[register];
}

export function buildQuickComposePrompt(input: QuickComposeInput): string {
  const { register, intent, source, reader, length, styleGuide } = input;

  const lines: string[] = [];

  lines.push("## 즉석 커뮤니케이션 초안 요청");
  lines.push("");
  lines.push("**⚠️ 중요: 외부 발송 없음.** 이 요청은 텍스트 초안만 생성합니다. 이메일 전송, 카카오 발송, 텔레그램 전송 등 외부 전송은 절대 수행하지 않습니다.");
  lines.push("");

  lines.push(`**형식**: ${register}`);

  if (reader) {
    lines.push(`**수신자/독자**: ${reader}`);
  }

  if (length) {
    lines.push(`**길이**: ${length}`);
  }

  lines.push("");
  lines.push("**전달 의도**:");
  lines.push(intent);

  if (source) {
    lines.push("");
    lines.push("**참고 텍스트**:");
    lines.push(source);
  }

  // Register-specific instructions
  lines.push("");
  lines.push("**작성 지침**:");

  if (register === "report") {
    lines.push("- 원문의 사실·수치·결론은 절대 변경하지 않습니다. 팩트를 유지하며 문체만 다듬습니다.");
    lines.push("- 수치를 바꾸지 않으며, 결론을 임의로 추가·삭제하지 않습니다.");
  } else if (register === "summary") {
    lines.push("- 현황 / 핵심 / 시사점 3단 구조로 작성합니다.");
    lines.push("- 사실 이외의 내용을 추가하지 않습니다.");
  } else if (register === "kakao") {
    lines.push("- 카카오톡 메시지 특성에 맞게 짧고 간결하게 작성합니다 (3~5줄 이내 권장).");
    if (length) lines.push(`- 길이 힌트: ${length}`);
  } else if (register === "telegram") {
    lines.push("- 텔레그램 메시지 특성에 맞게 간결하고 명료하게 작성합니다.");
  } else if (register === "memo") {
    lines.push("- 원문의 핵심 내용과 아이디어는 빠짐없이 보존합니다. 분량을 크게 줄이지 않습니다.");
  }

  lines.push("- 초안 텍스트만 출력합니다. 외부로 보내지 않습니다.");

  if (styleGuide) {
    lines.push("");
    lines.push("**문체 가이드** (VoicePane 압축 프롬프트):");
    lines.push(styleGuide);
  }

  return lines.join("\n");
}

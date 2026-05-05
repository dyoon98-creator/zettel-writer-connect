// PromptTemplate — placeholder rendering + manifest-time validation.
//
// We deliberately reuse the `render` helper from `ContextComposer` so there
// is exactly one regex-based placeholder substitution implementation.
// `ContextComposer.compose()` builds the runtime placeholder map; this
// module provides:
//   1. The canonical list of supported placeholder names
//   2. A static validator used at load-time to check that a manifest's
//      declared `placeholders` actually cover what the prompt file uses
//
// Phase A: replaced direct `new Notice(…)` with an optional NoticeAdapter
// passed by the caller. Validator never throws.

import { NoticeAdapter } from "../adapters/NoticeAdapter";
import { render } from "../ai/ContextComposer";
import { log } from "../utils/logger";

/** All placeholder names recognized by the renderer. */
export const SUPPORTED_PLACEHOLDERS = [
  "manuscript",
  "section",
  "source_notes",
  "reader",
  "core_message",
  "user_input",
  "title",
  "genre",
  "word_goal",
  "current_words",
  "status",
] as const;

export type PlaceholderName = (typeof SUPPORTED_PLACEHOLDERS)[number];

/** Build a complete placeholder map, defaulting any missing field to "". */
export function buildPlaceholders(
  partial: Partial<Record<PlaceholderName, string>>,
): Record<PlaceholderName, string> {
  const out: Record<PlaceholderName, string> = {
    manuscript: "",
    section: "",
    source_notes: "",
    reader: "",
    core_message: "",
    user_input: "",
    title: "",
    genre: "",
    word_goal: "",
    current_words: "",
    status: "",
  };
  for (const k of SUPPORTED_PLACEHOLDERS) {
    if (k in partial && partial[k] !== undefined) {
      out[k] = partial[k] as string;
    }
  }
  return out;
}

/** Substitute placeholders in a template string. Thin wrapper around render. */
export function applyTemplate(
  template: string,
  values: Record<string, string>,
): { rendered: string; missing: string[] } {
  return render(template, values);
}

export interface TemplateValidation {
  /** Placeholders found in the prompt body that were NOT declared in manifest. */
  undeclared: string[];
  /** Placeholders declared but never used in the body. */
  unused: string[];
  /** Placeholders found that are NOT in SUPPORTED_PLACEHOLDERS. */
  unknown: string[];
}

/** Strip leading `{{` / trailing `}}` from a declared placeholder spec. */
function normalizeName(decl: string): string {
  return decl.replace(/^\{\{\s*/, "").replace(/\s*\}\}$/, "").trim();
}

/**
 * Compare a manifest's declared placeholders against what the prompt body
 * actually references. Emits a notice for each undeclared/unknown placeholder
 * (when `notice` is supplied). Always returns the validation result; never
 * throws — load is best-effort.
 */
export function validateTemplate(
  packId: string,
  actionId: string,
  declared: string[] | undefined,
  promptBody: string,
  notice?: NoticeAdapter,
): TemplateValidation {
  const decl = new Set(
    (declared ?? []).map(normalizeName).filter((s) => s.length > 0),
  );

  const used = new Set<string>();
  const re = /\{\{(\w+)\}\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(promptBody))) {
    used.add(m[1]);
  }

  const supported = new Set<string>(SUPPORTED_PLACEHOLDERS);
  const undeclared: string[] = [];
  const unknown: string[] = [];
  for (const name of used) {
    if (!supported.has(name)) {
      unknown.push(name);
    }
    if (decl.size > 0 && !decl.has(name)) {
      undeclared.push(name);
    }
  }
  const unused = [...decl].filter((d) => !used.has(d));

  if (undeclared.length > 0) {
    const msg = `스킬팩 [${packId}] · ${actionId}: 매니페스트에 선언되지 않은 플레이스홀더 ${undeclared.join(", ")}`;
    log.warn(msg);
    notice?.warn(msg);
  }
  if (unknown.length > 0) {
    const msg = `스킬팩 [${packId}] · ${actionId}: 지원되지 않는 플레이스홀더 ${unknown.join(", ")}`;
    log.warn(msg);
    notice?.warn(msg);
  }

  return { undeclared, unused, unknown };
}

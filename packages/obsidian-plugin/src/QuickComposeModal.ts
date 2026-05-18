import { App, Modal, Notice } from "obsidian";
import type AIManuscriptStudioPlugin from "./main";
import { ObsidianAppSettingsStore } from "./adapters/appSettings";
import { startAiInvocation } from "./adapters/aiBridge";
import {
  buildQuickComposePrompt,
  getActionId,
  Register,
  EmailSubType,
  LengthHint,
} from "./quickCompose";

export class QuickComposeModal extends Modal {
  private registerValue: Register = "email";
  private emailSubType: EmailSubType = "draft";
  private intentEl!: HTMLTextAreaElement;
  private sourceEl!: HTMLTextAreaElement;
  private readerEl!: HTMLInputElement;
  private lengthValue: LengthHint | "" = "";
  private styleModeValue: "manual" | "auto" = "manual";
  private styleGuideEl!: HTMLTextAreaElement;
  private resultEl!: HTMLPreElement;
  private generateBtn!: HTMLButtonElement;
  private copyBtn!: HTMLButtonElement;
  private insertBtn!: HTMLButtonElement;
  private resultText = "";
  private plugin?: AIManuscriptStudioPlugin;

  constructor(app: App, plugin?: AIManuscriptStudioPlugin) {
    super(app);
    this.plugin = plugin;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("quick-compose-modal");

    contentEl.createEl("h2", { text: "즉석 커뮤니케이션 작성" });

    // ── Register (형식) ──────────────────────────────────────────
    this.addLabel(contentEl, "형식");
    const registerSel = contentEl.createEl("select") as HTMLSelectElement;
    const registers: { value: string; label: string }[] = [
      { value: "email", label: "이메일 (초안)" },
      { value: "email-polish", label: "이메일 (다듬기)" },
      { value: "kakao", label: "카카오톡" },
      { value: "telegram", label: "텔레그램" },
      { value: "report", label: "보고서" },
      { value: "summary", label: "요약 보고자료" },
      { value: "memo", label: "메모" },
    ];
    for (const { value, label } of registers) {
      const opt = registerSel.createEl("option") as HTMLOptionElement;
      // Map email-polish → value "email" with subtype, but expose separate options
      opt.value = value;
      opt.text = label;
    }
    // Override option values so tests can check canonical register names
    // email = email draft, email-polish = email polish
    // We'll translate on read
    registerSel.addEventListener("change", () => {
      const v = registerSel.value;
      if (v === "email-polish") {
        this.registerValue = "email";
        this.emailSubType = "polish";
      } else {
        this.registerValue = v as Register;
        this.emailSubType = "draft";
      }
    });

    // ── Intent (전달 의도) — required ────────────────────────────
    this.addLabel(contentEl, "전달 의도 (필수)");
    this.intentEl = contentEl.createEl("textarea") as HTMLTextAreaElement;
    this.intentEl.setAttribute("data-field", "intent");
    this.intentEl.placeholder = "무엇을, 누구에게, 왜 전달할지 입력하세요.";
    this.intentEl.rows = 4;
    this.intentEl.style.width = "100%";
    this.intentEl.addEventListener("input", () => this.updateGenerateState());

    // ── Source (참고 텍스트) — optional ─────────────────────────
    this.addLabel(contentEl, "참고 텍스트 (선택)");
    this.sourceEl = contentEl.createEl("textarea") as HTMLTextAreaElement;
    this.sourceEl.setAttribute("data-field", "source");
    this.sourceEl.placeholder = "현재 에디터 선택 텍스트가 자동으로 채워집니다. 직접 입력도 가능합니다.";
    this.sourceEl.rows = 3;
    this.sourceEl.style.width = "100%";
    this.prefillSourceFromEditor();

    // ── Reader (수신자/독자) — optional ─────────────────────────
    this.addLabel(contentEl, "수신자/독자 (선택)");
    this.readerEl = contentEl.createEl("input") as HTMLInputElement;
    this.readerEl.setAttribute("data-field", "reader");
    this.readerEl.type = "text";
    this.readerEl.placeholder = "예: 이사회, A투자사 김대표";
    this.readerEl.style.width = "100%";

    // ── Length (길이 힌트) — optional ────────────────────────────
    this.addLabel(contentEl, "길이 (선택)");
    const lengthSel = contentEl.createEl("select") as HTMLSelectElement;
    for (const v of ["", "짧게", "보통", "길게"]) {
      const opt = lengthSel.createEl("option") as HTMLOptionElement;
      opt.value = v;
      opt.text = v || "기본";
    }
    lengthSel.addEventListener("change", () => {
      this.lengthValue = lengthSel.value as LengthHint | "";
    });

    // ── Style Mode (문체 모드) ────────────────────────────────────
    this.addLabel(contentEl, "문체 모드");
    const styleModeSel = contentEl.createEl("select") as HTMLSelectElement;
    const manualOpt = styleModeSel.createEl("option") as HTMLOptionElement;
    manualOpt.value = "manual";
    manualOpt.text = "수동 붙여넣기";
    const autoOpt = styleModeSel.createEl("option") as HTMLOptionElement;
    autoOpt.value = "auto";
    autoOpt.text = "자동 적용 (B3 이후 지원)";
    autoOpt.disabled = true;
    styleModeSel.addEventListener("change", () => {
      this.styleModeValue = styleModeSel.value as "manual" | "auto";
    });

    // ── Style Guide (문체 가이드) — manual paste ─────────────────
    this.addLabel(contentEl, "문체 가이드 (VoicePane 압축 프롬프트 붙여넣기)");
    this.styleGuideEl = contentEl.createEl("textarea") as HTMLTextAreaElement;
    this.styleGuideEl.setAttribute("data-field", "style-guide");
    this.styleGuideEl.placeholder = "AI 원고실 → 내 문체(VoicePane) → 압축 프롬프트 복사 후 여기에 붙여넣기";
    this.styleGuideEl.rows = 3;
    this.styleGuideEl.style.width = "100%";

    // ── Result area ──────────────────────────────────────────────
    this.resultEl = contentEl.createEl("pre") as HTMLPreElement;
    this.resultEl.setAttribute("data-field", "result");
    this.resultEl.style.whiteSpace = "pre-wrap";
    this.resultEl.style.minHeight = "80px";
    this.resultEl.style.border = "1px solid var(--background-modifier-border)";
    this.resultEl.style.padding = "8px";
    this.resultEl.textContent = "";

    // ── Buttons ──────────────────────────────────────────────────
    const btnRow = contentEl.createEl("div");
    btnRow.style.display = "flex";
    btnRow.style.gap = "8px";
    btnRow.style.marginTop = "8px";

    this.generateBtn = btnRow.createEl("button") as HTMLButtonElement;
    this.generateBtn.textContent = "생성";
    this.generateBtn.disabled = true;
    this.generateBtn.addEventListener("click", () => this.handleGenerate());

    this.copyBtn = btnRow.createEl("button") as HTMLButtonElement;
    this.copyBtn.textContent = "복사";
    this.copyBtn.addEventListener("click", () => this.handleCopy());

    this.insertBtn = btnRow.createEl("button") as HTMLButtonElement;
    this.insertBtn.textContent = "현재 파일에 삽입";
    this.insertBtn.addEventListener("click", () => this.handleInsert());

    const closeBtn = btnRow.createEl("button") as HTMLButtonElement;
    closeBtn.textContent = "닫기";
    closeBtn.addEventListener("click", () => this.close());
  }

  onClose(): void {
    this.contentEl.empty();
  }

  private addLabel(parent: HTMLElement, text: string): void {
    const lbl = parent.createEl("label");
    lbl.textContent = text;
    lbl.style.display = "block";
    lbl.style.marginTop = "8px";
    lbl.style.fontWeight = "500";
  }

  private prefillSourceFromEditor(): void {
    try {
      const ws = (this.app as unknown as { workspace?: { activeEditor?: { editor?: { getSelection?: () => string } } } }).workspace;
      const sel = ws?.activeEditor?.editor?.getSelection?.();
      if (sel) this.sourceEl.value = sel;
    } catch {
      // safe to ignore — prefill is best-effort
    }
  }

  private updateGenerateState(): void {
    this.generateBtn.disabled = this.intentEl.value.trim().length === 0;
  }

  private async handleGenerate(): Promise<void> {
    const intent = this.intentEl.value.trim();
    if (!intent) {
      new Notice("전달 의도를 입력해 주세요.");
      return;
    }

    this.generateBtn.disabled = true;
    this.generateBtn.textContent = "생성 중...";
    this.resultEl.textContent = "";

    try {
      if (!this.plugin) {
        new Notice("플러그인 컨텍스트가 없습니다.");
        return;
      }
      const settings = await new ObsidianAppSettingsStore(this.plugin).load();

      if (settings.aiProvider === "mock" || settings.useMockBridge) {
        new Notice("AI 제공자가 설정되지 않았습니다. 설정에서 Codex 또는 Claude Code 경로를 확인하세요.");
        return;
      }

      const binaryPath =
        settings.aiProvider === "codex"
          ? settings.codexPath
          : settings.claudeCodePath;

      if (!binaryPath) {
        new Notice("AI 바이너리 경로가 비어 있습니다. 플러그인 설정을 확인하세요.");
        return;
      }

      const prompt = buildQuickComposePrompt({
        register: this.registerValue,
        emailSubType: this.emailSubType,
        intent,
        source: this.sourceEl.value.trim() || undefined,
        reader: this.readerEl.value.trim() || undefined,
        length: (this.lengthValue as LengthHint) || undefined,
        styleGuide: this.styleGuideEl.value.trim() || undefined,
      });

      const actionId = getActionId(this.registerValue, this.emailSubType);
      const fullPrompt = `[action: ${actionId}]\n\n${prompt}`;

      const handle = startAiInvocation({
        provider: settings.aiProvider as "codex" | "claude-code",
        binaryPath,
        extraArgs: settings.codexExtraArgs
          ? settings.codexExtraArgs.split(/\s+/).filter(Boolean)
          : [],
        prompt: fullPrompt,
        timeoutSecs: 300,
      });

      const result = await handle.done;
      this.resultText = result.fullText;
      this.resultEl.textContent = this.resultText;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(`생성 실패: ${msg}`);
    } finally {
      this.generateBtn.textContent = "생성";
      this.updateGenerateState();
    }
  }

  private async handleCopy(): Promise<void> {
    if (!this.resultText) {
      new Notice("복사할 결과가 없습니다. 먼저 생성해 주세요.");
      return;
    }
    try {
      await navigator.clipboard.writeText(this.resultText);
      new Notice("클립보드에 복사되었습니다.");
    } catch {
      new Notice("클립보드 복사 실패. 결과 텍스트를 직접 선택해 복사하세요.");
    }
  }

  private handleInsert(): void {
    if (!this.resultText) {
      new Notice("삽입할 결과가 없습니다. 먼저 생성해 주세요.");
      return;
    }
    try {
      const ws = (this.app as unknown as { workspace?: { activeEditor?: { editor?: { replaceSelection?: (t: string) => void } } } }).workspace;
      const editor = ws?.activeEditor?.editor;
      if (!editor?.replaceSelection) {
        new Notice("현재 열린 Markdown 편집기가 없습니다.");
        return;
      }
      editor.replaceSelection(this.resultText);
      new Notice("현재 파일에 삽입되었습니다.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      new Notice(`삽입 실패: ${msg}`);
    }
  }
}

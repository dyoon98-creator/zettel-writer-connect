import { App, PluginSettingTab, Setting } from "obsidian";
import type ZettelConnectPlugin from "./main";

export interface ZettelConnectSettings {
  // Ranking
  topK: number;
  structuralPoolSize: number;
  structuralWeight: number; // 0..1
  semanticWeight: number; // 0..1

  // Auto trigger
  autoTrigger: boolean;
  autoTriggerFolder: string; // e.g. "2 Permanent/"
  autoTriggerDebounceMs: number;

  // Embedding provider
  embeddingProvider: "off" | "ollama";
  ollamaEndpoint: string;
  ollamaModel: string;
  autostartOllama: boolean;
  ollamaBinary: string; // empty = auto-detect (/opt/homebrew/bin, /usr/local/bin, ...)

  // Noise filter
  noiseValues: string[];

  // Output paths
  candidatesPath: string;
  permanentFolder: string;

  // CLI handoff
  cliCommandTemplate: string;
}

export const DEFAULT_SETTINGS: ZettelConnectSettings = {
  topK: 7,
  structuralPoolSize: 50,
  structuralWeight: 0.6,
  semanticWeight: 0.4,

  autoTrigger: true,
  autoTriggerFolder: "2 Permanent/",
  autoTriggerDebounceMs: 400,

  embeddingProvider: "ollama",
  ollamaEndpoint: "http://localhost:11434",
  ollamaModel: "nomic-embed-text",
  autostartOllama: true,
  ollamaBinary: "",

  noiseValues: ["미분류", "unclassified", ""],

  candidatesPath: "_index/connect-candidates.json",
  permanentFolder: "2 Permanent/",

  cliCommandTemplate: 'claude "/permanent --from-candidates {path}"',
};

export class ZettelConnectSettingTab extends PluginSettingTab {
  plugin: ZettelConnectPlugin;

  constructor(app: App, plugin: ZettelConnectPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    containerEl.createEl("h2", { text: "Zettel Connect" });

    // ── Ranking ─────────────────────────────────────
    containerEl.createEl("h3", { text: "추천 알고리즘" });

    new Setting(containerEl)
      .setName("Top K (표시할 후보 수)")
      .setDesc("사이드 패널에 표시할 최대 후보 개수")
      .addSlider((s) =>
        s
          .setLimits(3, 20, 1)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.topK)
          .onChange(async (v) => {
            this.plugin.settings.topK = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("구조 점수 풀 크기")
      .setDesc("임베딩 재정렬 전 구조 점수로 선별할 후보 수")
      .addSlider((s) =>
        s
          .setLimits(20, 150, 10)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.structuralPoolSize)
          .onChange(async (v) => {
            this.plugin.settings.structuralPoolSize = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("구조 가중치 (vs 의미)")
      .setDesc(
        "최종 점수 = α · 구조 + (1-α) · 의미. 1.0 = 구조만, 0.0 = 의미만",
      )
      .addSlider((s) =>
        s
          .setLimits(0, 1, 0.05)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.structuralWeight)
          .onChange(async (v) => {
            this.plugin.settings.structuralWeight = v;
            this.plugin.settings.semanticWeight = 1 - v;
            await this.plugin.saveSettings();
          }),
      );

    // ── Auto trigger ────────────────────────────────
    containerEl.createEl("h3", { text: "자동 추천 트리거" });

    new Setting(containerEl)
      .setName("자동 계산 활성화")
      .setDesc("지정 폴더의 노트를 열면 자동으로 추천 계산")
      .addToggle((t) =>
        t
          .setValue(this.plugin.settings.autoTrigger)
          .onChange(async (v) => {
            this.plugin.settings.autoTrigger = v;
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("자동 트리거 대상 폴더")
      .setDesc("이 경로로 시작하는 파일만 자동 계산")
      .addText((t) =>
        t
          .setPlaceholder("2 Permanent/")
          .setValue(this.plugin.settings.autoTriggerFolder)
          .onChange(async (v) => {
            this.plugin.settings.autoTriggerFolder = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("디바운스 (ms)")
      .setDesc("파일 전환 후 계산까지 대기 시간")
      .addSlider((s) =>
        s
          .setLimits(100, 2000, 50)
          .setDynamicTooltip()
          .setValue(this.plugin.settings.autoTriggerDebounceMs)
          .onChange(async (v) => {
            this.plugin.settings.autoTriggerDebounceMs = v;
            await this.plugin.saveSettings();
          }),
      );

    // ── Embedding ───────────────────────────────────
    containerEl.createEl("h3", { text: "의미 검색 (임베딩)" });

    new Setting(containerEl)
      .setName("임베딩 제공자")
      .setDesc(
        "OFF: 구조 점수만 사용. OLLAMA: 로컬 Ollama 서버로 claim 임베딩 계산 → 코사인 유사도로 재정렬",
      )
      .addDropdown((d) =>
        d
          .addOption("off", "OFF (구조 점수만)")
          .addOption("ollama", "Ollama (로컬)")
          .setValue(this.plugin.settings.embeddingProvider)
          .onChange(async (v) => {
            this.plugin.settings.embeddingProvider = v as "off" | "ollama";
            await this.plugin.saveSettings();
            this.display(); // re-render to show/hide ollama fields
          }),
      );

    if (this.plugin.settings.embeddingProvider === "ollama") {
      new Setting(containerEl)
        .setName("Ollama 엔드포인트")
        .addText((t) =>
          t
            .setPlaceholder("http://localhost:11434")
            .setValue(this.plugin.settings.ollamaEndpoint)
            .onChange(async (v) => {
              this.plugin.settings.ollamaEndpoint = v.trim();
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName("Ollama 임베딩 모델")
        .setDesc(
          "권장: nomic-embed-text (274MB, 경량) · bge-m3 (한국어 최적) · exaone3.5:2.4b (이미 설치돼 있다면)",
        )
        .addText((t) =>
          t
            .setPlaceholder("nomic-embed-text")
            .setValue(this.plugin.settings.ollamaModel)
            .onChange(async (v) => {
              this.plugin.settings.ollamaModel = v.trim();
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName("Obsidian 실행 시 Ollama 자동 기동")
        .setDesc(
          "Obsidian 시작할 때 `ollama serve`가 이미 떠 있지 않으면 백그라운드로 실행합니다. macOS/Linux 데스크톱 전용.",
        )
        .addToggle((t) =>
          t
            .setValue(this.plugin.settings.autostartOllama)
            .onChange(async (v) => {
              this.plugin.settings.autostartOllama = v;
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName("Ollama 바이너리 경로")
        .setDesc(
          "비워두면 자동 탐지 (/opt/homebrew/bin/ollama → /usr/local/bin/ollama → PATH). Obsidian을 Dock/Spotlight로 실행하면 shell PATH를 못 받으므로 자동 탐지가 필요합니다.",
        )
        .addText((t) =>
          t
            .setPlaceholder("/opt/homebrew/bin/ollama")
            .setValue(this.plugin.settings.ollamaBinary)
            .onChange(async (v) => {
              this.plugin.settings.ollamaBinary = v.trim();
              await this.plugin.saveSettings();
            }),
        );

      new Setting(containerEl)
        .setName("임베딩 캐시")
        .setDesc(
          ".obsidian/plugins/zettel-connect/cache/embeddings.json (mtime 기반 증분 갱신)",
        )
        .addButton((b) =>
          b.setButtonText("캐시 초기화").onClick(async () => {
            await this.plugin.clearEmbeddingCache();
          }),
        )
        .addButton((b) =>
          b
            .setButtonText("연결 테스트")
            .setCta()
            .onClick(async () => {
              await this.plugin.testOllama();
            }),
        );
    }

    // ── Noise ───────────────────────────────────────
    containerEl.createEl("h3", { text: "노이즈 필터" });

    new Setting(containerEl)
      .setName("무시할 cluster/tag 값")
      .setDesc("쉼표 구분. 예: 미분류, unclassified, misc")
      .addText((t) =>
        t
          .setPlaceholder("미분류, unclassified")
          .setValue(this.plugin.settings.noiseValues.join(", "))
          .onChange(async (v) => {
            this.plugin.settings.noiseValues = v
              .split(",")
              .map((x) => x.trim())
              .filter(Boolean);
            await this.plugin.saveSettings();
          }),
      );

    // ── Paths ────────────────────────────────────────
    containerEl.createEl("h3", { text: "경로 설정" });

    new Setting(containerEl)
      .setName("영구노트 폴더")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.permanentFolder)
          .onChange(async (v) => {
            this.plugin.settings.permanentFolder = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("candidates.json 저장 경로")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.candidatesPath)
          .onChange(async (v) => {
            this.plugin.settings.candidatesPath = v.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("CLI 명령 템플릿")
      .setDesc("{path} 가 candidates.json 경로로 치환됩니다")
      .addText((t) =>
        t
          .setValue(this.plugin.settings.cliCommandTemplate)
          .onChange(async (v) => {
            this.plugin.settings.cliCommandTemplate = v;
            await this.plugin.saveSettings();
          }),
      );
  }
}

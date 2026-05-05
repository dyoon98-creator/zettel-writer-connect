// Verify the pipeline writes results in the right places and respects user
// choice. We stub LocalAIBridge with a deterministic result.
//
// In v2, the pipeline takes adapters + host UI callbacks. The "preview" step
// is now a `previewResult` callback we drive from the test, replacing the
// v1 ResultPreviewModal mock.

import {
  ResultPipeline,
  PipelineAction,
  PipelineSettings,
  ResultChoice,
} from "../src/ai/ResultPipeline";
import { ContextComposer } from "../src/ai/ContextComposer";
import { LocalAIBridge } from "../src/ai/LocalAIBridge";
import { InMemoryVaultAdapter } from "../src/adapters/InMemoryVaultAdapter";
import { InMemoryNoticeAdapter } from "../src/adapters/InMemoryNoticeAdapter";
import { InMemoryFrontmatterAdapter } from "../src/adapters/InMemoryFrontmatterAdapter";
import { ResultSink } from "../src/adapters/ResultSink";

const ACTION: PipelineAction = {
  id: "phase2.first-sentence",
  label: "첫 문장 코칭",
  sectionAnchor: "초안",
  saveTo: "feedback",
  placeholders: ["manuscript", "section"],
  promptTemplate: "원고:\n{{manuscript}}\n섹션:\n{{section}}",
};

const PROJECT_PATH = "3 Writing/test.md";
const PROJECT_TITLE = "test";
const PROJECT_BODY =
  "---\ntype: writing\n---\n# 제목\n\n## 기획\n계획\n\n## 초안\n첫 문장은 무겁다.\n";

const DEFAULT_SETTINGS: PipelineSettings = {
  confirmBeforeRun: false,
  enableExecLog: false,
  skillpackFolder: "_skillpacks",
  excludedFolders: [],
};

function makeFakeWorld() {
  const vault = new InMemoryVaultAdapter();
  vault.setFile(PROJECT_PATH, PROJECT_BODY);
  const notice = new InMemoryNoticeAdapter();
  const frontmatter = new InMemoryFrontmatterAdapter(vault);

  // ResultSink — appends a `### heading\n\ntext` block under `## section`.
  const sink: ResultSink = {
    appendUnderSection: jest.fn(
      async (
        projectPath: string,
        section: string,
        text: string,
        heading?: string,
      ) => {
        const cur = vault.getFile(projectPath);
        const block = heading
          ? `\n${heading}\n\n${text.trim()}\n`
          : `\n${text.trim()}\n`;
        const lines = cur.split(/\r?\n/);
        const sectionHeading = `## ${section}`;
        let idx = lines.findIndex((l) => l.trim() === sectionHeading);
        let next = cur;
        if (idx === -1) {
          if (!next.endsWith("\n")) next += "\n";
          next += `\n${sectionHeading}\n`;
          idx = next.split(/\r?\n/).findIndex((l) => l.trim() === sectionHeading);
        }
        const updatedLines = next.split(/\r?\n/);
        let end = idx + 1;
        while (end < updatedLines.length && !/^## /.test(updatedLines[end])) {
          end += 1;
        }
        const before = updatedLines.slice(0, end);
        const after = updatedLines.slice(end);
        const merged = [
          ...before,
          "",
          ...block.trim().split("\n"),
          "",
          ...after,
        ];
        vault.setFile(projectPath, merged.join("\n"));
      },
    ),
  };

  const composer = new ContextComposer({
    vault,
    notice,
    frontmatter,
    resolveWiki: () => null,
  });

  return { vault, notice, frontmatter, sink, composer };
}

function makeBridge(text = "결과 텍스트"): LocalAIBridge {
  return {
    id: "codex",
    displayName: "Codex CLI",
    isAvailable: async () => true,
    invoke: async (_ctx) => ({ text, durationMs: 100, exitCode: 0 }),
  };
}

function buildPipeline(opts: {
  bridge: LocalAIBridge;
  choice: ResultChoice;
  world: ReturnType<typeof makeFakeWorld>;
  settings?: Partial<PipelineSettings>;
}) {
  const { bridge, choice, world } = opts;
  const settings: PipelineSettings = {
    ...DEFAULT_SETTINGS,
    ...(opts.settings ?? {}),
  };
  return new ResultPipeline({
    vault: world.vault,
    notice: world.notice,
    frontmatter: world.frontmatter,
    sink: world.sink,
    bridge,
    settings,
    composer: world.composer,
    sessionFlags: { suppressConfirm: false },
    confirmRun: async () => ({ proceed: true }),
    previewResult: async () => choice,
  });
}

describe("ResultPipeline", () => {
  it("save-to-feedback appends a timestamped subheading under ## 피드백", async () => {
    const world = makeFakeWorld();
    const pipeline = buildPipeline({
      bridge: makeBridge("피드백 본문"),
      choice: "save",
      world,
    });

    await pipeline.run(ACTION, {
      projectPath: PROJECT_PATH,
      projectTitle: PROJECT_TITLE,
    });
    const after = world.vault.getFile(PROJECT_PATH);
    expect(after).toContain("## 피드백");
    expect(after).toMatch(/### \d{4}-\d{2}-\d{2} \d{2}:\d{2} — 첫 문장 코칭/);
    expect(after).toContain("피드백 본문");
    // Sink was called once
    expect(world.sink.appendUnderSection).toHaveBeenCalledTimes(1);
  });

  it("discard makes no project-file changes", async () => {
    const world = makeFakeWorld();
    const before = world.vault.getFile(PROJECT_PATH);
    const pipeline = buildPipeline({
      bridge: makeBridge("무시될 본문"),
      choice: "discard",
      world,
    });

    await pipeline.run(ACTION, {
      projectPath: PROJECT_PATH,
      projectTitle: PROJECT_TITLE,
    });
    const after = world.vault.getFile(PROJECT_PATH);
    expect(after).toBe(before);
    // No history file should have been created either.
    expect(world.vault.hasFile("3 Writing/test.ams-history.md")).toBe(false);
  });

  it("history file is appended on save", async () => {
    const world = makeFakeWorld();
    const pipeline = buildPipeline({
      bridge: makeBridge("저장 본문"),
      choice: "save",
      world,
    });

    await pipeline.run(ACTION, {
      projectPath: PROJECT_PATH,
      projectTitle: PROJECT_TITLE,
    });
    const historyPath = "3 Writing/test.ams-history.md";
    expect(world.vault.hasFile(historyPath)).toBe(true);
    const history = world.vault.getFile(historyPath);
    expect(history).toContain("저장 본문");
    expect(history).toContain("phase2.first-sentence");
  });

  it("notifies and bails when bridge.isAvailable is false", async () => {
    const world = makeFakeWorld();
    const bridge: LocalAIBridge = {
      id: "codex",
      displayName: "Codex CLI",
      isAvailable: async () => false,
      invoke: jest.fn(),
    };
    const pipeline = buildPipeline({
      bridge,
      choice: "save",
      world,
    });

    await pipeline.run(ACTION, {
      projectPath: PROJECT_PATH,
      projectTitle: PROJECT_TITLE,
    });
    expect((bridge.invoke as jest.Mock).mock.calls.length).toBe(0);
    expect(world.sink.appendUnderSection).not.toHaveBeenCalled();
    expect(world.notice.contains("설치되어 있지 않습니다")).toBe(true);
  });
});

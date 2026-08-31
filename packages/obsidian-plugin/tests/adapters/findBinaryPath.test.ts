// findBinaryPath — 자식 프로세스에 넘길 PATH 가 node 를 반드시 포함하는지.
//
// 왜 이 파일이 있나 (2026-08-31 실측). codex 는 `#!/usr/bin/env node` 스크립트다.
// 옵시디언은 GUI 앱이라 launchd 의 짧은 PATH (`/usr/bin:/bin:/usr/sbin:/sbin`)
// 만 물려받고, 거기에는 node 가 없다. 그래서 codex 경로를 정확히 찾아내고도
// 자식이 exit 127 (`env: node: No such file or directory`) 로 죽었다.
//
// 원인은 login shell probe 가 조용히 실패한 것이었다 — `zsh -ilc` 가 이 기계에서
// 958~1755ms 걸렸는데 상한이 2000ms 였고, 실패하면 짧은 PATH 로 되돌아간 뒤
// «그 실패를 세션 내내 캐시»했다. 그래서 될 때도 있고 안 될 때도 있었다.
//
// 아래 검사 넷은 그 세 실패 경로를 각각 막는다.

const mockElectronRequire = jest.fn();

jest.mock("../../src/adapters/electronBridge", () => ({
  electronAvailable: (): boolean => true,
  electronRequire: (name: string): unknown => mockElectronRequire(name),
}));

import {
  getExpandedPathString,
  __resetPathCacheForTest,
} from "../../src/adapters/findBinary";

/** 옵시디언이 GUI 앱으로 시작될 때 실제로 물려받는 PATH. node 가 없다. */
const LAUNCHD_SHORT_PATH = "/usr/bin:/bin:/usr/sbin:/sbin";

const HOME = "/Users/tester";

/**
 * 가짜 파일시스템 · 셸을 주입한다.
 *
 * @param nodeAt        node 실행파일이 «존재하는» 절대경로 집합
 * @param shellPath     login shell probe 가 돌려줄 PATH. null 이면 probe 실패
 * @param nvmVersions   `~/.nvm/versions/node` 아래 디렉터리 이름들
 */
function install(opts: {
  nodeAt: Set<string>;
  shellPath: string | null;
  nvmVersions?: string[];
}): { execCalls: string[] } {
  const execCalls: string[] = [];

  mockElectronRequire.mockImplementation((name: string): unknown => {
    if (name === "process") {
      return { env: { HOME, PATH: LAUNCHD_SHORT_PATH, SHELL: "/bin/zsh" } };
    }
    if (name === "node:child_process" || name === "child_process") {
      return {
        execSync: (cmd: string): string => {
          execCalls.push(cmd);
          if (opts.shellPath === null) throw new Error("probe timeout");
          return opts.shellPath;
        },
      };
    }
    if (name === "node:fs" || name === "fs") {
      return {
        statSync: (p: string): { isFile: () => boolean } => {
          if (opts.nodeAt.has(p)) return { isFile: () => true };
          throw new Error("ENOENT");
        },
        readdirSync: (p: string): string[] => {
          if (p === `${HOME}/.nvm/versions/node` && opts.nvmVersions) {
            return opts.nvmVersions;
          }
          throw new Error("ENOENT");
        },
      };
    }
    return null;
  });

  return { execCalls };
}

beforeEach(() => {
  mockElectronRequire.mockReset();
  __resetPathCacheForTest();
});

describe("getExpandedPathString — 자식이 node 를 찾을 수 있어야 한다", () => {
  it("probe 가 성공하면 사용자 PATH 를 그대로 쓴다", () => {
    install({
      nodeAt: new Set([`${HOME}/.local/bin/node`]),
      shellPath: `${HOME}/.local/bin:/opt/homebrew/bin:/usr/bin:/bin`,
    });

    const dirs = getExpandedPathString().split(":");

    expect(dirs).toContain(`${HOME}/.local/bin`);
    expect(dirs).toContain("/opt/homebrew/bin");
  });

  it("probe 가 실패해도 정적 후보에서 node 를 찾아 PATH 앞에 붙인다", () => {
    // 이것이 대표가 겪은 상황이다 — probe 가 timeout 으로 죽고 짧은 PATH 만
    // 남았다. 고치기 전에는 여기서 exit 127 이 났다.
    install({
      nodeAt: new Set(["/opt/homebrew/bin/node"]),
      shellPath: null,
    });

    const dirs = getExpandedPathString().split(":");

    expect(dirs[0]).toBe("/opt/homebrew/bin");
    expect(dirs).toEqual(expect.arrayContaining(["/usr/bin", "/bin"]));
  });

  it("node 가 nvm 아래에만 있어도 찾아낸다", () => {
    install({
      nodeAt: new Set([`${HOME}/.nvm/versions/node/v22.22.3/bin/node`]),
      shellPath: null,
      nvmVersions: ["v22.22.3"],
    });

    const dirs = getExpandedPathString().split(":");

    expect(dirs[0]).toBe(`${HOME}/.nvm/versions/node/v22.22.3/bin`);
  });

  it("probe 실패를 영구 캐시하지 않는다 — 다음 호출이 다시 시도한다", () => {
    const { execCalls } = install({
      nodeAt: new Set(["/opt/homebrew/bin/node"]),
      shellPath: null,
    });

    getExpandedPathString();
    const afterFirst = execCalls.length;
    getExpandedPathString();

    // 고치기 전에는 첫 실패를 캐시해 두 번째 호출이 셸을 아예 안 불렀다.
    expect(execCalls.length).toBeGreaterThan(afterFirst);
  });

  it("`-lc` 로 node 가 잡히면 느린 `-ilc` 는 부르지 않는다", () => {
    // `-ilc` 는 이 기계에서 958~1755ms 걸렸다. 매번 그것을 부르면 상한을
    // 넘겨 다시 실패한다.
    const { execCalls } = install({
      nodeAt: new Set(["/opt/homebrew/bin/node"]),
      shellPath: "/opt/homebrew/bin:/usr/bin:/bin",
    });

    getExpandedPathString();

    expect(execCalls).toHaveLength(1);
    expect(execCalls[0]).toContain(" -lc ");
    expect(execCalls[0]).not.toContain(" -ilc ");
  });
});

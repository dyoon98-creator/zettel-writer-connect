// context.test.ts — Studio context ref-counting lifecycle unit tests.
// Validates that closing one ManuscriptStudioView does not kill the context
// while a second view is still open.

import {
  initStudioContext,
  getStudioPlugin,
  _resetContextForTests,
} from "../../src/studio/context";

// Minimal fake plugin — only needs to satisfy the AIManuscriptStudioPlugin type
// in the context module; context.ts does not call methods on it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakePlugin = { id: "test-plugin" } as any;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fakePlugin2 = { id: "test-plugin-2" } as any;

beforeEach(() => {
  _resetContextForTests();
});

describe("getStudioPlugin — before init", () => {
  it("throws with the canonical Korean error message", () => {
    expect(() => getStudioPlugin()).toThrow(
      /Studio context 가 초기화되지 않았습니다/,
    );
  });
});

describe("initStudioContext — single view", () => {
  it("makes getStudioPlugin return the plugin", () => {
    const release = initStudioContext(fakePlugin);
    expect(getStudioPlugin()).toBe(fakePlugin);
    release();
  });

  it("release disposes context when count reaches 0", () => {
    const release = initStudioContext(fakePlugin);
    release();
    expect(() => getStudioPlugin()).toThrow(/초기화되지 않았습니다/);
  });

  it("calling release twice is idempotent — does not undercount", () => {
    const release = initStudioContext(fakePlugin);
    const release2 = initStudioContext(fakePlugin2);
    release();
    release(); // duplicate call — must not decrement again
    // release2 still holds context
    expect(getStudioPlugin()).toBe(fakePlugin2);
    release2();
    expect(() => getStudioPlugin()).toThrow();
  });
});

describe("initStudioContext — two views open simultaneously", () => {
  it("closing one view does not break the other", () => {
    const releaseA = initStudioContext(fakePlugin);
    const releaseB = initStudioContext(fakePlugin);

    releaseA(); // view A closes — count drops to 1

    // view B is still active
    expect(getStudioPlugin()).toBe(fakePlugin);

    releaseB(); // view B closes — count drops to 0
    expect(() => getStudioPlugin()).toThrow(/초기화되지 않았습니다/);
  });

  it("second initStudioContext updates plugin reference", () => {
    const releaseA = initStudioContext(fakePlugin);
    const releaseB = initStudioContext(fakePlugin2);

    // Latest plugin wins
    expect(getStudioPlugin()).toBe(fakePlugin2);

    releaseA(); // still alive (count = 1)
    expect(getStudioPlugin()).toBe(fakePlugin2);

    releaseB(); // both closed
    expect(() => getStudioPlugin()).toThrow();
  });

  it("re-opening after full close works correctly", () => {
    const rel1 = initStudioContext(fakePlugin);
    rel1();
    expect(() => getStudioPlugin()).toThrow(); // fully disposed

    const rel2 = initStudioContext(fakePlugin2); // re-open
    expect(getStudioPlugin()).toBe(fakePlugin2);
    rel2();
    expect(() => getStudioPlugin()).toThrow();
  });
});

import { SnapshotIO, diffLines } from "../src/project/SnapshotIO";
import { InMemoryVaultAdapter } from "../src/adapters/InMemoryVaultAdapter";

describe("SnapshotIO", () => {
  const PROJECT = "프로젝트A";
  const SCENE_ID = "scene_x";

  function makeVault(): InMemoryVaultAdapter {
    return new InMemoryVaultAdapter({ basePath: "/vault" });
  }

  it("처음에는 list 가 빈 배열", async () => {
    const v = makeVault();
    const list = await SnapshotIO.list(v, PROJECT, SCENE_ID);
    expect(list).toEqual([]);
  });

  it("take → list → read 라운드트립", async () => {
    const v = makeVault();
    const meta = await SnapshotIO.take(v, {
      projectFolder: PROJECT,
      sceneId: SCENE_ID,
      body: "첫 번째 본문",
      label: "초고",
    });
    expect(meta.label).toBe("초고");
    expect(meta.charCount).toBe("첫 번째 본문".length);

    const list = await SnapshotIO.list(v, PROJECT, SCENE_ID);
    expect(list).toHaveLength(1);
    expect(list[0].takenAt).toBe(meta.takenAt);

    const full = await SnapshotIO.read(v, PROJECT, SCENE_ID, meta.takenAt);
    expect(full?.body).toBe("첫 번째 본문");
    expect(full?.label).toBe("초고");
  });

  it("여러 스냅샷은 최신순으로 정렬", async () => {
    const v = makeVault();
    const a = await SnapshotIO.take(v, { projectFolder: PROJECT, sceneId: SCENE_ID, body: "A" });
    // 1ms gap to ensure stamp 분리. ISO timestamp 가 ms 해상도라 sleep 보장.
    await new Promise((r) => setTimeout(r, 5));
    const b = await SnapshotIO.take(v, { projectFolder: PROJECT, sceneId: SCENE_ID, body: "B" });
    await new Promise((r) => setTimeout(r, 5));
    const c = await SnapshotIO.take(v, { projectFolder: PROJECT, sceneId: SCENE_ID, body: "C" });
    const list = await SnapshotIO.list(v, PROJECT, SCENE_ID);
    expect(list.map((m) => m.takenAt)).toEqual([c.takenAt, b.takenAt, a.takenAt]);
  });

  it("setLabel 로 라벨만 갱신", async () => {
    const v = makeVault();
    const meta = await SnapshotIO.take(v, {
      projectFolder: PROJECT,
      sceneId: SCENE_ID,
      body: "x",
      label: "초안",
    });
    await SnapshotIO.setLabel(v, PROJECT, SCENE_ID, meta.takenAt, "퇴고 직전");
    const list = await SnapshotIO.list(v, PROJECT, SCENE_ID);
    expect(list[0].label).toBe("퇴고 직전");
  });

  it("remove 후 list 에서 사라짐", async () => {
    const v = makeVault();
    const meta = await SnapshotIO.take(v, {
      projectFolder: PROJECT,
      sceneId: SCENE_ID,
      body: "x",
    });
    await SnapshotIO.remove(v, PROJECT, SCENE_ID, meta.takenAt);
    const list = await SnapshotIO.list(v, PROJECT, SCENE_ID);
    expect(list).toEqual([]);
  });

  it("scene id 에 슬래시·콜론 포함되어도 안전", async () => {
    const v = makeVault();
    const weirdId = "scene/with:weird-chars";
    await SnapshotIO.take(v, {
      projectFolder: PROJECT,
      sceneId: weirdId,
      body: "x",
    });
    const list = await SnapshotIO.list(v, PROJECT, weirdId);
    expect(list).toHaveLength(1);
  });
});

describe("diffLines", () => {
  it("동일 텍스트는 모두 equal", () => {
    const out = diffLines("a\nb\nc", "a\nb\nc");
    expect(out.every((d) => d.op === "equal")).toBe(true);
    expect(out).toHaveLength(3);
  });

  it("끝에 한 줄 추가", () => {
    const out = diffLines("a\nb", "a\nb\nc");
    const adds = out.filter((d) => d.op === "add");
    const rms = out.filter((d) => d.op === "remove");
    expect(adds.map((d) => d.text)).toEqual(["c"]);
    expect(rms).toHaveLength(0);
  });

  it("중간 한 줄 변경 = remove + add", () => {
    const out = diffLines("a\nb\nc", "a\nB\nc");
    const adds = out.filter((d) => d.op === "add").map((d) => d.text);
    const rms = out.filter((d) => d.op === "remove").map((d) => d.text);
    expect(rms).toContain("b");
    expect(adds).toContain("B");
  });

  it("빈 → 비어있지 않음", () => {
    const out = diffLines("", "x\ny");
    // 한 줄 빈 → 한 줄 빈 (equal '') + 'y' add 또는 'x' add + 'y' add 등 LCS 변형 가능.
    // 핵심: 결과에 add 'x' 와 add 'y' 둘 다 존재.
    const adds = out.filter((d) => d.op === "add").map((d) => d.text);
    expect(adds).toEqual(expect.arrayContaining(["x", "y"]));
  });
});

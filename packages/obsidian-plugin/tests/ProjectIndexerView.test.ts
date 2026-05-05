import { ProjectIndexerView, collectDocuments } from "../src/ProjectIndexerView";
import type { BinderNode } from "@ai-manuscript-studio/core/browser";

describe("collectDocuments", () => {
  it("walks a binder tree and returns all document leaves", () => {
    const tree: BinderNode[] = [
      {
        id: "ch1",
        type: "folder",
        title: "1장",
        label: "chapter",
        status: "first-draft",
        synopsis: "",
        children: [
          {
            id: "ch1-sc1",
            type: "document",
            file: "01/01.md",
            title: "장면 1",
            label: "scene",
            status: "first-draft",
            synopsis: "",
          },
          {
            id: "ch1-sub",
            type: "folder",
            title: "하위",
            label: "chapter",
            status: "first-draft",
            synopsis: "",
            children: [
              {
                id: "ch1-sub-sc1",
                type: "document",
                file: "01/sub/01.md",
                title: "하위 장면",
                label: "scene",
                status: "first-draft",
                synopsis: "",
              },
            ],
          },
        ],
      },
      {
        id: "loose",
        type: "document",
        file: "loose.md",
        title: "단편",
        label: "fragment",
        status: "first-draft",
        synopsis: "",
      },
    ];
    const docs = collectDocuments(tree);
    expect(docs.map((d) => d.id)).toEqual([
      "ch1-sc1",
      "ch1-sub-sc1",
      "loose",
    ]);
  });

  it("returns empty for empty tree", () => {
    expect(collectDocuments([])).toEqual([]);
  });
});

describe("ProjectIndexerView surface", () => {
  it("exports the view-type constant matching the manifest namespace", () => {
    // The view type must be unique across plugins (must NOT collide with
    // zettel-connect or anything else). We assert the prefix.
    // (Loaded lazily to avoid Obsidian import during top-level eval.)
    const { PROJECT_INDEXER_VIEW_TYPE } = require("../src/ProjectIndexerView");
    expect(PROJECT_INDEXER_VIEW_TYPE).toBe("ams-project-indexer");
  });
});

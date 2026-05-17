import { getSelectionPopoverPortalTarget } from "../../src/studio/editor/selectionPopoverPortal";

describe("selection popover portal", () => {
  it("mounts into document.body so fixed viewport coordinates are not offset by Obsidian panes", () => {
    const localDocument = document.implementation.createHTMLDocument("portal");
    const leaf = localDocument.createElement("div");
    leaf.style.position = "relative";
    leaf.style.transform = "translateX(320px)";
    localDocument.body.appendChild(leaf);

    expect(getSelectionPopoverPortalTarget(localDocument)).toBe(
      localDocument.body,
    );
    expect(getSelectionPopoverPortalTarget(localDocument)).not.toBe(leaf);
  });
});

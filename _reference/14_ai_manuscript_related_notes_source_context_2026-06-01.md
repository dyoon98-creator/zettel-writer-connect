*Version: v1.0 (2026-06-01)*

# 14.zettel-writer-connect related_notes source context reference

## Decision

When the active `3.Structure/*.md` import path creates an AI Manuscript Studio project, include parsed `related_notes` in `project.json.sourceNotes` immediately after the structure note.

## Source Evidence

- Obsidian Properties stores note metadata as YAML at the top of the file.
- Obsidian Properties supports list values.
- Obsidian Properties says list values can contain text and internal links.
- Obsidian Properties says internal links in list properties should be quoted.
- Obsidian Tags and Properties both use list-form YAML examples, which matches this repository's `related_notes` parser shape.

Primary sources:
- https://obsidian.md/help/properties
- https://obsidian.md/help/tags

## Local Finding

`parseStructureNote()` already extracts `related_notes` into `relatedNotes`, and `ProjectMetaIO` stores `sourceNotes` as a string array. The missing step was the bridge between those two facts: `createWritingProjectFromHandoff()` only persisted `structureNotePath` plus JSON-handoff `sourceNotes`, so the active-structure-note command dropped structure-note related notes.

## A/B Evidence

Input handoff:

```json
{
  "structureNotePath": "3.Structure/strategy-note.md",
  "relatedNotes": [
    "[[2.Permanent/시장-사이클]]",
    "2.Permanent/risk-premium.md",
    "3.Structure/strategy-note.md"
  ]
}
```

Before:

```json
["3.Structure/strategy-note.md"]
```

After:

```json
[
  "3.Structure/strategy-note.md",
  "[[2.Permanent/시장-사이클]]",
  "2.Permanent/risk-premium.md"
]
```

The structure note remains first, and duplicate references are removed while preserving first occurrence order.

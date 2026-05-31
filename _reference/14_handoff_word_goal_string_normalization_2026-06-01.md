*Version: v1.0 (2026-06-01)*

# Handoff Word Goal String Normalization

## Context

`_index/writing-handoff.json` can be produced by tools or LLM-generated JSON. Some producers serialize numeric fields as strings, for example `"wordGoal": "5000"`. The bridge previously accepted only number-typed `project.wordGoal`, so the created `project.json` silently fell back to `wordGoal: 0`.

## A/B Result

Input handoff:

```json
{
  "structureNote": {
    "path": "3.Structure/string-goal.md",
    "title": "String Goal"
  },
  "project": {
    "title": "String Goal Draft",
    "wordGoal": "5000"
  }
}
```

Before: created `project.json.wordGoal` was `0`.

After: created `project.json.wordGoal` is `5000`.

## Decision

Normalize `project.wordGoal` from either a positive finite number or a positive integer string. Non-positive values, decimals encoded as strings, unsafe integers, and non-numeric strings remain ignored.

## Verification

- RED: targeted `structureBridge.test.ts` failed with `Expected: 5000 / Received: 0`.
- GREEN target: targeted `structureBridge.test.ts`, full obsidian-plugin test suite, and obsidian-plugin build.

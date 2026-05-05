import { StatusMachine } from "../src/project/StatusMachine";
import { ProjectStatus } from "../src/types";

const ALL_STATES: ProjectStatus[] = [
  "idea",
  "planning",
  "outline",
  "researching",
  "drafting",
  "feedback",
  "revising",
  "final",
  "published",
];

// Expected adjacency from the implementation.
const EXPECTED: Record<ProjectStatus, ProjectStatus[]> = {
  idea: ["planning", "researching"],
  planning: ["outline", "researching", "idea"],
  outline: ["researching", "drafting", "planning"],
  researching: ["outline", "drafting", "planning"],
  drafting: ["feedback", "revising", "researching"],
  feedback: ["revising", "drafting"],
  revising: ["final", "feedback", "drafting"],
  final: ["published", "revising"],
  published: ["revising"],
};

describe("StatusMachine", () => {
  it("nextStates returns the expected adjacency for every state", () => {
    for (const s of ALL_STATES) {
      expect(StatusMachine.nextStates(s).sort()).toEqual(
        [...EXPECTED[s]].sort(),
      );
    }
  });

  it("disallows self-transition for every state", () => {
    for (const s of ALL_STATES) {
      expect(StatusMachine.canTransition(s, s)).toBe(false);
    }
  });

  it("9x9 transition table matches expectation", () => {
    for (const from of ALL_STATES) {
      for (const to of ALL_STATES) {
        const expected = from !== to && EXPECTED[from].includes(to);
        expect(StatusMachine.canTransition(from, to)).toBe(expected);
      }
    }
  });

  it("every node is reachable from idea (no orphans forward)", () => {
    const reached = new Set<ProjectStatus>(["idea"]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const s of [...reached]) {
        for (const n of StatusMachine.nextStates(s)) {
          if (!reached.has(n)) {
            reached.add(n);
            changed = true;
          }
        }
      }
    }
    expect(reached.size).toBe(ALL_STATES.length);
  });
});

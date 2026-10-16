import { describe, expect, it } from "vitest";
import {
  analyzeRecovery,
  evaluateFormationTeam,
  generateFormationAlternatives,
} from "../../backend/src/services/teamForgeEngine.js";

const config = {
  minTeamSize: 2,
  maxTeamSize: 2,
  requiredSkills: [
    { name: "React", weight: 2 },
    { name: "Data", weight: 1 },
  ],
  requiredRoles: [],
  requiredWeeklyCapacity: 10,
  objectiveWeights: { skills: 0.6, roles: 0.1, availability: 0.3 },
};

describe("TeamForge formation engine", () => {
  it("weights skill coverage and enforces hard constraints", () => {
    const result = evaluateFormationTeam(config, [
      { id: "a", weeklyCapacity: 5, skills: [{ name: "React", proficiency: "ADVANCED" }] },
      { id: "b", weeklyCapacity: 5, skills: [{ name: "Data", proficiency: "INTERMEDIATE" }] },
    ]);
    expect(result.feasible).toBe(true);
    expect(result.coveredSkills).toEqual(["react", "data"]);
    expect(result.missingSkills).toEqual([]);
  });

  it("produces deterministic distinct alternatives", () => {
    const participants = [
      { id: "a", weeklyCapacity: 5, skills: [{ name: "React", proficiency: "ADVANCED" }] },
      { id: "b", weeklyCapacity: 5, skills: [{ name: "Data", proficiency: "ADVANCED" }] },
      { id: "c", weeklyCapacity: 5, skills: [{ name: "Data", proficiency: "ADVANCED" }] },
    ];
    const first = generateFormationAlternatives(config, participants);
    const second = generateFormationAlternatives(config, participants);
    expect(first).toEqual(second);
    expect(first.map((alternative) => alternative.memberIds)).toEqual([["a", "b"], ["a", "c"]]);
  });
});

describe("TeamForge rescue analysis", () => {
  it("propagates blocked work to downstream tasks", () => {
    const result = analyzeRecovery([
      { id: "a", estimateHours: 4, completedHours: 1, dependencies: [] },
      { id: "b", estimateHours: 3, completedHours: 0, dependencies: ["a"] },
      { id: "c", estimateHours: 2, completedHours: 0, dependencies: ["b"] },
    ], { type: "BLOCKED_TASK", taskId: "a" });
    expect(result.affectedTaskIds).toEqual(["a", "b", "c"]);
    expect(result.remainingEffortHours).toBe(8);
  });

  it("rejects dependency cycles", () => {
    expect(() => analyzeRecovery([
      { id: "a", dependencies: ["b"] },
      { id: "b", dependencies: ["a"] },
    ], {})).toThrow("cycle");
  });
});

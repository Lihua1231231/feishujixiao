import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCopyPlan,
  createPeerReviewPayloadFromSupervisorEval,
  createSupervisorEvalPayloadFromPeerReview,
} from "./copy-lizelong-qiuxiang-evals.ts";

test("copies supervisor eval into peer review payload", () => {
  const payload = createPeerReviewPayloadFromSupervisorEval(
    {
      id: "se1",
      cycleId: "c1",
      evaluatorId: "u1",
      employeeId: "u2",
      status: "SUBMITTED",
      performanceStars: 4,
      performanceComment: "业绩不错",
      abilityStars: 3,
      abilityComment: "能力整体稳",
      comprehensiveStars: 3,
      learningStars: 4,
      adaptabilityStars: 2,
      valuesStars: 4,
      valuesComment: "",
      candidStars: 4,
      candidComment: "坦诚",
      progressStars: 4,
      progressComment: "进取",
      altruismStars: 3,
      altruismComment: "利他",
      rootStars: 5,
      rootComment: "ROOT",
    },
    new Date("2026-03-30T12:00:00.000Z"),
  );

  assert.equal(payload.comprehensiveComment, "能力整体稳");
  assert.equal(payload.learningComment, "能力整体稳");
  assert.equal(payload.adaptabilityComment, "能力整体稳");
  assert.equal(payload.status, "SUBMITTED");
});

test("copies peer review into supervisor eval payload with merged comments and weighted score", () => {
  const payload = createSupervisorEvalPayloadFromPeerReview(
    {
      id: "pr1",
      cycleId: "c1",
      reviewerId: "u1",
      revieweeId: "u2",
      revieweeName: "员工A",
      status: "SUBMITTED",
      performanceStars: 4,
      performanceComment: "业绩评语",
      comprehensiveStars: 5,
      comprehensiveComment: "综合评语",
      learningStars: 4,
      learningComment: "学习评语",
      adaptabilityStars: 3,
      adaptabilityComment: "适应评语",
      abilityComment: "",
      candidStars: 5,
      candidComment: "坦诚评语",
      progressStars: 4,
      progressComment: "进取评语",
      altruismStars: 3,
      altruismComment: "利他评语",
      rootStars: 4,
      rootComment: "ROOT评语",
    },
    new Date("2026-03-30T12:00:00.000Z"),
  );

  assert.equal(payload.abilityStars, 4);
  assert.equal(payload.valuesStars, 4);
  assert.equal(payload.weightedScore, 4);
  assert.match(payload.abilityComment, /综合能力：综合评语/);
  assert.match(payload.valuesComment, /ROOT：ROOT评语/);
});

test("builds mixed plan for 李泽龙 and 邱翔 with missing-source reporting", () => {
  const now = new Date("2026-03-30T12:00:00.000Z");
  const plan = buildCopyPlan({
    cycle: { id: "cycle1", name: "当前周期", status: "SUPERVISOR_EVAL" },
    users: [
      { id: "l", name: "李泽龙", department: "前端", role: "SUPERVISOR", supervisorId: null, supervisor: null },
      { id: "q", name: "邱翔", department: "办公室", role: "ADMIN", supervisorId: null, supervisor: null },
      { id: "a", name: "余一铭", department: "前端", role: "EMPLOYEE", supervisorId: null, supervisor: null },
      { id: "b", name: "曹文跃", department: "前端", role: "EMPLOYEE", supervisorId: null, supervisor: null },
      { id: "c", name: "张东杰", department: "ROOT", role: "SUPERVISOR", supervisorId: null, supervisor: null },
      { id: "d", name: "徐宗泽", department: "ROOT", role: "EMPLOYEE", supervisorId: null, supervisor: null },
      { id: "e", name: "王金淋", department: "前端", role: "EMPLOYEE", supervisorId: null, supervisor: null },
    ],
    allSupervisorEvals: [
      { employeeId: "a", evaluatorId: "l", evaluatorName: "李泽龙", status: "SUBMITTED" },
      { employeeId: "d", evaluatorId: "q", evaluatorName: "邱翔", status: "SUBMITTED" },
    ],
    lizelongSupervisorSources: [
      {
        id: "se1",
        cycleId: "cycle1",
        evaluatorId: "l",
        employeeId: "a",
        status: "SUBMITTED",
        performanceStars: 3,
        performanceComment: "ok",
        abilityStars: 3,
        abilityComment: "能力ok",
        comprehensiveStars: 3,
        learningStars: 3,
        adaptabilityStars: 3,
        valuesStars: 3,
        valuesComment: "",
        candidStars: 3,
        candidComment: "1",
        progressStars: 3,
        progressComment: "2",
        altruismStars: 3,
        altruismComment: "3",
        rootStars: 3,
        rootComment: "4",
      },
    ],
    lizelongPendingPeerTargets: [
      { id: "pr-a", cycleId: "cycle1", reviewerId: "l", revieweeId: "a", revieweeName: "余一铭", status: "DRAFT" },
      { id: "pr-b", cycleId: "cycle1", reviewerId: "l", revieweeId: "b", revieweeName: "曹文跃", status: "DRAFT" },
    ],
    qiuxiangPeerSources: [
      {
        id: "peer-d",
        cycleId: "cycle1",
        reviewerId: "q",
        revieweeId: "e",
        revieweeName: "王金淋",
        status: "SUBMITTED",
        performanceStars: 4,
        performanceComment: "业绩",
        comprehensiveStars: 4,
        comprehensiveComment: "综合",
        learningStars: 4,
        learningComment: "学习",
        adaptabilityStars: 4,
        adaptabilityComment: "适应",
        abilityComment: "",
        candidStars: 4,
        candidComment: "坦诚",
        progressStars: 4,
        progressComment: "进取",
        altruismStars: 4,
        altruismComment: "利他",
        rootStars: 4,
        rootComment: "ROOT",
      },
    ],
    qiuxiangExistingSupervisorEvals: [],
    now,
  });

  assert.equal(plan.lizelong.rowsToUpdate.length, 1);
  assert.equal(plan.lizelong.missingSources.length, 1);
  assert.equal(plan.qiuxiang.rowsToCreate.length, 1);
  assert.equal(plan.qiuxiang.missingSources.length, 1);
  assert.equal(plan.qiuxiang.rowsToCreate[0]?.employeeName, "王金淋");
});

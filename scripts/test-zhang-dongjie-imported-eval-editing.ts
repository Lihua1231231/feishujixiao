import assert from "node:assert/strict";
import test from "node:test";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  SCREENSHOT_IMPORT_PREFIX,
  hasPendingImportedSupervisorEvalComments,
  isScreenshotImportedComment,
} from "../src/lib/supervisor-eval-import.ts";

const WORKTREE_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("detects screenshot-imported placeholder comments", () => {
  const placeholder = `${SCREENSHOT_IMPORT_PREFIX}原始记录仅包含总星级 4 星，详细维度评语待补充。`;

  assert.equal(isScreenshotImportedComment(placeholder), true);
  assert.equal(
    hasPendingImportedSupervisorEvalComments({
      performanceComment: "真实业绩评语",
      abilityComment: "真实能力评语",
      candidComment: placeholder,
      progressComment: "真实进取评语",
      altruismComment: "真实利他评语",
      rootComment: "真实ROOT评语",
    }),
    true,
  );
  assert.equal(
    hasPendingImportedSupervisorEvalComments({
      performanceComment: "真实业绩评语",
      abilityComment: "真实能力评语",
      candidComment: "真实坦诚评语",
      progressComment: "真实进取评语",
      altruismComment: "真实利他评语",
      rootComment: "真实ROOT评语",
    }),
    false,
  );
});

test("supervisor eval route keeps a Zhang Dongjie exception for imported submitted rows", () => {
  const routeSource = fs.readFileSync(
    path.join(WORKTREE_ROOT, "src/app/api/supervisor-eval/route.ts"),
    "utf8",
  );

  assert.match(routeSource, /user\.name === "张东杰"/);
  assert.match(routeSource, /hasPendingImportedSupervisorEvalComments\(myExistingEval\)/);
  assert.match(routeSource, /请先把导入占位评语补成真实内容，再重新提交/);
  assert.match(routeSource, /preserveSubmittedStatus/);
});

test("team page leaves imported submitted rows editable and keeps them in submitted state", () => {
  const pageSource = fs.readFileSync(
    path.join(WORKTREE_ROOT, "src/app/(main)/team/page.tsx"),
    "utf8",
  );

  assert.match(pageSource, /canEditSubmitted/);
  assert.match(pageSource, /系统仍按“已评估”统计/);
  assert.match(pageSource, /补充评语并提交/);
  assert.match(pageSource, /\(Boolean\(isSubmitted\) && !canEditSubmitted\)/);
});

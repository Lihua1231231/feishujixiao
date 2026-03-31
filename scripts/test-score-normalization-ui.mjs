import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function readFirstExisting(relativePaths) {
  let lastError = null;
  for (const relativePath of relativePaths) {
    try {
      return {
        relativePath,
        source: read(relativePath),
      };
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError ?? new Error(`None of the candidate paths exist: ${relativePaths.join(", ")}`);
}

function parseTsx(relativePath) {
  const source = read(relativePath);
  return {
    source,
    file: ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  };
}

function parseTsxCandidates(relativePaths) {
  const { relativePath, source } = readFirstExisting(relativePaths);
  return {
    relativePath,
    source,
    file: ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  };
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function getDefaultExportFunctionLike(file) {
  for (const statement of file.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword) &&
      hasModifier(statement, ts.SyntaxKind.DefaultKeyword)
    ) {
      return statement;
    }

    if (ts.isExportAssignment(statement)) {
      const expression = statement.expression;
      if (ts.isFunctionExpression(expression) || ts.isArrowFunction(expression)) {
        return expression;
      }

      if (ts.isIdentifier(expression)) {
        for (const candidate of file.statements) {
          if (!ts.isVariableStatement(candidate)) continue;
          for (const declaration of candidate.declarationList.declarations) {
            if (
              ts.isIdentifier(declaration.name) &&
              declaration.name.text === expression.text &&
              declaration.initializer &&
              (ts.isFunctionExpression(declaration.initializer) || ts.isArrowFunction(declaration.initializer))
            ) {
              return declaration.initializer;
            }
          }
        }
      }
    }
  }

  return null;
}

function getAnyExportedFunctionLike(file, namePattern = null) {
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      if (!namePattern || (statement.name && namePattern.test(statement.name.text))) {
        return statement;
      }
    }

    if (ts.isVariableStatement(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword)) {
      for (const declaration of statement.declarationList.declarations) {
        if (!ts.isIdentifier(declaration.name) || !declaration.initializer) continue;
        if (namePattern && !namePattern.test(declaration.name.text)) continue;
        if (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer)) {
          return declaration.initializer;
        }
      }
    }
  }

  return null;
}

function getReturnedExpressions(functionLike) {
  if (ts.isArrowFunction(functionLike) && !ts.isBlock(functionLike.body)) {
    return [functionLike.body];
  }

  const body = functionLike.body;
  if (!body || !ts.isBlock(body)) return [];

  const expressions = [];
  const visit = (node) => {
    if (ts.isReturnStatement(node) && node.expression) {
      expressions.push(node.expression);
    }
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(body, visit);
  return expressions;
}

function jsxTagName(node) {
  if (ts.isIdentifier(node)) return node.text;
  if (ts.isPropertyAccessExpression(node)) return node.getText();
  return null;
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").trim();
}

function analyzeReturnedExpressions(expressions) {
  const texts = new Set();
  const tags = new Map();

  const visit = (node) => {
    if (ts.isJsxText(node)) {
      const text = normalizeText(node.getText());
      if (text) texts.add(text);
    }

    if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) {
      const text = normalizeText(node.text);
      if (text) texts.add(text);
    }

    if (ts.isJsxSelfClosingElement(node) || ts.isJsxOpeningElement(node)) {
      const tag = jsxTagName(node.tagName);
      if (tag) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }

    if (ts.isJsxElement(node)) {
      const tag = jsxTagName(node.openingElement.tagName);
      if (tag) tags.set(tag, (tags.get(tag) ?? 0) + 1);
    }

    ts.forEachChild(node, visit);
  };

  for (const expression of expressions) {
    ts.forEachChild(expression, visit);
  }

  return { texts, tags };
}

test("score normalization page wires in the normalization shell component", () => {
  const { file } = parseTsx("src/app/(main)/score-normalization/page.tsx");
  const defaultExport = getDefaultExportFunctionLike(file);
  const source = read("src/app/(main)/score-normalization/page.tsx");

  assert.equal(defaultExport != null, true, "score normalization page should export a default page component");
  assert.equal(source.includes("NormalizationShell"), true, "score normalization page should wire in the normalization shell component");

  const returnExpressions = getReturnedExpressions(defaultExport);
  const analysis = analyzeReturnedExpressions(returnExpressions);

  assert.equal(
    (analysis.tags.get("TabsContent") ?? 0) >= 2,
    true,
    "score normalization page should render both analysis tab panels",
  );
});

test("score normalization page exposes the two required analysis tabs", () => {
  const source = read("src/app/(main)/score-normalization/page.tsx");
  const types = read("src/components/score-normalization/types.ts");

  assert.equal(
    types.includes("360环评分布校准") &&
      types.includes("绩效初评分布校准") &&
      source.includes("SCORE_NORMALIZATION_SOURCE_OPTIONS"),
    true,
    "score normalization page should expose one tab for peer review and one tab for supervisor review",
  );
});

test("score normalization page imports useEffect for workspace loading", () => {
  const source = read("src/app/(main)/score-normalization/page.tsx");

  assert.equal(
    source.includes("useEffect") && source.includes('from "react"'),
    true,
    "the page must import useEffect so the workspace fetch hook can compile",
  );
});

test("score normalization page fetches the workspace by source query param", () => {
  const source = read("src/app/(main)/score-normalization/page.tsx");

  assert.equal(
    source.includes("/api/score-normalization/workspace") &&
      source.includes("source=") &&
      source.includes("PEER_REVIEW") &&
      source.includes("SUPERVISOR_EVAL"),
    true,
    "score normalization page should load the workspace with a source query parameter",
  );
});

test("score normalization page consumes the shared summary, rater-bias, movement, and application-state contract", () => {
  const page = read("src/app/(main)/score-normalization/page.tsx");
  const shell = read("src/components/score-normalization/normalization-shell.tsx");
  const overview = read("src/components/score-normalization/normalization-overview.tsx");
  const biasTable = read("src/components/score-normalization/rater-bias-table.tsx");
  const movementTable = read("src/components/score-normalization/change-preview-table.tsx");
  const applyPanel = read("src/components/score-normalization/apply-panel.tsx");
  const route = read("src/app/api/score-normalization/workspace/route.ts");
  const lib = read("src/lib/score-normalization.ts");

  assert.equal(
    page.includes("summary") &&
      page.includes("raterBiasRows") &&
      page.includes("movementRows") &&
      page.includes("applicationState") &&
      !page.includes("snapshot.entries"),
    true,
    "page should read the shared workspace summary contract instead of inferring everything from raw snapshot entries",
  );
  assert.equal(
    shell.includes("summary") &&
      shell.includes("raterBiasRows") &&
      shell.includes("movementRows") &&
      shell.includes("applicationState") &&
      !shell.includes("snapshot.entries"),
    true,
    "shell should be driven by the shared workspace contract",
  );
  assert.equal(
    overview.includes("currentSourceCount") &&
      overview.includes("abnormalRaterCount") &&
      overview.includes("shiftedPeopleCount") &&
      overview.includes("skewedDepartmentCount") &&
      overview.includes("workspaceState") &&
      overview.includes("rollbackVisible") &&
      !overview.includes("rawCount") &&
      !overview.includes("simulatedCount"),
    true,
    "overview should surface the approved cockpit summary fields",
  );
  assert.equal(
    biasTable.includes("raterBiasRows") &&
      biasTable.includes("averageScore") &&
      biasTable.includes("offset") &&
      biasTable.includes("tendency") &&
      biasTable.includes("raterName") &&
      !biasTable.includes("rawDistribution") &&
      !biasTable.includes("bucketLabel"),
    true,
    "bias table should use rater rows instead of relabeling distribution buckets",
  );
  assert.equal(
    movementTable.includes("movementRows") &&
      movementTable.includes("movementLabel") &&
      movementTable.includes("rankDelta") &&
      movementTable.includes("normalizedBucket") &&
      !movementTable.includes("workspace.snapshot.entries"),
    true,
    "movement table should use dedicated movement rows instead of reading snapshot entries directly",
  );
  assert.equal(
    applyPanel.includes("onApply") &&
      applyPanel.includes("onRevert") &&
      applyPanel.includes("acknowledged") &&
      applyPanel.includes("应用标准化结果") &&
      applyPanel.includes("回退到原始分") &&
      !applyPanel.includes("当前页仅用于分析预览") &&
      !applyPanel.includes("暂不接入实际操作"),
    true,
    "apply panel should be structured around callbacks and intent, not mock copy",
  );
  assert.equal(
    route.includes("summary") &&
      route.includes("raterBiasRows") &&
      route.includes("movementRows") &&
      route.includes("applicationState") &&
      !route.includes("snapshot.entries"),
    true,
    "workspace route should expose the shared contract fields",
  );
  assert.equal(
    lib.includes("buildScoreNormalizationWorkspaceSummary") &&
      lib.includes("buildScoreNormalizationRaterBiasRows") &&
      lib.includes("buildScoreNormalizationMovementRows") &&
      lib.includes("buildScoreNormalizationApplicationState"),
    true,
    "score normalization helpers should compute the shared contract",
  );
});

test("score normalization shell composes the overview, diff, rater-bias, change-preview, and apply-panel blocks", () => {
  const { file } = parseTsxCandidates([
    "src/components/score-normalization/normalization-shell.tsx",
    "src/components/score-normalization/score-normalization-shell.tsx",
    "src/components/score-normalization/shell.tsx",
  ]);
  const defaultExport = getAnyExportedFunctionLike(file, /NormalizationShell/i);
  const source = read("src/components/score-normalization/normalization-shell.tsx");

  assert.equal(defaultExport != null, true, "score normalization shell should export a component");

  const requiredPatterns = [
    { text: "NormalizationOverview", label: "overview block" },
    { text: "DistributionDiffChart", label: "diff block" },
    { text: "RaterBiasTable", label: "rater-bias block" },
    { text: "ChangePreviewTable", label: "change-preview block" },
    { text: "ApplyPanel", label: "apply-panel block" },
  ];

  for (const { text, label } of requiredPatterns) {
    assert.equal(
      source.includes(text),
      true,
      `score normalization shell should render the ${label}`,
    );
  }
});

test("score normalization apply panel includes double-confirm apply and rollback copy", () => {
  const { file } = parseTsx("src/components/score-normalization/apply-panel.tsx");
  const defaultExport = getAnyExportedFunctionLike(file, /ApplyPanel/i);

  assert.equal(defaultExport != null, true, "apply panel should export a component");

  const returnExpressions = getReturnedExpressions(defaultExport);
  const analysis = analyzeReturnedExpressions(returnExpressions);

  assert.equal(
    analysis.texts.has("我已理解这会影响排名和后续校准展示"),
    true,
    "apply panel should require the double-confirm acknowledgment copy",
  );
  assert.equal(analysis.texts.has("应用标准化结果"), true, "apply panel should use the apply wording for normalized results");
  assert.equal(analysis.texts.has("回退到原始分"), true, "apply panel should expose the rollback wording back to raw scores");
});

test("score normalization nav entry is present for authorized users", () => {
  const source = read("src/components/nav.tsx");

  assert.equal(
    source.includes("分布校准分析") && source.includes("/score-normalization"),
    true,
    "nav should expose a score normalization analysis entry",
  );
});

test("score normalization tables keep every row accessible through per-row expansion instead of truncating after twelve rows", () => {
  const movementTable = read("src/components/score-normalization/change-preview-table.tsx");
  const biasTable = read("src/components/score-normalization/rater-bias-table.tsx");

  assert.equal(
    movementTable.includes("slice(0, 12)"),
    false,
    "change preview should no longer truncate rows to the first twelve entries",
  );
  assert.equal(
    movementTable.includes("还有 {extraCount} 条变化明细未展开"),
    false,
    "change preview should not hide the remaining movement rows behind a summary line",
  );
  assert.equal(
    movementTable.includes("展开详情") || movementTable.includes("收起详情"),
    true,
    "change preview should expose a per-row expand/collapse control",
  );

  assert.equal(
    biasTable.includes("slice(0, 12)"),
    false,
    "rater bias table should no longer truncate rows to the first twelve raters",
  );
  assert.equal(
    biasTable.includes("还有 {extraCount} 位评分人未展开"),
    false,
    "rater bias table should not hide the remaining raters behind a summary line",
  );
  assert.equal(
    biasTable.includes("展开详情") || biasTable.includes("收起详情"),
    true,
    "rater bias table should expose a per-rater expand/collapse control",
  );
});

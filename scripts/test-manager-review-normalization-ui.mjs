import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function parseTsx(relativePath) {
  const source = read(relativePath);
  return {
    source,
    file: ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  };
}

function readFirstExisting(relativePaths) {
  for (const relativePath of relativePaths) {
    const fullPath = path.join(rootDir, relativePath);
    if (fs.existsSync(fullPath)) {
      return {
        relativePath,
        source: read(relativePath),
      };
    }
  }
  return null;
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

test("manager review normalization page is performance-review only and wires in the normalization shell", () => {
  const pagePath = path.join(rootDir, "src/app/(main)/manager-review-normalization/page.tsx");
  assert.equal(fs.existsSync(pagePath), true, "manager-review normalization page should exist");
  if (!fs.existsSync(pagePath)) return;

  const { file, source } = parseTsx("src/app/(main)/manager-review-normalization/page.tsx");
  const defaultExport = getDefaultExportFunctionLike(file);

  assert.equal(defaultExport != null, true, "manager-review normalization page should export a default page component");
  assert.equal(
    source.includes('from "@/components/manager-review-normalization/normalization-shell"') ||
      source.includes('from "@/components/manager-review-normalization/manager-review-normalization-shell"'),
    true,
    "manager-review normalization page should delegate composition to a dedicated shell component",
  );
  if (!defaultExport) return;

  const analysis = analyzeReturnedExpressions(getReturnedExpressions(defaultExport));

  assert.equal(
    analysis.texts.has("绩效初评分布校准"),
    true,
    "manager-review page should expose the performance-review normalization workspace",
  );
  assert.equal(
    analysis.texts.has("360环评分布校准"),
    false,
    "manager-review page must not surface the 360 normalization label",
  );
  assert.equal(
    analysis.tags.has("NormalizationShell") || analysis.tags.has("ManagerReviewNormalizationShell"),
    true,
    "manager-review page should render the normalization shell instead of inlining the workspace",
  );
  assert.equal(
    source.includes("/api/manager-review-normalization/workspace"),
    true,
    "manager-review page should load real workspace data instead of mock data",
  );
  assert.equal(
    source.includes("mock-workspace"),
    false,
    "manager-review page should no longer rely on a mock workspace payload",
  );
});

test("manager review normalization shell composes the overview, diff, rater-bias, change-preview, and apply-panel blocks", () => {
  const shellCandidate = readFirstExisting([
    "src/components/manager-review-normalization/normalization-shell.tsx",
    "src/components/manager-review-normalization/manager-review-normalization-shell.tsx",
  ]);
  assert.equal(shellCandidate != null, true, "manager-review normalization shell should exist");
  if (!shellCandidate) return;

  const { file, source } = parseTsx(shellCandidate.relativePath);
  const defaultExport = getAnyExportedFunctionLike(file, /NormalizationShell/i);

  assert.equal(defaultExport != null, true, "manager-review normalization shell should export a component");
  assert.equal(
    source.includes("NormalizationOverview") &&
      source.includes("DistributionDiffChart") &&
      source.includes("RaterBiasTable") &&
      source.includes("ChangePreviewTable") &&
      source.includes("ApplyPanel"),
    true,
    "manager-review normalization shell should wire in the shared workspace building blocks",
  );
  assert.equal(
    source.includes("rawDistribution") &&
      source.includes("reviewerNormalizedDistribution") &&
      source.includes("departmentNormalizedDistribution") &&
      source.includes("application"),
    true,
    "manager-review normalization shell should pass through the raw, reviewer-normalized, department-normalized, and application payload sections",
  );
});

test("manager review normalization shell wiring includes real apply and revert actions", () => {
  const shellCandidate = readFirstExisting([
    "src/components/manager-review-normalization/normalization-shell.tsx",
    "src/components/manager-review-normalization/manager-review-normalization-shell.tsx",
  ]);
  assert.equal(shellCandidate != null, true, "manager-review normalization shell should exist");
  if (!shellCandidate) return;

  const { source } = shellCandidate;
  assert.equal(
    source.includes("onApply") && source.includes("onRevert"),
    true,
    "manager-review normalization shell should accept apply and revert callbacks",
  );
  assert.equal(
    source.includes("ApplyPanel"),
    true,
    "manager-review normalization shell should render the apply panel",
  );
});

test("score-normalization route or navigation points users to the manager-review normalization page", () => {
  const scoreNormalizationSource = read("src/app/(main)/score-normalization/page.tsx");
  const navSource = read("src/components/nav.tsx");

  const routeRedirectsOrUsesManagerReview =
    scoreNormalizationSource.includes("/manager-review-normalization") ||
    scoreNormalizationSource.includes('title="绩效初评分布校准"') ||
    scoreNormalizationSource.includes("redirect(");

  assert.equal(
    routeRedirectsOrUsesManagerReview,
    true,
    "score-normalization page should redirect to or render the manager-review normalization workspace",
  );
  assert.equal(
    navSource.includes("/manager-review-normalization") || navSource.includes("/score-normalization"),
    true,
    "navigation should keep a visible entry point to the normalization page",
  );
});

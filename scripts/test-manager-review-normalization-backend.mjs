import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import * as ts from "typescript";

const rootDir = path.resolve(import.meta.dirname, "..");

function read(relativePath) {
  return fs.readFileSync(path.join(rootDir, relativePath), "utf8");
}

function parseTs(relativePath) {
  const source = read(relativePath);
  return {
    source,
    file: ts.createSourceFile(relativePath, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS),
  };
}

function hasModifier(node, kind) {
  return node.modifiers?.some((modifier) => modifier.kind === kind) ?? false;
}

function getExportedFunction(file, name) {
  for (const statement of file.statements) {
    if (
      ts.isFunctionDeclaration(statement) &&
      statement.name?.text === name &&
      hasModifier(statement, ts.SyntaxKind.ExportKeyword)
    ) {
      return statement;
    }
  }
  return null;
}

function getExportedCallableNames(file) {
  const names = [];
  for (const statement of file.statements) {
    if (ts.isFunctionDeclaration(statement) && hasModifier(statement, ts.SyntaxKind.ExportKeyword) && statement.name) {
      names.push(statement.name.text);
      continue;
    }

    if (!ts.isVariableStatement(statement) || !hasModifier(statement, ts.SyntaxKind.ExportKeyword)) continue;
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.initializer &&
        (ts.isArrowFunction(declaration.initializer) || ts.isFunctionExpression(declaration.initializer))
      ) {
        names.push(declaration.name.text);
      }
    }
  }
  return names;
}

function getTypeAliasUnionLiterals(file, name) {
  for (const statement of file.statements) {
    if (!ts.isTypeAliasDeclaration(statement) || statement.name.text !== name) continue;
    if (!ts.isUnionTypeNode(statement.type)) return [];
    return statement.type.types
      .map((typeNode) =>
        ts.isLiteralTypeNode(typeNode) && ts.isStringLiteral(typeNode.literal) ? typeNode.literal.text : null,
      )
      .filter((value) => value != null);
  }
  return [];
}

function getImportedLocalNames(file, modulePrefix) {
  const names = [];
  for (const statement of file.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)) continue;
    if (!statement.moduleSpecifier.text.startsWith(modulePrefix) || !statement.importClause) continue;
    const { importClause } = statement;
    if (importClause.name) names.push(importClause.name.text);
    const bindings = importClause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        names.push(element.name.text);
      }
    } else if (bindings && ts.isNamespaceImport(bindings)) {
      names.push(bindings.name.text);
    }
  }
  return names;
}

function getCalleeName(expression) {
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isPropertyAccessExpression(expression)) return expression.name.text;
  return null;
}

function unwrapExpression(expression) {
  let current = expression;
  while (
    current &&
    (ts.isParenthesizedExpression(current) ||
      ts.isAwaitExpression(current) ||
      ts.isAsExpression(current) ||
      ts.isNonNullExpression(current) ||
      ts.isTypeAssertionExpression(current))
  ) {
    current = current.expression;
  }
  return current ?? null;
}

function walkFunctionBody(functionLike, visitor) {
  const body = functionLike.body;
  if (!body || !ts.isBlock(body)) return;

  const visit = (node) => {
    if (ts.isFunctionDeclaration(node) || ts.isFunctionExpression(node) || ts.isArrowFunction(node)) {
      return;
    }
    visitor(node);
    ts.forEachChild(node, visit);
  };

  ts.forEachChild(body, visit);
}

function hasCallToImportedHelper(functionLike, importedNames) {
  let found = false;
  walkFunctionBody(functionLike, (node) => {
    if (found) return;
    if (!ts.isCallExpression(node)) return;
    const calleeName = getCalleeName(node.expression);
    if (calleeName && importedNames.has(calleeName)) {
      found = true;
    }
  });
  return found;
}

function parsePrismaModels(source) {
  const models = new Map();
  const lines = source
    .split(/\r?\n/)
    .map((line) => line.replace(/\/\/.*$/, ""));

  let current = null;
  let depth = 0;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!current) {
      const match = line.match(/^model\s+(\w+)\s+\{$/);
      if (!match) continue;
      current = { name: match[1], fields: new Map(), attributes: [] };
      depth = 1;
      continue;
    }

    depth += (rawLine.match(/\{/g) ?? []).length;
    depth -= (rawLine.match(/\}/g) ?? []).length;

    if (depth === 0) {
      models.set(current.name, current);
      current = null;
      continue;
    }

    if (!line) continue;
    if (line.startsWith("@@")) {
      current.attributes.push(line);
      continue;
    }
    if (line.startsWith("@")) continue;

    const fieldMatch = line.match(/^(\w+)\s+([^\s]+)\s*(.*)$/);
    if (fieldMatch) {
      current.fields.set(fieldMatch[1], {
        type: fieldMatch[2],
        attrs: fieldMatch[3].trim(),
      });
    }
  }

  return models;
}

function getModel(models, name) {
  const model = models.get(name);
  assert.equal(model != null, true, `schema should define ${name}`);
  return model;
}

function getField(model, name) {
  const field = model.fields.get(name);
  assert.equal(field != null, true, `${model.name} should define field ${name}`);
  return field;
}

function hasRelationReference(attrs, fieldName, referencedName) {
  const normalized = attrs.replace(/\s+/g, " ");
  return normalized.includes(`fields: [${fieldName}]`) && normalized.includes(`references: [${referencedName}]`);
}

function hasCompositeRelation(attrs, fieldNames, referencedNames) {
  const normalized = attrs.replace(/\s+/g, " ");
  return normalized.includes(`fields: [${fieldNames.join(", ")}]`) && normalized.includes(`references: [${referencedNames.join(", ")}]`);
}

function hasUniqueConstraint(model, fields) {
  const normalized = fields.join(",");
  return (model.attributes ?? []).some((attribute) => attribute.replace(/\s+/g, "").includes(`@@unique([${normalized}])`));
}

function isNextResponseJsonCall(node) {
  return (
    ts.isCallExpression(node) &&
    ts.isPropertyAccessExpression(node.expression) &&
    node.expression.expression.getText() === "NextResponse" &&
    node.expression.name.text === "json"
  );
}

function getNextResponseJsonObjectLiteral(functionLike) {
  let objectLiteral = null;
  walkFunctionBody(functionLike, (node) => {
    if (objectLiteral || !isNextResponseJsonCall(node)) return;
    const payload = unwrapExpression(node.arguments[0]);
    if (payload && ts.isObjectLiteralExpression(payload)) {
      objectLiteral = payload;
    }
  });
  return objectLiteral;
}

function getObjectLiteralPropertyNames(objectLiteral) {
  const names = [];
  for (const property of objectLiteral.properties) {
    if (ts.isShorthandPropertyAssignment(property)) {
      names.push(property.name.text);
    } else if (ts.isPropertyAssignment(property) && ts.isIdentifier(property.name)) {
      names.push(property.name.text);
    }
  }
  return names;
}

test("manager review normalization helper library is source-only and exposes layered workspace helpers", () => {
  const helperPath = path.join(rootDir, "src/lib/manager-review-normalization.ts");
  assert.equal(fs.existsSync(helperPath), true, "manager-review normalization should expose a dedicated helper library");
  if (!fs.existsSync(helperPath)) return;

  const { file } = parseTs("src/lib/manager-review-normalization.ts");
  const exportedNames = getExportedCallableNames(file);

  assert.deepEqual(
    getTypeAliasUnionLiterals(file, "ManagerReviewNormalizationSource"),
    ["SUPERVISOR_EVAL"],
    "manager-review normalization should only target the performance-review source, not 360",
  );
  assert.equal(
    exportedNames.some((name) => /workspace|builder|payload/i.test(name)),
    true,
    "manager-review normalization should expose a workspace builder or payload helper",
  );
  assert.equal(
    exportedNames.some((name) => /simulate/i.test(name)),
    true,
    "manager-review normalization should expose a simulation helper",
  );
  assert.equal(
    exportedNames.some((name) => /apply/i.test(name)),
    true,
    "manager-review normalization should expose an apply helper",
  );
  assert.equal(
    exportedNames.some((name) => /revert/i.test(name)),
    true,
    "manager-review normalization should expose a revert helper",
  );
  assert.equal(
    exportedNames.some((name) => /raw/i.test(name)) &&
      exportedNames.some((name) => /reviewer/i.test(name)) &&
      exportedNames.some((name) => /department/i.test(name)),
    true,
    "manager-review normalization helpers should name the raw, reviewer-normalized, and department-normalized layers explicitly",
  );
});

test("manager review normalization schema keeps a separate snapshot layer and one application row per cycle and source", () => {
  const models = parsePrismaModels(read("prisma/schema.prisma"));

  const snapshot = getModel(models, "ManagerReviewNormalizationSnapshot");
  assert.equal(
    getField(snapshot, "cycleId").type,
    "String",
    "snapshot layer should be anchored to the review cycle",
  );
  assert.equal(
    getField(snapshot, "cycle").type,
    "ReviewCycle",
    "snapshot layer should relate back to the review cycle",
  );
  assert.equal(
    hasRelationReference(getField(snapshot, "cycle").attrs, "cycleId", "id"),
    true,
    "snapshot layer should use a real foreign-key relation back to the cycle",
  );
  assert.equal(
    getField(snapshot, "entries").type,
    "ManagerReviewNormalizationEntry[]",
    "snapshot layer should own the per-entry normalization records",
  );

  const entry = getModel(models, "ManagerReviewNormalizationEntry");
  assert.equal(
    getField(entry, "snapshotId").type,
    "String",
    "entry rows should belong to one normalization snapshot",
  );
  assert.equal(
    getField(entry, "snapshot").type,
    "ManagerReviewNormalizationSnapshot",
    "entry rows should relate back to the snapshot layer",
  );
  assert.equal(
    hasRelationReference(getField(entry, "snapshot").attrs, "snapshotId", "id"),
    true,
    "entry rows should use a foreign-key relation to the snapshot layer",
  );

  const application = getModel(models, "ManagerReviewNormalizationApplication");
  assert.equal(
    getField(application, "cycleId").type,
    "String",
    "application rows should be keyed by cycle",
  );
  assert.equal(
    getField(application, "source").type,
    "String",
    "application rows should be keyed by source as well as cycle",
  );
  assert.equal(
    getField(application, "snapshotId").type,
    "String",
    "application rows should point at one applied snapshot",
  );
  assert.equal(
    getField(application, "snapshot").type,
    "ManagerReviewNormalizationSnapshot",
    "application rows should relate back to the normalized snapshot layer",
  );
  assert.equal(
    hasCompositeRelation(
      getField(application, "snapshot").attrs,
      ["snapshotId", "cycleId", "source"],
      ["id", "cycleId", "source"],
    ),
    true,
    "application rows should use a cycle/source-bound foreign-key relation to the applied snapshot",
  );
  assert.equal(
    hasUniqueConstraint(application, ["cycleId", "source"]),
    true,
    "application rows should stay one-per-cycle-and-source via a unique invariant",
  );
});

test("manager review normalization workspace route returns raw, reviewer-normalized, and department-normalized layers from a dedicated builder", () => {
  const routePath = path.join(rootDir, "src/app/api/manager-review-normalization/workspace/route.ts");
  assert.equal(fs.existsSync(routePath), true, "manager-review workspace route should exist");
  if (!fs.existsSync(routePath)) return;

  const { file } = parseTs("src/app/api/manager-review-normalization/workspace/route.ts");
  const getHandler = getExportedFunction(file, "GET");

  assert.equal(getHandler != null, true, "workspace route should export a GET handler");
  if (!getHandler) return;

  const importedNames = new Set(getImportedLocalNames(file, "@/lib/manager-review-normalization"));
  assert.equal(
    importedNames.size > 0,
    true,
    "workspace route should import a dedicated manager-review normalization helper",
  );
  assert.equal(
    hasCallToImportedHelper(getHandler, importedNames),
    true,
    "workspace route should call a dedicated normalization builder helper instead of hand-building JSON",
  );

  const jsonObject = getNextResponseJsonObjectLiteral(getHandler);
  assert.equal(
    jsonObject != null,
    true,
    "workspace route should build its response with NextResponse.json",
  );
  if (!jsonObject) return;

  const propertyNames = new Set(getObjectLiteralPropertyNames(jsonObject));
  assert.equal(
    propertyNames.has("rawDistribution") &&
      propertyNames.has("reviewerNormalizedDistribution") &&
      propertyNames.has("departmentNormalizedDistribution") &&
      propertyNames.has("application"),
    true,
    "workspace payload should expose raw, reviewer-normalized, department-normalized, and application sections together",
  );
  assert.equal(
    read("src/app/api/manager-review-normalization/workspace/route.ts").includes("PEER_REVIEW"),
    false,
    "manager-review workspace should not reintroduce the 360 peer-review source",
  );
});

test("manager review normalization apply and revert routes exist and call the dedicated layer helpers", () => {
  const applyPath = path.join(rootDir, "src/app/api/manager-review-normalization/apply/route.ts");
  const revertPath = path.join(rootDir, "src/app/api/manager-review-normalization/revert/route.ts");
  assert.equal(fs.existsSync(applyPath), true, "manager-review apply route should exist");
  assert.equal(fs.existsSync(revertPath), true, "manager-review revert route should exist");
  if (!fs.existsSync(applyPath) || !fs.existsSync(revertPath)) return;

  const apply = parseTs("src/app/api/manager-review-normalization/apply/route.ts");
  const revert = parseTs("src/app/api/manager-review-normalization/revert/route.ts");
  const applyPost = getExportedFunction(apply.file, "POST");
  const revertPost = getExportedFunction(revert.file, "POST");

  assert.equal(applyPost != null, true, "apply route should export a POST handler");
  assert.equal(revertPost != null, true, "revert route should export a POST handler");
  if (!applyPost || !revertPost) return;

  const applyImports = new Set(getImportedLocalNames(apply.file, "@/lib/manager-review-normalization"));
  const revertImports = new Set(getImportedLocalNames(revert.file, "@/lib/manager-review-normalization"));

  assert.equal(
    hasCallToImportedHelper(applyPost, applyImports),
    true,
    "apply route should call the manager-review normalization apply helper",
  );
  assert.equal(
    hasCallToImportedHelper(revertPost, revertImports),
    true,
    "revert route should call the manager-review normalization revert helper",
  );
  assert.equal(
    read("src/app/api/manager-review-normalization/apply/route.ts").includes("PEER_REVIEW"),
    false,
    "manager-review apply route must not reintroduce the 360 source",
  );
  assert.equal(
    read("src/app/api/manager-review-normalization/revert/route.ts").includes("PEER_REVIEW"),
    false,
    "manager-review revert route must not reintroduce the 360 source",
  );
});

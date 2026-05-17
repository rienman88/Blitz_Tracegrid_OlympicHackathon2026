import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..", "..");

const [repoPath, relPath] = process.argv.slice(2);

if (!repoPath || !relPath) {
  console.error("Usage: node ts_ast_extractor.mjs <repoPath> <relativeFile>");
  process.exit(2);
}

const ts = loadTypeScript();
const fullPath = path.resolve(repoPath, relPath);
const source = fs.readFileSync(fullPath, "utf8");
const sourceFile = ts.createSourceFile(
  fullPath,
  source,
  ts.ScriptTarget.Latest,
  true,
  scriptKindFor(fullPath)
);

const records = [];
const seen = new Set();

visit(sourceFile);

process.stdout.write(JSON.stringify({ records }));

function loadTypeScript() {
  const candidates = [
    "typescript",
    path.join(projectRoot, "backend", "node_modules", "typescript"),
    path.join(projectRoot, "frontend", "node_modules", "typescript")
  ];

  for (const candidate of candidates) {
    try {
      return require(candidate);
    } catch {
      // Try the next local runtime.
    }
  }

  console.error("typescript package is not available to the AST bridge");
  process.exit(2);
}

function scriptKindFor(file) {
  if (file.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (file.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (file.endsWith(".ts")) return ts.ScriptKind.TS;
  return ts.ScriptKind.JS;
}

function visit(node) {
  if (ts.isImportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
    addRecord({
      type: "import",
      label: node.moduleSpecifier.text,
      layer: "Dependency",
      line: lineOf(node),
      detector: "typescript.ast.ImportDeclaration",
      confidence: 0.94,
      edge_label: "imports",
      edge_type: "dependency",
      risk: "none",
      description: `TypeScript import dependency detected: ${node.moduleSpecifier.text}.`
    });
  }

  if (ts.isFunctionDeclaration(node) && node.name) {
    const functionName = node.name.text;
    const isRoute = isHttpMethod(functionName);
    addRecord({
      type: isRoute ? "api" : "function",
      label: isRoute ? `Next route ${functionName}` : functionName,
      layer: isRoute ? "API" : (looksComponent(functionName) ? "UI" : "Frontend"),
      line: lineOf(node),
      detector: isRoute ? "typescript.ast.NextRoute" : "typescript.ast.FunctionDeclaration",
      confidence: isRoute ? 0.86 : 0.9,
      edge_label: isRoute ? "handles" : "declares",
      edge_type: isRoute ? "api" : "structural",
      risk: riskFromLabel(functionName),
      description: isRoute
        ? `Next.js route handler detected: ${functionName}.`
        : `TypeScript function/component detected: ${functionName}.`
    });
  }

  if (ts.isVariableStatement(node)) {
    for (const declaration of node.declarationList.declarations) {
      const name = declaration.name && declaration.name.getText(sourceFile);
      const initializer = declaration.initializer;
      if (!name || !initializer) continue;

      if (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer)) {
        addRecord({
          type: "function",
          label: name,
          layer: looksComponent(name) ? "UI" : "Frontend",
          line: lineOf(declaration),
          detector: "typescript.ast.VariableFunction",
          confidence: 0.86,
          edge_label: "declares",
          edge_type: "structural",
          risk: riskFromLabel(name),
          description: `TypeScript arrow/function expression detected: ${name}.`
        });
      }
    }
  }

  if (ts.isJsxAttribute(node) && node.name && node.name.text === "onClick") {
    addRecord({
      type: "event",
      label: "Click event",
      layer: "UI",
      line: lineOf(node),
      detector: "typescript.ast.JsxAttribute.onClick",
      confidence: 0.92,
      edge_label: "declares",
      edge_type: "causal",
      risk: "low",
      description: "JSX onClick handler detected."
    });
  }

  if (ts.isCallExpression(node)) {
    inspectCallExpression(node);
  }

  ts.forEachChild(node, visit);
}

function inspectCallExpression(node) {
  const expression = node.expression.getText(sourceFile);
  const firstArg = node.arguments?.[0];

  if (isExpressRouteCall(expression) && firstArg && ts.isStringLiteralLike(firstArg)) {
    const method = expression.split(".").pop().toUpperCase();
    addRecord({
      type: "api",
      label: `${method} ${firstArg.text}`,
      layer: "API",
      line: lineOf(node),
      detector: "typescript.ast.RouteCallExpression",
      confidence: 0.9,
      edge_label: "declares",
      edge_type: "api",
      risk: method === "GET" ? "low" : "medium",
      description: `Route registration detected: ${method} ${firstArg.text}.`
    });
  }

  if (/^(fetch|axios\.|http\.|https\.)/.test(expression)) {
    addRecord({
      type: "api",
      label: expression,
      layer: "API",
      line: lineOf(node),
      detector: "typescript.ast.NetworkCall",
      confidence: 0.88,
      edge_label: "calls",
      edge_type: "network",
      risk: "medium",
      description: `Network/API call detected: ${expression}.`
    });
  }

  if (/prisma\.|sequelize\.|mongoose\.|\.query$|execute$|sql$/i.test(expression)) {
    addRecord({
      type: "db",
      label: expression,
      layer: "Database",
      line: lineOf(node),
      detector: "typescript.ast.DatabaseCall",
      confidence: 0.82,
      edge_label: "reads/writes",
      edge_type: "data",
      risk: "medium",
      description: `Database/data access call detected: ${expression}.`
    });
  }

  if (/auth|token|session|jwt|middleware/i.test(expression)) {
    addRecord({
      type: "middleware",
      label: expression,
      layer: "Security",
      line: lineOf(node),
      detector: "typescript.ast.AuthCall",
      confidence: 0.78,
      edge_label: "guards",
      edge_type: "security",
      risk: "medium",
      description: `Authentication/security call detected: ${expression}.`
    });
  }
}

function addRecord(record) {
  const key = `${record.type}:${record.label}:${record.line}:${record.detector}`;
  if (seen.has(key)) return;
  seen.add(key);
  records.push(record);
}

function lineOf(node) {
  return sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile)).line + 1;
}

function isHttpMethod(name) {
  return ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"].includes(name);
}

function isExpressRouteCall(expression) {
  return /(?:app|router)\.(get|post|put|patch|delete|options)$/i.test(expression);
}

function looksComponent(name) {
  return Boolean(name && /^[A-Z]/.test(name));
}

function riskFromLabel(label) {
  return /auth|token|session|jwt|password|secret|login|middleware/i.test(label) ? "medium" : "none";
}

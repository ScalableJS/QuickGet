import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";
import { parse } from "svelte/compiler";

export function scanSource(path, text) {
  const scope = /\.(test|spec)\.|^tests\//.test(path)
    ? "tests"
    : /\.stories\.|\/gallery\/|\/showcase\/|^\.storybook\//.test(path)
      ? "harness"
      : path.startsWith("src/")
        ? "runtime"
        : "tooling";
  const functions = [];
  const risks = [];
  const seen = new Set();
  const lineAt = (position) => text.slice(0, position).split("\n").length;
  const recordRisk = (kind, node, source, offset) => {
    risks.push({
      kind,
      path,
      line: lineAt(node.getStart(source) + offset),
      scope,
      text: node.getText(source).slice(0, 180),
    });
  };
  const scan = (code, offset = 0) => {
    const source = ts.createSourceFile(
      path.endsWith(".svelte") ? `${path}.ts` : path,
      code,
      ts.ScriptTarget.Latest,
      true,
    );
    if (source.parseDiagnostics.length)
      throw new Error(`${path}: ${ts.flattenDiagnosticMessageText(source.parseDiagnostics[0].messageText, " ")}`);
    const visit = (node) => {
      if (node.kind === ts.SyntaxKind.AnyKeyword) recordRisk("explicit-any", node, source, offset);
      if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node)) {
        recordRisk(
          node.type.kind === ts.SyntaxKind.ConstKeyword || node.type.getText(source) === "const"
            ? "const-assertion"
            : "type-assertion",
          node,
          source,
          offset,
        );
        if (ts.isAsExpression(node.expression) || ts.isTypeAssertionExpression(node.expression))
          recordRisk("double-assertion", node, source, offset);
      }
      if (ts.isNonNullExpression(node)) recordRisk("non-null-assertion", node, source, offset);
      if (ts.isFunctionLike(node) && node.body) {
        const start = node.getStart(source) + offset;
        if (!seen.has(start)) {
          seen.add(start);
          let name = node.name?.getText(source);
          if (!name && ts.isVariableDeclaration(node.parent))
            name = offset ? "template-callback" : node.parent.name.getText(source);
          if (!name && ts.isPropertyAssignment(node.parent)) name = node.parent.name.getText(source);
          if (!name && ts.isCallExpression(node.parent))
            name = `callback:${calleeName(node.parent.expression, source)}`;
          const tokens = tokenize(node.body, source);
          functions.push({
            id: `${path}:${lineAt(start)}:${start}`,
            path,
            line: lineAt(start),
            endLine: lineAt(node.end + offset),
            name: (name ?? "anonymous").replace(/\s+/g, " "),
            kind: ts.SyntaxKind[node.kind],
            scope,
            tokens: tokens.length,
            exact: hash(tokens.join(" ")),
            shape: hash(normalize(tokens).join(" ")),
            screening: "automated-screened",
            manualReview: "not-reviewed",
            groups: [],
          });
        }
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  };
  if (path.endsWith(".svelte")) {
    const ast = parse(text, { modern: true });
    const ranges = [ast.instance?.content, ast.module?.content].filter(Boolean);
    scan(mask(text, ranges));
    const walk = (node) => {
      if (!node || typeof node !== "object") return;
      if (node === ast.instance || node === ast.module) return;
      if (["ArrowFunctionExpression", "FunctionExpression"].includes(node.type)) {
        const prefix = "const qgInline = ";
        scan(prefix + text.slice(node.start, node.end), node.start - prefix.length);
        return;
      }
      if (node.type === "SnippetBlock") {
        functions.push({
          id: `${path}:${lineAt(node.start)}:${node.start}`,
          path,
          line: lineAt(node.start),
          endLine: lineAt(node.end),
          name: node.expression.name,
          kind: "SvelteSnippet",
          scope,
          tokens: 0,
          screening: "inventoried-template",
          manualReview: "not-reviewed",
          groups: [],
        });
      }
      for (const [key, value] of Object.entries(node)) {
        if (["parent", "metadata"].includes(key)) continue;
        if (Array.isArray(value)) value.forEach(walk);
        else if (value && typeof value === "object") walk(value);
      }
    };
    walk(ast);
  } else if (path.endsWith(".html")) {
    const ranges = [...text.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script\s*>/gi)].map((match) => ({
      start: match.index + match[0].indexOf(">") + 1,
      end: match.index + match[0].lastIndexOf("</"),
    }));
    scan(mask(text, ranges));
  } else scan(text);
  for (const match of text.matchAll(/@ts-(ignore|nocheck|expect-error)\b|biome-ignore[^\n]*/g))
    risks.push({ kind: "suppression", path, line: lineAt(match.index), scope, text: match[0] });
  return { path, scope, hash: hash(text), functions, risks };
}

export function collectGroups(functions) {
  const groups = [];
  for (const mode of ["exact", "shape"]) {
    const buckets = new Map();
    for (const fn of functions.filter((f) => f.tokens >= 40)) {
      const key = fn[mode];
      const bucket = buckets.get(key) ?? [];
      bucket.push(fn);
      buckets.set(key, bucket);
    }
    for (const [fingerprint, members] of buckets) {
      if (members.length < 2) continue;
      const id = `${mode}-${fingerprint.slice(0, 12)}`;
      groups.push({ id, mode, status: "candidate-not-semantic-proof", members: members.map((m) => m.id) });
      for (const member of members) member.groups.push(id);
    }
  }
  return groups;
}

function main() {
  const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const paths = [
    ...new Set(
      execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
        cwd: root,
        encoding: "utf8",
      }).split("\0"),
    ),
  ]
    .filter(
      (path) =>
        /\.(ts|js|mjs|svelte|html)$/.test(path) &&
        !/\.d\.ts$/.test(path) &&
        /^(src\/|scripts\/|tests\/|\.storybook\/)|^[^/]+\.(ts|js|mjs)$/.test(path),
    )
    .sort();
  const files = paths.map((path) => scanSource(path, readFileSync(resolve(root, path), "utf8")));
  const functions = files.flatMap((file) => file.functions);
  const groups = collectGroups(functions);
  const reviewPath = resolve(root, "docs/quality/reviews.json");
  const reviews = existsSync(reviewPath) ? JSON.parse(readFileSync(reviewPath, "utf8")) : [];
  const reviewStates = reviews.map((review) => {
    const file = files.find((file) => file.path === review.path);
    const members = functions.filter((fn) => fn.path === review.path && review.names.includes(fn.name));
    const current = file?.hash === review.sourceHash && members.length > 0;
    if (current)
      for (const fn of members) {
        fn.manualReview = review.assessment;
        fn.reviewFamily = review.family;
        fn.task = review.task;
      }
    return {
      family: review.family,
      path: review.path,
      status: current ? "current" : "needs-review",
      reason: review.reason,
    };
  });
  const inferredAny = inspectInferredAny(root);
  const report = {
    reviewStates,
    inferredAny,
    version: 1,
    sourceRevision: execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
    method:
      "TypeScript AST, inline HTML scripts and Svelte compiler script/template callable inventory; >=40-token whole-body exact/identifier-and-literal-normalized candidates; semantic duplication requires manual review",
    exclusions: [
      "Dependencies/build outputs ignored by Git",
      "Generated declarations and function/type signatures without bodies",
      "CSS and HTML markup without inline script implementations",
      "Algorithms duplicated as partial blocks or expressed differently may have no whole-body fingerprint match",
    ],
    files: files.map(({ functions: _functions, risks: _risks, ...file }) => file),
    functions: functions.map(({ shape: _shape, ...fn }) => fn),
    groups,
    risks: files.flatMap((file) => file.risks),
  };
  const out = resolve(root, "docs/quality");
  if (process.argv.includes("--check")) {
    const saved = JSON.parse(readFileSync(resolve(out, "functions.json"), "utf8"));
    const withoutRevision = ({ sourceRevision: _revision, ...data }) => data;
    if (JSON.stringify(withoutRevision(saved)) !== JSON.stringify(withoutRevision(report))) {
      throw new Error("Callable inventory changed. Review source/review-state drift and regenerate with --write.");
    }
  }
  if (process.argv.includes("--write")) mkdirSync(out, { recursive: true });
  if (process.argv.includes("--write")) {
    writeFileSync(resolve(out, "functions.json"), `${JSON.stringify(report)}\n`);
    const lines = [
      "---",
      "type: research",
      "status: active",
      "area: engineering",
      "updated: 2026-10-09",
      "---",
      "",
      "# Callable duplication screening inventory",
      "",
      `Generated by \`node scripts/quality/audit.mjs --write\`. ${files.length} files; ${functions.length} callables.`,
      "",
      "Every entry was inventoried/screened, not individually certified free of semantic duplication. Whole-body matches are candidates, including test/harness repetition. Inline Svelte callbacks/snippets and HTML fixture scripts are included. See [the audit](code-quality-audit.md) for manual judgments and [machine evidence](functions.json) for fingerprints and type-risk locations.",
      "",
      "| Scope | Callable | Location | Candidate groups | Manual review |",
      "| --- | --- | --- | --- | --- |",
    ];
    for (const fn of functions)
      lines.push(
        `| ${fn.scope} | ${fn.name.replaceAll("|", "\\|")} | [${fn.path}:${fn.line}](../../${fn.path}) | ${fn.groups.join(", ") || "No whole-body match"} | ${fn.manualReview} |`,
      );
    writeFileSync(resolve(out, "functions.md"), `${lines.join("\n")}\n`);
  }
  console.log(
    JSON.stringify(
      {
        files: files.length,
        functions: functions.length,
        scopes: Object.fromEntries(
          ["runtime", "tooling", "tests", "harness"].map((scope) => [
            scope,
            functions.filter((f) => f.scope === scope).length,
          ]),
        ),
        groups: groups.length,
        manuallyReviewed: functions.filter((fn) => fn.manualReview !== "not-reviewed").length,
        staleReviews: reviewStates.filter((r) => r.status !== "current").length,
        inferredRuntimeAny: inferredAny.length,
        risks: Object.fromEntries(
          [...new Set(report.risks.map((risk) => risk.kind))].map((kind) => [
            kind,
            report.risks.filter((r) => r.kind === kind).length,
          ]),
        ),
      },
      null,
      2,
    ),
  );
}

function inspectInferredAny(root) {
  const config = ts.readConfigFile(resolve(root, "tsconfig.json"), ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, " "));
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  const program = ts.createProgram(parsed.fileNames, parsed.options);
  const checker = program.getTypeChecker();
  const findings = [];
  for (const source of program.getSourceFiles()) {
    const path = relative(root, source.fileName);
    if (!path.startsWith("src/") || /\.(test|stories)\.|\.d\.ts$/.test(path)) continue;
    const visit = (node) => {
      if (
        (ts.isVariableDeclaration(node) || ts.isParameter(node)) &&
        ts.isIdentifier(node.name) &&
        checker.getTypeAtLocation(node.name).flags & ts.TypeFlags.Any
      ) {
        findings.push({
          path,
          line: source.getLineAndCharacterOfPosition(node.name.getStart(source)).line + 1,
          name: node.name.text,
          kind: ts.SyntaxKind[node.kind],
          assessment: "library-inferred-any-boundary-needs-review",
        });
      }
      ts.forEachChild(node, visit);
    };
    visit(source);
  }
  return findings;
}

function calleeName(expression, source) {
  if (ts.isCallExpression(expression)) return calleeName(expression.expression, source);
  if (ts.isPropertyAccessExpression(expression))
    return `${calleeName(expression.expression, source)}.${expression.name.text}`;
  if (ts.isElementAccessExpression(expression)) return `${calleeName(expression.expression, source)}[computed]`;
  if (ts.isIdentifier(expression)) return expression.text;
  if (ts.isArrayLiteralExpression(expression)) return "array";
  return "call";
}

function mask(text, ranges) {
  const chars = text.split("").map((char) => (char === "\n" || char === "\r" ? char : " "));
  for (const { start, end } of ranges) for (let i = start; i < end; i += 1) chars[i] = text[i];
  return chars.join("");
}

function tokenize(node, source) {
  const tokens = [];
  const visit = (child) => {
    const children = child.getChildren(source);
    if (children.length) children.forEach(visit);
    else tokens.push(`${child.kind}:${child.getText(source)}`);
  };
  visit(node);
  return tokens;
}

function normalize(tokens) {
  const names = new Map();
  return tokens.map((token) => {
    const separator = token.indexOf(":");
    const kind = Number(token.slice(0, separator));
    if (kind === ts.SyntaxKind.Identifier) {
      if (!names.has(token)) names.set(token, names.size);
      return `id${names.get(token)}`;
    }
    if (
      [
        ts.SyntaxKind.StringLiteral,
        ts.SyntaxKind.NumericLiteral,
        ts.SyntaxKind.NoSubstitutionTemplateLiteral,
        ts.SyntaxKind.TemplateHead,
        ts.SyntaxKind.TemplateMiddle,
        ts.SyntaxKind.TemplateTail,
      ].includes(kind)
    )
      return `literal:${kind}`;
    return token;
  });
}

function hash(value) {
  return createHash("sha256").update(value).digest("hex");
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();

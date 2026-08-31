#!/usr/bin/env node
/*
 * Split a CommonJS `exports.*` controller into per-section sub-files using acorn.
 *
 * Strategy:
 *   - Parse the file with acorn (script / latest ecmaVersion).
 *   - Collect all TOP-LEVEL statements and their exact [start,end) ranges.
 *   - Collect all section-separator comments (by line).
 *   - preambleSrc = full source with every `exports.X = ...` statement range deleted
 *     (keeps imports + mid-file helpers + data + comments in original order).
 *   - Partition export statements into sections by the nearest preceding section comment.
 *   - Each section file = preambleSrc + that section's exports (exact original slices).
 *   - Rewrite every require('../  ->  require('../../  in ALL slices (uniform, correct
 *     because section files sit one directory deeper than the original controller).
 *   - index.js reassembles exports via spread of each section module.
 *   - Original controller becomes: module.exports = require('./<folder>/index');
 */
const fs = require('fs');
const path = require('path');
const acorn = require('acorn');

const SECTION_RX = /^[=-]+\s*(.*?)\s*[=-]+$/;

function parse(src) {
  const comments = [];
  const ast = acorn.parse(src, {
    ecmaVersion: 'latest',
    sourceType: 'script',
    locations: true,
    allowReturnOutsideFunction: true,
    onComment: (block, text, start, end, startLoc, endLoc) => {
      comments.push({ block, text, start, end, line: startLoc ? startLoc.line : countLines(src, start) });
    },
  });
  return { ast, comments };
}

function countLines(src, pos) {
  let n = 1;
  for (let i = 0; i < pos; i++) if (src[i] === '\n') n++;
  return n;
}

function isRequireDecl(stmt) {
  return (
    stmt.type === 'VariableDeclaration' &&
    stmt.declarations.length === 1 &&
    stmt.declarations[0].init &&
    stmt.declarations[0].init.type === 'CallExpression' &&
    stmt.declarations[0].init.callee.type === 'Identifier' &&
    stmt.declarations[0].init.callee.name === 'require'
  );
}

function isExportStmt(stmt) {
  if (stmt.type === 'ExpressionStatement' && stmt.expression.type === 'AssignmentExpression') {
    const left = stmt.expression.left;
    if (left.type === 'MemberExpression' && !left.computed) {
      const obj = left.object;
      const prop = left.property && left.property.name;
      if (prop && ((obj.type === 'Identifier' && obj.name === 'exports') ||
                   (obj.type === 'MemberExpression' && !obj.computed &&
                    obj.object.type === 'Identifier' && obj.object.name === 'module' &&
                    obj.property && obj.property.name === 'exports'))) {
        return true;
      }
    }
  }
  return false;
}

function exportName(stmt) {
  const left = stmt.expression.left;
  return left.property.name;
}

function rewrite(text) {
  // Replace require('../  ->  require('../../   and require("../  ->  require("../../ 
  return text.replace(/require\((['"])(\.\.\/)/g, (m, q) => `require(${q}../../`);
}

function splitController(file, folder, kind) {
  const src = fs.readFileSync(file, 'utf8');
  const { ast, comments } = parse(src);

  const top = ast.body;
  const exportsStmts = top.filter(isExportStmt);
  const exportRanges = exportsStmts.map((s) => [s.start, s.end]);

  // Section comment lines
  const secComments = comments.filter((c) => !c.block && SECTION_RX.test(c.text.trim()));
  const secLines = secComments
    .map((c) => ({ line: c.line, title: (c.text.trim().match(SECTION_RX) || [])[1] }))
    .sort((a, b) => a.line - b.line);

  // Assign each export to nearest preceding section line
  const sections = new Map(); // title -> [statements]
  let defaultTitle = 'general';
  for (const s of exportsStmts) {
    let title = defaultTitle;
    for (const sc of secLines) {
      if (s.loc.start.line >= sc.line) title = sc.title;
      else break;
    }
    if (!sections.has(title)) sections.set(title, []);
    sections.get(title).push(s);
  }

  // Build preamble: strip all export statements from source
  const removed = simplifyRanges(exportRanges);
  let preamble = '';
  let pos = 0;
  for (const [a, b] of removed) {
    preamble += src.slice(pos, a);
    pos = b;
  }
  preamble += src.slice(pos);

  fs.mkdirSync(folder, { recursive: true });
  const used = {};
  const indexParts = [];
  let totalExports = 0;
  for (const [title, stmts] of [...sections.entries()]) {
    let slug = title.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase() || 'general';
    const n = used[slug] || 0;
    used[slug] = n + 1;
    if (n > 0) slug = `${slug}_${n + 1}`;
    const body = stmts.map((s) => src.slice(s.start, s.end)).join('\n');
    let content = rewrite(preamble) + '\n\n' + rewrite(body) + '\n';
    fs.writeFileSync(path.join(folder, `${slug}.js`), content);
    indexParts.push(`  ...require('./${slug}'),`);
    totalExports += stmts.length;
  }
  fs.writeFileSync(path.join(folder, 'index.js'), 'module.exports = {\n' + indexParts.map((p) => p).join('\n') + '\n};\n');

  const rewriteMarker = `module.exports = require('./${path.basename(folder)}/index');\n`;
  fs.writeFileSync(file, rewriteMarker);
  console.log(`[OK] ${path.basename(file)} -> ${path.basename(folder)}/ (${sections.size} sections, ${totalExports} exports)`);
}

function simplifyRanges(ranges) {
  if (!ranges.length) return [];
  const sorted = [...ranges].sort((a, b) => a[0] - b[0]);
  const out = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const last = out[out.length - 1];
    if (sorted[i][0] <= last[1]) last[1] = Math.max(last[1], sorted[i][1]);
    else out.push(sorted[i]);
  }
  return out;
}

if (require.main === module) {
  const which = process.argv[2] || 'superadmin';
  const dir = __dirname;
  const file = path.join(dir, `${which}.controller.js`);
  const folder = path.join(dir, which);
  splitController(file, folder, which);
}

module.exports = { splitController };

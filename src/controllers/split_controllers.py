#!/usr/bin/env python3
"""
Split a `exports.*` controller file into per-section sub-files inside a folder.

Strategy (zero behavioral risk):
  * Tokenize the file into TOP-LEVEL statements (brace/ bracket/ paren depth == 0).
  * Classify each top-level statement:
      - IMPORT    : `const X = require(...)` / `const {..} = require(...)`
      - HELPER    : any other depth-0 declaration (const/function/data/object) NOT an export
      - EXPORT    : `exports.X = ...`
      - COMMENT   : section-separator comment
  * Preamble = all IMPORT + HELPER statements in original order.
  * Sections  = contiguous EXPORT runs separated by COMMENT lines.
  * Each section file = Preamble (verbatim) + that section's EXPORT statements.
    Relative require paths in Preamble are rewrittten '../' -> '../../' because
    section files live one level deeper.
  * index.js reassembles exports with identical keys.
  * The original controller becomes:  module.exports = require('./<folder>/index');
"""
import re
import os

COMMENT_MARKERS = ['// ----', '// ====']


def is_section_comment(text):
    t = text.strip()
    return any(t.startswith(m) for m in COMMENT_MARKERS)


def _statement_pass(body):
    """Return tokens: depth-0 statements and standalone section comments."""
    n = len(body)
    i = 0
    line = 1
    stack = []
    in_str = None
    buf = []
    buf_line = 1
    buf_started = False
    tokens = []

    def emit(text, ln):
        s = text.strip()
        if s == '':
            return None
        if is_section_comment(s):
            return {'type': 'comment', 'line': ln, 'text': text}
        sm = re.match(r'exports\.([A-Za-z0-9_$]+)\s*=', s)
        if sm:
            return {'type': 'export', 'name': sm.group(1), 'line': ln, 'text': text}
        rm = re.match(r'(?:const|let|var|function)\s+([A-Za-z0-9_$]+)', s)
        if rm:
            if re.search(r'require\s*\(', s):
                return {'type': 'import', 'name': rm.group(1), 'line': ln, 'text': text}
            return {'type': 'helper', 'name': rm.group(1), 'line': ln, 'text': text}
        return {'type': 'other', 'line': ln, 'text': text}

    while i < n:
        c = body[i]
        if c == '\n':
            line += 1
        # string literal handling
        if in_str:
            buf.append(c)
            if c == '\\' and i + 1 < n:
                buf.append(body[i + 1])
                i += 2
                continue
            if c == in_str:
                in_str = None
            i += 1
            continue
        if c in '"\'':
            in_str = c
            if not buf_started:
                buf_line = line
                buf_started = True
            buf.append(c)
            i += 1
            continue
        if c == '/' and i + 1 < n and body[i + 1] == '/':
            e = body.find('\n', i)
            if e == -1:
                e = n
            com = body[i:e]
            if is_section_comment(com):
                tok = emit(com, line)
                if tok:
                    tokens.append(tok)
            else:
                if not buf_started:
                    # non-section comment outside a statement: treat as standalone 'other' to preserve
                    tokens.append({'type': 'other', 'line': line, 'text': com})
                else:
                    buf.append(com)
            line += com.count('\n')
            i = e
            continue
        if not buf_started:
            buf_line = line
            buf_started = True
        if c in '([{':
            stack.append(c)
        elif c in ')]}':
            if stack:
                stack.pop()
        buf.append(c)
        i += 1
        if c == ';' and not stack:
            tok = emit(''.join(buf), buf_line)
            if tok:
                tokens.append(tok)
            buf = []
            buf_started = False
    # flush trailing
    if buf_started:
        tok = emit(''.join(buf), buf_line)
        if tok:
            tokens.append(tok)
    return tokens


def build_preamble(tokens):
    """Preamble = all imports + helpers + other (non-export, non-comment, non-blank), in order."""
    parts = []
    for t in tokens:
        if t['type'] in ('import', 'helper', 'other'):
            parts.append(t['text'])
    return '\n'.join(parts)


def split_controller(path, folder, section_regex):
    body = open(path).read()
    tokens = _statement_pass(body)

    # Determine section boundaries by comment tokens that match the section marker
    sec_comments = [t for t in tokens if t['type'] == 'comment']
    if not sec_comments:
        raise SystemExit(f"No section separators found in {path}")

    preamble_tokens = [t for t in tokens if t['type'] in ('import', 'helper', 'other')]
    preamble = '\n'.join(t['text'] for t in preamble_tokens)

    # Group exports into sections partitioned by comment tokens (in line order)
    export_tokens = [t for t in tokens if t['type'] == 'export']

    # Build ordered list of section comments by line
    sec_by_line = {}
    for c in sec_comments:
        m = re.search(section_regex, c['text'].strip())
        title = m.group(1).strip() if m else 'section'
        sec_by_line[c['line']] = title

    # Partition export tokens into sections
    sec_lines = sorted(sec_by_line.keys())
    # Each export belongs to the section whose comment line is the greatest <= export line
    sections = []  # list of (title, [export tokens])
    cur_title = None
    cur_exports = []
    sec_map = []
    for t in export_tokens:
        assigned = None
        for cl in sec_lines:
            if t['line'] >= cl:
                assigned = cl
            else:
                break
        title = sec_by_line[assigned] if assigned is not None else 'general'
        if cur_title is None:
            cur_title = title
        if title != cur_title:
            sections.append((cur_title, cur_exports))
            cur_exports = []
            cur_title = title
        cur_exports.append(t)
    if cur_title is not None:
        sections.append((cur_title, cur_exports))

    os.makedirs(folder, exist_ok=True)
    used = {}
    index_parts = []
    count = 0
    for title, exports in sections:
        slug = re.sub(r'[^a-zA-Z0-9]+', '_', title).strip('_').lower() or 'section'
        base = slug
        c = used.get(base, 0)
        used[base] = c + 1
        if c > 0:
            slug = f'{base}_{c}'
        # Rewrite relative require depth in preamble
        content = preamble
        content = re.sub(r"(require\(['\"])(\.\./)", r"\1../../", content)
        content += '\n\n'
        content += '\n\n'.join(t['text'].rstrip() for t in exports)
        content += '\n'
        fname = f'{slug}.js'
        with open(os.path.join(folder, fname), 'w') as fh:
            fh.write(content)
        index_parts.append(f"  ...require('./{slug}'),")
        count += len(exports)

    with open(os.path.join(folder, 'index.js'), 'w') as fh:
        fh.write('module.exports = {\n' + '\n'.join(index_parts) + '\n};\n')

    with open(path, 'w') as fh:
        fh.write(f"module.exports = require('./{os.path.basename(folder)}/index');\n")

    print(f"[OK] {os.path.basename(path)} -> {os.path.basename(folder)}/ ({len(sections)} sections, {count} exports)")


if __name__ == '__main__':
    import sys
    which = sys.argv[1] if len(sys.argv) > 1 else 'superadmin'
    base = os.path.dirname(os.path.abspath(__file__))
    rx = {
        'superadmin': r'// ---------------- ([^-]+) ----------------',
        'admin': r'// ----+ ([^-]+?) ----+',
    }
    split_controller(os.path.join(base, f'{which}.controller.js'),
                     os.path.join(base, which), rx[which])

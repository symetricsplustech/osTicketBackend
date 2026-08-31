#!/usr/bin/env python3
"""
Split aggregate mongoose model files into per-model files inside a subfolder,
while preserving the exact public export object so existing imports keep working.

For each aggregate file:
  - create models/<folder>/
  - one file per model registering that model
  - index.js re-exports with the same keys
  - rewrite original aggregate file to `module.exports = require('./<folder>')`
"""
import re
import os
import sys

MODELS_DIR = os.path.dirname(os.path.abspath(__file__))

# folder name for each aggregate
AGGREGATES = {
    'Enterprise.js': 'enterprise',
    'Platform2.js': 'platformGovernance',
    'Platform3.js': 'platformSecurity',
    'Platform4.js': 'platformOps',
    'Platform5.js': 'platformServices',
    'Platform6.js': 'platformData',
    'Platform7.js': 'platformIdentity',
    'Remaining.js': 'domain',
    'License.js': 'license',
    'Locale.js': 'i18n',
    'CustomerService.js': 'customerService',
    'Product.js': 'product',
    'Stockroom.js': 'stockroom',
    'UsageLimit.js': 'usage',
    'WorkflowExecutionLog.js': 'workflowExecution',
}

HELPERS = {
    'Platform6.js': 'const oid = { type: mongoose.Schema.Types.ObjectId, ref: \'Agent\' };',
}


def split_schema_blocks(body):
    """Return list of (schemaVarName, block_text) in order for `const XxxSchema = new mongoose.Schema(...)`."""
    blocks = []
    pos = 0
    pat = re.compile(r'const\s+(\w+Schema)\s*=\s*new\s+mongoose\.Schema\s*\(')
    while True:
        m = pat.search(body, pos)
        if not m:
            break
        name = m.group(1)
        # find balanced close paren of new mongoose.Schema( ... )
        start = m.end() - 1  # position of '('
        depth = 0
        i = start
        end = None
        while i < len(body):
            c = body[i]
            if c == '(':
                depth += 1
            elif c == ')':
                depth -= 1
                if depth == 0:
                    # consume optional trailing ';'
                    end = i + 1
                    while end < len(body) and body[end] in ' \t':
                        end += 1
                    if end < len(body) and body[end] == ';':
                        end += 1
                    break
            i += 1
        block = body[m.start():end]
        blocks.append((name, block))
        pos = end
    return blocks


def split_index_statements(body):
    """Bucket `xxxSchema.index(...);` statements by schema variable name."""
    buckets = {}
    for m in re.finditer(r'\n\s*(\w+Schema)\.(index)\((?:[^()]|\([^()]*\))*\)\s*;', body):
        name = m.group(1)
        stmt = m.group(0).strip()
        buckets.setdefault(name, []).append(stmt)
    return buckets


def get_model_registrations(fname, body):
    """Return ordered list of (KeyName, modelName, schemaVarName) from the module.exports block."""
    if 'module.exports' not in body:
        return []
    export_part = body.split('module.exports', 1)[1]
    results = []
    # Pattern A: Name: mongoose.model('ModelName', xxxSchema)
    for m in re.finditer(r'^\s*([A-Za-z0-9_]+)\s*:\s*mongoose\.model\(\s*\'([^\']+)\'\s*(?:,\s*(\w+Schema)\s*)?\)', export_part, re.M):
        key = m.group(1)
        model = m.group(2)
        schema = m.group(3)
        results.append((key, model, schema))
    # Pattern B: const ModelName = mongoose.model('ModelName', schema); ... => need the const defs too
    return results


def get_model_const_registrations(body):
    """For Pattern B files, capture `const ModelName = mongoose.model('ModelName', xxxSchema);`"""
    results = []
    for m in re.finditer(r'const\s+([A-Za-z0-9_]+)\s*=\s*mongoose\.model\(\s*\'([^\']+)\'\s*(?:,\s*(\w+Schema)\s*)?\)\s*;', body):
        results.append((m.group(1), m.group(2), m.group(3)))
    return results


def get_idempotent_registrations(body):
    """Capture `mongoose.models.X || mongoose.model('X', xSchema);`"""
    results = []
    for m in re.finditer(r'mongoose\.models\.([A-Za-z0-9_]+)\s*\|\|\s*mongoose\.model\(\s*\'([^\']+)\'\s*,\s*(\w+Schema)\s*\)\s*;', body):
        results.append((m.group(1), m.group(2), m.group(3)))
    return results


def process_one(fname):
    path = os.path.join(MODELS_DIR, fname)
    body = open(path).read()

    schemas = dict(split_schema_blocks(body))
    index_buckets = split_index_statements(body)
    registrations = get_model_registrations(fname, body)
    const_regs = get_model_const_registrations(body)
    idem_regs = get_idempotent_registrations(body)

    if not registrations:
        # pattern B: derive keys from const registrations
        registrations = const_regs

    folder = os.path.join(MODELS_DIR, AGGREGATES[fname])
    os.makedirs(folder, exist_ok=True)

    # map modelName -> schemaVarName for idempotent registrations
    idem_by_model = {}
    for (key, model, schema) in idem_regs:
        idem_by_model[model] = schema

    # helper (non-registered) schemas that model schemas may reference
    registered_schema_vars = set()
    for (key, model, schema) in registrations:
        if schema:
            registered_schema_vars.add(schema)
    for s in idem_by_model.values():
        if s:
            registered_schema_vars.add(s)
    helper_schemas = {n: b for n, b in schemas.items() if n not in registered_schema_vars}

    index_lines = []
    for (key, model, schema) in registrations:
        lines = ["const mongoose = require('mongoose');"]
        helper = HELPERS.get(fname)
        if helper:
            lines.append(helper)
        if schema and schema in schemas:
            body_text = schemas[schema]
            # include any helper schema this model schema references
            for hname in helper_schemas:
                if re.search(r'\b' + hname + r'\b', body_text):
                    lines.append(helper_schemas[hname])
            lines.append(body_text)
            for stmt in index_buckets.get(schema, []):
                lines.append(stmt)
            model_expr = f"mongoose.models.{model} || mongoose.model('{model}', {schema})"
        elif model in idem_by_model:
            # idempotent registration + retrieval (e.g. Locale, UsageLimit)
            s = idem_by_model[model]
            body_text = schemas[s]
            for hname in helper_schemas:
                if re.search(r'\b' + hname + r'\b', body_text):
                    lines.append(helper_schemas[hname])
            lines.append(body_text)
            for stmt in index_buckets.get(s, []):
                lines.append(stmt)
            model_expr = f"mongoose.models.{model} || mongoose.model('{model}', {s})"
        else:
            # truly no-schema registration (shouldn't occur); retrieve by name
            model_expr = f"mongoose.model('{model}')"
        lines.append(f"module.exports = {model_expr};")
        per_file = os.path.join(folder, f"{key}.js")
        with open(per_file, 'w') as fh:
            fh.write('\n'.join(lines) + '\n')
        index_lines.append(f"  {key}: require('./{key}'),")

    with open(os.path.join(folder, 'index.js'), 'w') as fh:
        fh.write('module.exports = {\n' + '\n'.join(index_lines) + '\n};\n')

    # rewrite the original aggregate to re-export the folder
    with open(path, 'w') as fh:
        fh.write(f"module.exports = require('./{AGGREGATES[fname]}/index');\n")

    print(f"[OK] {fname} -> models/{AGGREGATES[fname]}/ ({len(registrations)} models)")


def main():
    targets = sys.argv[1:] or list(AGGREGATES.keys())
    for t in targets:
        if t in AGGREGATES:
            process_one(t)
        else:
            print(f"[SKIP] unknown aggregate {t}")


if __name__ == '__main__':
    main()

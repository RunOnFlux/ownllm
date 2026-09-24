#!/usr/bin/env node
/**
 * Every tool call in a corpus must be legal under the schema shipped in that
 * same row.
 *
 * v8 was trained on 13,131 calls that passed containerData inside a component
 * while the component schema in the very same prompt did not declare it. The
 * model resolved the contradiction by obeying the schema and learned to drop
 * the field, which is the one field that decides whether a game world survives
 * an instance moving node. A schema fix afterwards could not undo it.
 *
 * This checks, for every assistant tool call:
 *   - the tool exists in the row's tool list
 *   - every argument key is declared in that tool's schema, recursively
 *   - every required key is present
 *
 *   node finetune/audit-schema.js data/deploy-v9.jsonl
 */
const fs = require('node:fs');

const file = process.argv[2];
const problems = new Map();
const note = (k, ex) => { const p = problems.get(k) || { n: 0, ex }; p.n += 1; problems.set(k, p); };

function checkObj(schema, value, where, tool) {
  if (!schema || typeof value !== 'object' || value === null) return;
  if (Array.isArray(value)) {
    if (schema.items) value.forEach((v, i) => checkObj(schema.items, v, `${where}[]`, tool));
    return;
  }
  const props = schema.properties;
  if (!props) return; // free-form object (e.g. a spec passed through) - not checkable
  for (const k of Object.keys(value)) {
    if (!(k in props)) note(`${tool}: undeclared ${where}.${k}`, JSON.stringify(value).slice(0, 120));
    else checkObj(props[k], value[k], `${where}.${k}`, tool);
  }
  for (const r of schema.required || []) {
    if (!(r in value)) note(`${tool}: missing required ${where}.${r}`, JSON.stringify(value).slice(0, 120));
  }
}

let rows = 0; let calls = 0;
for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
  if (!line) continue;
  rows += 1;
  const r = JSON.parse(line);
  const byName = Object.fromEntries((r.tools || []).map((t) => [t.function.name, t.function.parameters]));
  for (const m of r.messages) {
    for (const tc of m.tool_calls || []) {
      calls += 1;
      const name = tc.function.name;
      if (!(name in byName)) { note(`${name}: not in this row's tool list`, ''); continue; }
      let a; try { a = JSON.parse(tc.function.arguments); } catch { note(`${name}: arguments not valid JSON`, tc.function.arguments.slice(0, 80)); continue; }
      checkObj(byName[name], a, 'args', name);
    }
  }
}
const list = [...problems.entries()].sort((x, y) => y[1].n - x[1].n);
console.log(`${rows} rows, ${calls} tool calls, ${list.length} distinct schema violations`);
for (const [k, v] of list.slice(0, 40)) console.log(`${String(v.n).padStart(7)}  ${k}${v.ex ? `\n           e.g. ${v.ex}` : ''}`);
process.exit(list.length ? 1 : 0);

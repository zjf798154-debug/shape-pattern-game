#!/usr/bin/env node
// 题库自检：题量、选项唯一性、答案下标、题型分布
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'questions.js'), 'utf8');
const window = {};
new Function('window', src)(window);
const questions = window.QUESTIONS;

const key = (t) => [t.k, t.s, t.c, t.n ?? '', t.scale ?? '', t.r ?? ''].join('|');
const errors = [];

if (!Array.isArray(questions)) errors.push('window.QUESTIONS 不是数组');
if (questions.length !== 100) errors.push(`题目数量 ${questions.length}，应为 100`);

const ids = new Set();
const sigs = new Set();
const tags = new Map();
const types = new Map();

questions.forEach((q, i) => {
  const expectId = i + 1;
  if (q.id !== expectId) errors.push(`第 ${expectId} 题的 id 是 ${q.id}`);
  if (ids.has(q.id)) errors.push(`id 重复：${q.id}`);
  ids.add(q.id);

  if (!['next', 'missing'].includes(q.type)) errors.push(`Q${q.id} 类型非法`);
  types.set(q.type, (types.get(q.type) || 0) + 1);
  tags.set(q.tag, (tags.get(q.tag) || 0) + 1);

  if (!Array.isArray(q.options) || q.options.length !== 4) {
    errors.push(`Q${q.id} 选项不是 4 个`);
    return;
  }
  const keys = new Set(q.options.map(key));
  if (keys.size !== 4) errors.push(`Q${q.id} 选项有重复`);
  if (q.answer < 0 || q.answer > 3) errors.push(`Q${q.id} 答案下标 ${q.answer}`);

  if (!q.explain) errors.push(`Q${q.id} 缺少规律说明`);
  if (!q.prompt) errors.push(`Q${q.id} 缺少题干`);

  if (q.type === 'missing') {
    const nulls = q.cells.filter((t) => !t).length;
    if (nulls !== 1) errors.push(`Q${q.id} 缺失格 ${nulls} 个`);
  }
  if (!q.cells.length) errors.push(`Q${q.id} 没有图形序列`);

  const sig = JSON.stringify([q.type, q.cells, q.options, q.answer]);
  if (sigs.has(sig)) errors.push(`Q${q.id} 与前面的题目完全重复`);
  sigs.add(sig);
});

for (const [tag, n] of tags) if (n !== 10) errors.push(`题型 ${tag} 有 ${n} 题（应为 10）`);
if (tags.size !== 10) errors.push(`题型数量 ${tags.size}（应为 10）`);
if ((types.get('next') || 0) === 0) errors.push('没有“下一题”类型');
if ((types.get('missing') || 0) === 0) errors.push('没有“缺失”类型');

const tagNames = {
  abc: '三图形循环',
  abb: 'ABB 循环',
  aabb: 'AABB 循环',
  'two-attr': '形状+颜色双规律',
  growing: '数量递增',
  shrinking: '数量递减',
  size: '大小循环',
  rotation: '箭头旋转',
  missing: '中间缺失',
  'shape-size': '形状+大小双规律',
};

if (errors.length) {
  console.error('✘ 题库自检失败：');
  errors.forEach((e) => console.error('  - ' + e));
  process.exit(1);
}

console.log('✔ 题库自检通过：100 题，10 类规律，每类 10 题');
console.log('  题型：' + [...tags].map(([t, n]) => `${tagNames[t] || t} ${n}`).join(' / '));
console.log(`  形式：下一题 ${types.get('next')} 题，中间缺失 ${types.get('missing')} 题`);
const answers = questions.map((q) => q.answer);
const dist = [0, 1, 2, 3].map((i) => answers.filter((a) => a === i).length);
console.log(`  正确答案分布在 A/B/C/D：${dist.join(' / ')}`);

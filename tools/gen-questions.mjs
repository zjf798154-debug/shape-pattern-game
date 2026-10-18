#!/usr/bin/env node
// 生成 100 道图形规律题（确定性随机，可复现）
// node tools/gen-questions.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/* ---------------- 基础随机 ---------------- */
function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// 若想换一套题，改这里的种子，并重新跑 check
const rand = mulberry32(20261018);
const ri = (n) => Math.floor(rand() * n);
const pick = (arr) => arr[ri(arr.length)];
const pickDifferent = (arr, exclude = []) => {
  const pool = arr.filter((x) => !exclude.includes(x));
  return pick(pool.length ? pool : arr);
};
const sample = (arr, k) => {
  const copy = [...arr];
  const out = [];
  while (out.length < k && copy.length) out.push(copy.splice(ri(copy.length), 1)[0]);
  return out;
};
const shuffle = (arr) => {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = ri(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'diamond', 'pentagon', 'hexagon'];
const ALL_SHAPES = [...SHAPES, 'arrow'];
const COLORS = ['red', 'blue', 'amber', 'green', 'purple', 'pink', 'orange', 'teal'];
const SIZES = [0.5, 0.75, 1];

const S = (s, c, extra = {}) => ({ k: 'shape', s, c, ...extra });
const G = (s, c, n) => ({ k: 'group', s, c, n });
const tokenKey = (t) =>
  [t.k, t.s, t.c, t.n ?? '', t.scale ?? '', t.r ?? ''].join('|');

/* ---------------- 题目构造器 ---------------- */

// 1. ABC 三图形循环
function bABC() {
  const [s1, s2, s3] = sample(SHAPES, 3);
  const [c1, c2, c3] = sample(COLORS, 3);
  const period = [S(s1, c1), S(s2, c2), S(s3, c3)];
  const len = 6 + (rand() < 0.5 ? 1 : 0);
  const cells = Array.from({ length: len }, (_, i) => ({ ...period[i % 3] }));
  const ans = period[len % 3];
  return {
    type: 'next',
    cells,
    ans,
    cands: [
      period[(len + 1) % 3],
      period[(len + 2) % 3],
      S(ans.s, pickDifferent(COLORS, [c1, c2, c3])),
      S(pickDifferent(SHAPES, [s1, s2, s3]), ans.c),
    ],
    explain: '三个不同的图形一组，循环出现',
    tag: 'abc',
  };
}

// 2. ABB 循环
function bABB() {
  const [s1, s2] = sample(SHAPES, 2);
  const [c1, c2] = sample(COLORS, 2);
  const A = S(s1, c1);
  const B = S(s2, c2);
  const period = [A, B, B];
  const len = 6 + ri(2);
  const cells = Array.from({ length: len }, (_, i) => ({ ...period[i % 3] }));
  const ans = period[len % 3];
  return {
    type: 'next',
    cells,
    ans,
    cands: [
      period[(len + 1) % 3],
      period[(len + 2) % 3],
      S(s2, c1),
      S(s1, c2),
      S(pickDifferent(SHAPES, [s1, s2]), c2),
    ],
    explain: '1 个 + 2 个相同图形，三个一组循环',
    tag: 'abb',
  };
}

// 3. AABB 循环
function bAABB() {
  const [s1, s2] = sample(SHAPES, 2);
  const [c1, c2] = sample(COLORS, 2);
  const A = S(s1, c1);
  const B = S(s2, c2);
  const period = [A, A, B, B];
  const len = 6 + ri(2);
  const cells = Array.from({ length: len }, (_, i) => ({ ...period[i % 4] }));
  const ans = period[len % 4];
  return {
    type: 'next',
    cells,
    ans,
    cands: [
      period[(len + 1) % 4],
      period[(len + 2) % 4],
      period[(len + 3) % 4],
      S(s2, c1),
      S(s1, c2),
    ],
    explain: '2 个 + 2 个相同图形，四个一组循环',
    tag: 'aabb',
  };
}

// 4. 形状 2 个循环 + 颜色 3 个循环
function bTwoAttr() {
  const [s1, s2] = sample(SHAPES, 2);
  const [c1, c2, c3] = sample(COLORS, 3);
  const shapes = [s1, s2];
  const colors = [c1, c2, c3];
  const len = 6 + ri(2);
  const cells = Array.from({ length: len }, (_, i) => S(shapes[i % 2], colors[i % 3]));
  const ans = S(shapes[len % 2], colors[len % 3]);
  return {
    type: 'next',
    cells,
    ans,
    cands: [
      S(shapes[len % 2], colors[(len + 1) % 3]),
      S(shapes[(len + 1) % 2], colors[len % 3]),
      S(shapes[(len + 1) % 2], colors[(len + 2) % 3]),
      S(shapes[len % 2], colors[(len + 2) % 3]),
      S(shapes[(len + 1) % 2], colors[(len + 1) % 3]),
    ],
    explain: '形状两个一循环，颜色三个一循环',
    tag: 'two-attr',
  };
}

// 5. 数量递增 1,2,3 -> 4
function bGrowing() {
  const start = rand() < 0.5 ? 1 : 2;
  const s = pick(SHAPES);
  const c = pick(COLORS);
  const counts = [start, start + 1, start + 2];
  const ansN = start + 3;
  return {
    type: 'next',
    prompt: '接下来应该是哪一组图形？',
    cells: counts.map((n) => G(s, c, n)),
    ans: G(s, c, ansN),
    cands: [
      G(s, c, ansN - 1),
      G(s, c, ansN + 1),
      G(s, c, ansN - 2),
      G(s, c, ansN + 2),
    ],
    explain: '每次多 1 个',
    tag: 'growing',
  };
}

// 6. 数量递减 5,4,3 -> 2
function bShrinking() {
  const start = rand() < 0.5 ? 5 : 6;
  const s = pick(SHAPES);
  const c = pick(COLORS);
  const counts = [start, start - 1, start - 2];
  const ansN = start - 3;
  return {
    type: 'next',
    prompt: '接下来应该是哪一组图形？',
    cells: counts.map((n) => G(s, c, n)),
    ans: G(s, c, ansN),
    cands: [G(s, c, ansN + 1), G(s, c, ansN + 2), G(s, c, Math.max(1, ansN - 1))],
    explain: '每次少 1 个',
    tag: 'shrinking',
  };
}

// 7. 大小循环 小->中->大
function bSizeCycle() {
  const s = pick(SHAPES);
  const c = pick(COLORS);
  const len = 6 + ri(2);
  const cells = Array.from({ length: len }, (_, i) => S(s, c, { scale: SIZES[i % 3] }));
  return {
    type: 'next',
    cells,
    ans: S(s, c, { scale: SIZES[len % 3] }),
    cands: [
      S(s, c, { scale: SIZES[(len + 1) % 3] }),
      S(s, c, { scale: SIZES[(len + 2) % 3] }),
      S(pickDifferent(SHAPES, [s]), c, { scale: SIZES[len % 3] }),
      S(s, pickDifferent(COLORS, [c]), { scale: SIZES[len % 3] }),
    ],
    explain: '小 → 中 → 大，三个一组循环',
    tag: 'size',
  };
}

// 8. 箭头每次顺时针转 90°
function bRotation() {
  const c = pick(COLORS);
  const len = 5 + ri(2);
  const cells = Array.from({ length: len }, (_, i) => S('arrow', c, { r: (i * 90) % 360 }));
  return {
    type: 'next',
    prompt: '箭头接下来会朝哪个方向？',
    cells,
    ans: S('arrow', c, { r: (len * 90) % 360 }),
    cands: [0, 90, 180, 270].filter((d) => d !== (len * 90) % 360).map((d) => S('arrow', c, { r: d })),
    explain: '每次顺时针转 90°',
    tag: 'rotation',
  };
}

// 9. 中间缺失（3 或 4 个一组）
function bMissing() {
  const p = rand() < 0.5 ? 3 : 4;
  const shapes = sample(SHAPES, p);
  const colors = sample(COLORS, p);
  const period = shapes.map((s, i) => S(s, colors[i]));
  const len = 7;
  const missingIdx = p === 3 ? 2 + ri(3) : 4 + ri(2);
  const cells = Array.from({ length: len }, (_, i) => (i === missingIdx ? null : { ...period[i % p] }));
  const ans = period[missingIdx % p];
  const cands = period.filter((t) => tokenKey(t) !== tokenKey(ans));
  cands.push(S(ans.s, pickDifferent(COLORS, colors)));
  return {
    type: 'missing',
    prompt: '问号处应该是什么图形？',
    cells,
    ans,
    cands,
    explain: `${p} 个图形一组，循环排列`,
    tag: 'missing',
  };
}

// 10. 形状 2 个循环 + 大小 3 个循环
function bShapeSize() {
  const [s1, s2] = sample(SHAPES, 2);
  const c = pick(COLORS);
  const shapes = [s1, s2];
  const len = 6 + ri(2);
  const cells = Array.from({ length: len }, (_, i) => S(shapes[i % 2], c, { scale: SIZES[i % 3] }));
  const ans = S(shapes[len % 2], c, { scale: SIZES[len % 3] });
  return {
    type: 'next',
    cells,
    ans,
    cands: [
      S(shapes[len % 2], c, { scale: SIZES[(len + 1) % 3] }),
      S(shapes[len % 2], c, { scale: SIZES[(len + 2) % 3] }),
      S(shapes[(len + 1) % 2], c, { scale: SIZES[len % 3] }),
      S(shapes[(len + 1) % 2], c, { scale: SIZES[(len + 1) % 3] }),
    ],
    explain: '形状两个一循环，大小三个一循环',
    tag: 'shape-size',
  };
}

/* ---------------- 组装与校验 ---------------- */

function finalize(def, id) {
  const seen = new Set();
  const opts = [];
  for (const t of [def.ans, ...def.cands]) {
    if (!t) continue;
    const key = tokenKey(t);
    if (seen.has(key)) continue;
    seen.add(key);
    opts.push(t);
    if (opts.length === 4) break;
  }
  while (opts.length < 4) {
    const t = S(pick(SHAPES), pick(COLORS), { scale: pick(SIZES) });
    const key = tokenKey(t);
    if (!seen.has(key)) {
      seen.add(key);
      opts.push(t);
    }
  }
  const options = shuffle(opts);
  const answer = options.findIndex((t) => tokenKey(t) === tokenKey(def.ans));
  return {
    id,
    type: def.type,
    prompt:
      def.prompt ||
      (def.type === 'missing' ? '问号处应该是什么图形？' : '接下来应该是什么图形？'),
    cells: def.cells,
    options,
    answer,
    explain: def.explain,
    tag: def.tag,
  };
}

function sameToken(a, b) {
  return tokenKey(a) === tokenKey(b);
}

// 用“固定周期”规则检查是否存在另一个合理答案
function checkAmbiguous(q) {
  const len = q.cells.length;
  const target = q.type === 'missing' ? q.cells.findIndex((t) => !t) : len;
  if (target < 0) return;
  const known = q.cells.map((t, i) => ({ t, i })).filter((x) => x.t);
  for (let p = 1; p <= 4; p++) {
    if (p >= len) break;
    const byMod = new Map();
    let ok = true;
    for (const { t, i } of known) {
      const m = i % p;
      if (byMod.has(m)) {
        if (!sameToken(byMod.get(m), t)) {
          ok = false;
          break;
        }
      } else {
        byMod.set(m, t);
      }
    }
    if (!ok) continue;
    const predicted = byMod.get(target % p);
    if (!predicted) continue;
    if (!sameToken(predicted, q.options[q.answer])) {
      const idx = q.options.findIndex((o) => sameToken(o, predicted));
      if (idx >= 0 && idx !== q.answer) {
        throw new Error(`Q${q.id} 存在歧义：周期 ${p} 会得到另一个选项`);
      }
    }
  }
}

function validate(q) {
  if (q.options.length !== 4) throw new Error(`Q${q.id} 选项数不是 4`);
  const keys = new Set(q.options.map(tokenKey));
  if (keys.size !== 4) throw new Error(`Q${q.id} 选项重复`);
  if (q.answer < 0 || q.answer > 3) throw new Error(`Q${q.id} 答案下标错误`);
  if (q.type === 'missing') {
    const nulls = q.cells.filter((t) => !t).length;
    if (nulls !== 1) throw new Error(`Q${q.id} 缺失格数量错误`);
  }
  const all = [...q.cells.filter(Boolean), ...q.options];
  for (const t of all) {
    if (!ALL_SHAPES.includes(t.s)) throw new Error(`Q${q.id} 未知形状 ${t.s}`);
    if (!COLORS.includes(t.c)) throw new Error(`Q${q.id} 未知颜色 ${t.c}`);
    if (t.k === 'group' && (!(t.n >= 1 && t.n <= 6))) throw new Error(`Q${q.id} 数量越界`);
    if (t.scale !== undefined && !SIZES.includes(t.scale)) throw new Error(`Q${q.id} 大小非法`);
    if (t.r !== undefined && ![0, 90, 180, 270].includes(t.r)) throw new Error(`Q${q.id} 角度非法`);
  }
  checkAmbiguous(q);
}

const BUILDERS = [
  ['abc', bABC],
  ['abb', bABB],
  ['aabb', bAABB],
  ['two-attr', bTwoAttr],
  ['growing', bGrowing],
  ['shrinking', bShrinking],
  ['size', bSizeCycle],
  ['rotation', bRotation],
  ['missing', bMissing],
  ['shape-size', bShapeSize],
];

function signature(q) {
  return JSON.stringify([q.type, q.cells, q.options, q.answer]);
}

const buckets = new Map();
const used = new Set();
let nextId = 1;

for (const [tag, builder] of BUILDERS) {
  const list = [];
  let guard = 0;
  let failures = 0;
  while (list.length < 10) {
    if (++guard > 2000) throw new Error(`生成 ${tag} 题目失败`);
    const def = builder();
    const q = finalize(def, nextId);
    try {
      validate(q);
    } catch (e) {
      failures++;
      if (failures <= 3) console.warn('  跳过: ' + String(e.message));
      continue;
    }
    const sig = signature(q);
    if (used.has(sig)) continue;
    used.add(sig);
    nextId++;
    list.push(q);
  }
  buckets.set(tag, list);
  console.log(`✔ ${tag.padEnd(11)} 10 题`);
}

// 打散：每轮 10 个类别各出 1 题，保证题型交替出现
const questions = [];
for (let round = 0; round < 10; round++) {
  for (const [tag] of BUILDERS) {
    questions.push(buckets.get(tag)[round]);
  }
}
questions.forEach((q, i) => (q.id = i + 1));

if (questions.length !== 100) throw new Error('题目数量不是 100');

const out = `// 由 tools/gen-questions.mjs 自动生成，请勿手改\nwindow.QUESTIONS = ${JSON.stringify(questions, null, 2)};\n`;
fs.writeFileSync(path.join(ROOT, 'questions.js'), out);
console.log(`\n已写入 questions.js：${questions.length} 题，${(out.length / 1024).toFixed(1)} KB`);

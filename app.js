/* 图形规律大挑战 · 游戏逻辑 */
(() => {
  'use strict';

  const QUESTIONS = window.QUESTIONS || [];
  const SAVE_KEY = 'shape-pattern-save-v1';
  const SOUND_KEY = 'shape-pattern-sound-v1';

  const COLORS = {
    red: '#ef4444',
    blue: '#3b82f6',
    amber: '#f59e0b',
    green: '#22c55e',
    purple: '#a855f7',
    pink: '#ec4899',
    orange: '#f97316',
    teal: '#14b8a6',
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  /* ---------------- 图形 SVG ---------------- */
  function polygonPoints(n, radius = 44, cx = 50, cy = 52, start = -Math.PI / 2) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = start + (i * 2 * Math.PI) / n;
      pts.push(`${(cx + radius * Math.cos(a)).toFixed(1)},${(cy + radius * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
  }

  function starPoints() {
    const pts = [];
    const R = 45;
    const r = 18;
    const cx = 50;
    const cy = 52;
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? R : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(`${(cx + rad * Math.cos(a)).toFixed(1)},${(cy + rad * Math.sin(a)).toFixed(1)}`);
    }
    return pts.join(' ');
  }

  const OUTLINE = 'rgba(30,41,59,0.16)';

  function shapeBody(name, color) {
    const common = `fill="${color}" stroke="${OUTLINE}" stroke-width="2"`;
    switch (name) {
      case 'circle':
        return `<circle cx="50" cy="50" r="38" ${common}/>`;
      case 'square':
        return `<rect x="13" y="13" width="74" height="74" rx="14" ${common}/>`;
      case 'triangle':
        return `<path d="M50 9 L91 88 L9 88 Z" ${common} stroke-linejoin="round"/>`;
      case 'star':
        return `<polygon points="${starPoints()}" ${common} stroke-linejoin="round"/>`;
      case 'heart':
        return `<path d="M50 88C24 70 9 54 9 36 9 22 20 12 33 12c8 0 14 4 17 10 3-6 9-10 17-10 13 0 24 10 24 24 0 18-15 34-41 52Z" ${common} stroke-linejoin="round"/>`;
      case 'diamond':
        return `<polygon points="50,5 92,50 50,95 8,50" ${common} stroke-linejoin="round"/>`;
      case 'pentagon':
        return `<polygon points="${polygonPoints(5)}" ${common} stroke-linejoin="round"/>`;
      case 'hexagon':
        return `<polygon points="${polygonPoints(6, 44, 50, 51, 0)}" ${common} stroke-linejoin="round"/>`;
      case 'arrow':
        return `<path d="M50 5 L89 47 L64 47 L64 94 L36 94 L36 47 L11 47 Z" ${common} stroke-linejoin="round"/>`;
      default:
        return `<circle cx="50" cy="50" r="38" ${common}/>`;
    }
  }

  const GROUP_LAYOUT = {
    1: { pts: [[50, 50]], s: 0.55 },
    2: { pts: [[29, 50], [71, 50]], s: 0.38 },
    3: { pts: [[20, 50], [50, 50], [80, 50]], s: 0.31 },
    4: { pts: [[30, 30], [70, 30], [30, 70], [70, 70]], s: 0.31 },
    5: { pts: [[20, 30], [50, 30], [80, 30], [35, 70], [65, 70]], s: 0.28 },
    6: { pts: [[20, 30], [50, 30], [80, 30], [20, 70], [50, 70], [80, 70]], s: 0.28 },
  };

  function tokenSVG(t) {
    const color = COLORS[t.c] || '#64748b';
    let inner = '';

    if (t.k === 'group') {
      const layout = GROUP_LAYOUT[Math.max(1, Math.min(6, t.n))] || GROUP_LAYOUT[1];
      inner = layout.pts
        .map(([x, y]) => {
          const s = layout.s;
          return `<g transform="translate(${(x - 50 * s).toFixed(2)} ${(y - 50 * s).toFixed(2)}) scale(${s})">${shapeBody(t.s, color)}</g>`;
        })
        .join('');
    } else {
      const s = t.scale || 1;
      const tx = (50 * (1 - s)).toFixed(2);
      const ty = (50 * (1 - s)).toFixed(2);
      const rot = t.r ? `rotate(${t.r} 50 50) ` : '';
      inner = `<g transform="${rot}translate(${tx} ${ty}) scale(${s})">${shapeBody(t.s, color)}</g>`;
    }

    return `<svg class="shape" viewBox="0 0 100 100" aria-hidden="true">${inner}</svg>`;
  }

  /* ---------------- 状态 ---------------- */
  const state = {
    list: [],
    idx: 0,
    score: 0,
    answers: [],
    locked: false,
    timer: null,
    startTs: 0,
    mode: 'full',
  };

  /* ---------------- 音效 ---------------- */
  let soundOn = localStorage.getItem(SOUND_KEY) !== '0';
  let audioCtx = null;

  function refreshSoundBtn() {
    const btn = $('#btn-sound');
    if (!btn) return;
    btn.textContent = soundOn ? '🔊' : '🔇';
    btn.setAttribute('aria-pressed', String(soundOn));
  }

  function beep(freq, dur = 0.12, type = 'sine', delay = 0, gain = 0.05) {
    if (!soundOn) return;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return;
      if (!audioCtx) audioCtx = new Ctx();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const t = audioCtx.currentTime + delay;
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = type;
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(gain, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      osc.connect(g).connect(audioCtx.destination);
      osc.start(t);
      osc.stop(t + dur + 0.03);
    } catch (e) {
      /* 忽略音频异常 */
    }
  }

  const playCorrect = () => {
    beep(659, 0.1, 'sine', 0);
    beep(880, 0.14, 'sine', 0.09);
  };
  const playWrong = () => {
    beep(220, 0.16, 'square', 0, 0.03);
    beep(170, 0.2, 'square', 0.13, 0.03);
  };

  /* ---------------- 屏幕切换 ---------------- */
  const screens = {
    start: $('#screen-start'),
    game: $('#screen-game'),
    end: $('#screen-end'),
  };

  function showScreen(name) {
    Object.entries(screens).forEach(([key, el]) => el.classList.toggle('active', key === name));
    $('#btn-exit').classList.toggle('hidden', name !== 'game');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- 首页 ---------------- */
  function renderHero() {
    const seq = [
      { k: 'shape', s: 'circle', c: 'red' },
      { k: 'shape', s: 'square', c: 'blue' },
      { k: 'shape', s: 'triangle', c: 'amber' },
      { k: 'shape', s: 'circle', c: 'red' },
      { k: 'shape', s: 'square', c: 'blue' },
    ];
    $('#hero-pattern').innerHTML =
      seq.map((t) => `<div class="cell">${tokenSVG(t)}</div>`).join('') +
      '<div class="cell cell-missing"><span class="qmark">?</span></div>';
  }

  function readSave() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (!data || !Array.isArray(data.answers)) return null;
      const answers = data.answers.filter((a) => QUESTIONS.some((q) => q.id === a.id));
      if (!answers.length) return null;
      return {
        answers,
        elapsed: Number(data.elapsed) || 0,
        idx: Math.min(answers.length, QUESTIONS.length),
      };
    } catch (e) {
      return null;
    }
  }

  function refreshStart() {
    const saved = readSave();
    if (saved && saved.idx >= QUESTIONS.length) localStorage.removeItem(SAVE_KEY);
    const hasSave = Boolean(saved && saved.idx < QUESTIONS.length);
    const continueBtn = $('#btn-continue');
    continueBtn.classList.toggle('hidden', !hasSave);
    $('#btn-start').textContent = hasSave ? '重新开始' : '开始挑战';
    if (hasSave) {
      const right = saved.answers.filter((a) => a.correct).length;
      continueBtn.textContent = `继续上次（第 ${saved.idx + 1} 题）`;
      $('#save-hint').textContent = `已保存进度：答对 ${right} 题`;
    } else {
      $('#save-hint').textContent = '';
    }
  }

  /* ---------------- 保存进度 ---------------- */
  function saveGame() {
    if (state.mode !== 'full') return;
    if (!state.answers.length) {
      localStorage.removeItem(SAVE_KEY);
      return;
    }
    try {
      localStorage.setItem(
        SAVE_KEY,
        JSON.stringify({
          v: 1,
          idx: state.idx,
          answers: state.answers,
          elapsed: Date.now() - state.startTs,
        })
      );
    } catch (e) {
      /* localStorage 不可用时静默失败 */
    }
  }

  /* ---------------- 开始 / 继续 ---------------- */
  function startGame(list, mode) {
    state.list = list;
    state.mode = mode;
    state.idx = 0;
    state.score = 0;
    state.answers = [];
    state.locked = false;
    state.startTs = Date.now();
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    $('#game-mode').classList.toggle('hidden', mode !== 'practice');
    showScreen('game');
    renderQuestion();
  }

  function continueGame() {
    const saved = readSave();
    if (!saved || saved.idx >= QUESTIONS.length) return;
    state.list = QUESTIONS;
    state.mode = 'full';
    state.answers = saved.answers;
    state.score = saved.answers.filter((a) => a.correct).length;
    state.idx = saved.idx;
    state.startTs = Date.now() - saved.elapsed;
    state.locked = false;
    $('#game-mode').classList.add('hidden');
    showScreen('game');
    renderQuestion();
  }

  /* ---------------- 渲染题目 ---------------- */
  function currentQ() {
    return state.list[state.idx];
  }

  function renderQuestion() {
    const q = currentQ();
    if (!q) return finish();
    state.locked = false;

    $('#q-index').textContent = state.idx + 1;
    $('#q-total').textContent = state.list.length;
    $('#score').textContent = state.score;
    $('#prompt').textContent = q.prompt;
    $('#progress-fill').style.width = `${(state.idx / state.list.length) * 100}%`;
    $('#progress-fill').parentElement.setAttribute('aria-valuenow', String(state.idx));

    const pattern = $('#pattern');
    let html = q.cells
      .map((t) =>
        t
          ? `<div class="cell">${tokenSVG(t)}</div>`
          : '<div class="cell cell-missing"><span class="qmark">?</span></div>'
      )
      .join('');
    if (q.type === 'next') {
      html += '<div class="cell cell-missing"><span class="qmark">?</span></div>';
    }
    pattern.innerHTML = html;
    pattern.scrollLeft = 0;

    const optionsEl = $('#options');
    optionsEl.innerHTML = '';
    q.options.forEach((t, i) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'option';
      btn.dataset.index = String(i);
      btn.setAttribute('aria-label', `选项 ${i + 1}`);
      btn.innerHTML = `<span class="option-key">${i + 1}</span>${tokenSVG(t)}`;
      btn.addEventListener('click', () => choose(i));
      optionsEl.appendChild(btn);
    });

    const fb = $('#feedback');
    fb.className = 'feedback';
    fb.innerHTML = '';
  }

  /* ---------------- 作答 ---------------- */
  function choose(i) {
    if (state.locked) return;
    const q = currentQ();
    if (!q) return;
    state.locked = true;

    const right = i === q.answer;
    const btns = $$('.option');
    btns.forEach((btn, j) => {
      btn.disabled = true;
      if (j === q.answer) btn.classList.add(right ? 'correct' : 'reveal');
      else if (j === i) btn.classList.add('wrong');
    });

    const missingCell = $('#pattern .cell-missing');
    if (missingCell) {
      missingCell.classList.remove('cell-missing');
      missingCell.classList.add('cell-filled');
      missingCell.innerHTML = tokenSVG(q.options[q.answer]);
    }

    state.answers.push({ id: q.id, chosen: i, correct: right });
    if (right) state.score += 1;
    $('#score').textContent = state.score;
    $('#progress-fill').style.width = `${((state.idx + 1) / state.list.length) * 100}%`;
    $('#progress-fill').parentElement.setAttribute('aria-valuenow', String(state.idx + 1));

    const fb = $('#feedback');
    fb.classList.add('show', right ? 'good' : 'bad');
    fb.innerHTML = `
      <span class="fb-main">${right ? '🎉 答对啦！' : '💡 再想一想…'}</span>
      <span class="fb-rule">规律：${q.explain}</span>
      <button class="fb-next" type="button">下一题 →</button>
    `;
    fb.querySelector('.fb-next').addEventListener('click', advance);

    if (right) {
      playCorrect();
      burst(btns[q.answer]);
    } else {
      playWrong();
    }

    saveGame();
    state.timer = setTimeout(advance, right ? 1800 : 3500);
  }

  function advance() {
    if (!state.locked) return;
    state.locked = false;
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    state.idx += 1;
    if (state.idx >= state.list.length) {
      finish();
      return;
    }
    renderQuestion();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  /* ---------------- 结算 ---------------- */
  function fmtTime(sec) {
    const m = String(Math.floor(sec / 60)).padStart(2, '0');
    const s = String(sec % 60).padStart(2, '0');
    return `${m}:${s}`;
  }

  function miniCells(q) {
    let html = q.cells
      .map((t) =>
        t
          ? `<div class="mini-cell">${tokenSVG(t)}</div>`
          : '<div class="mini-cell mini-missing">?</div>'
      )
      .join('');
    if (q.type === 'next') html += '<div class="mini-cell mini-missing">?</div>';
    return html;
  }

  function finish() {
    if (state.mode === 'full') localStorage.removeItem(SAVE_KEY);

    const total = state.list.length;
    const correct = state.answers.filter((a) => a.correct).length;
    const rate = total ? correct / total : 0;
    const stars = rate >= 0.9 ? 3 : rate >= 0.7 ? 2 : 1;
    const elapsed = Math.max(1, Math.round((Date.now() - state.startTs) / 1000));

    $('#end-emoji').textContent = rate >= 0.9 ? '🏆' : rate >= 0.7 ? '🎉' : '💪';
    $('#end-title').textContent =
      state.mode === 'practice'
        ? '错题重练完成！'
        : rate >= 0.9
        ? '太厉害了，全部完成！'
        : '全部完成！';
    $('#end-stars').innerHTML = Array.from(
      { length: 3 },
      (_, i) => `<span class="star ${i < stars ? 'on' : ''}">★</span>`
    ).join('');
    $('#end-stats').innerHTML = `答对 <b>${correct}</b> / ${total} 题 · 正确率 <b>${Math.round(
      rate * 100
    )}%</b> · 用时 <b>${fmtTime(elapsed)}</b>`;

    const wrongs = state.answers.filter((a) => !a.correct);
    const wrongQuestions = wrongs
      .map((a) => state.list.find((q) => q.id === a.id))
      .filter(Boolean);

    const wrap = $('#review-wrap');
    const list = $('#review-list');
    if (wrongs.length) {
      wrap.classList.remove('hidden');
      $('#review-count').textContent = `（${wrongs.length} 题）`;
      list.innerHTML = wrongs
        .map((a) => {
          const q = state.list.find((x) => x.id === a.id);
          if (!q) return '';
          return `<div class="review-item">
            <div class="review-head">第 ${q.id} 题 <span>${q.explain}</span></div>
            <div class="review-body">
              <div class="mini-pattern">${miniCells(q)}</div>
              <span class="review-arrow">→</span>
              <div class="mini-cell mini-answer">${tokenSVG(q.options[q.answer])}</div>
            </div>
          </div>`;
        })
        .join('');
    } else {
      wrap.classList.add('hidden');
      list.innerHTML = '';
    }

    const practiceBtn = $('#btn-practice');
    if (wrongQuestions.length && state.mode === 'full') {
      practiceBtn.classList.remove('hidden');
      practiceBtn.textContent = `重练错题（${wrongQuestions.length}）`;
      practiceBtn.onclick = () => startGame(wrongQuestions, 'practice');
    } else {
      practiceBtn.classList.add('hidden');
    }

    $('#btn-again').onclick = () =>
      startGame(state.mode === 'full' ? QUESTIONS : state.list, state.mode);

    showScreen('end');
    if (rate >= 0.7 && state.mode === 'full') confetti();
  }

  /* ---------------- 小特效 ---------------- */
  function burst(el) {
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const icons = ['⭐', '✨', '🎉'];
    for (let i = 0; i < 14; i++) {
      const p = document.createElement('span');
      p.className = 'spark';
      p.textContent = icons[i % icons.length];
      p.style.left = `${rect.left + rect.width / 2}px`;
      p.style.top = `${rect.top + rect.height / 2}px`;
      const ang = (Math.PI * 2 * i) / 14;
      const dist = 40 + Math.random() * 55;
      p.style.setProperty('--dx', `${Math.cos(ang) * dist}px`);
      p.style.setProperty('--dy', `${Math.sin(ang) * dist}px`);
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 750);
    }
  }

  function confetti() {
    const palette = ['#ef4444', '#3b82f6', '#f59e0b', '#22c55e', '#a855f7', '#ec4899'];
    for (let i = 0; i < 70; i++) {
      const el = document.createElement('span');
      el.className = 'confetti';
      el.style.left = `${Math.random() * 100}vw`;
      el.style.background = palette[i % palette.length];
      el.style.setProperty('--dur', `${1.8 + Math.random() * 1.6}s`);
      el.style.animationDelay = `${Math.random() * 0.6}s`;
      el.style.width = `${6 + Math.random() * 6}px`;
      el.style.height = `${9 + Math.random() * 8}px`;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 4600);
    }
  }

  /* ---------------- 事件绑定 ---------------- */
  $('#btn-sound').addEventListener('click', () => {
    soundOn = !soundOn;
    localStorage.setItem(SOUND_KEY, soundOn ? '1' : '0');
    refreshSoundBtn();
    if (soundOn) beep(720, 0.07, 'sine', 0, 0.035);
  });

  $('#btn-exit').addEventListener('click', () => {
    if (state.timer) {
      clearTimeout(state.timer);
      state.timer = null;
    }
    state.locked = false;
    if (state.mode === 'full') saveGame();
    state.mode = 'full';
    showScreen('start');
    refreshStart();
  });

  $('#btn-start').addEventListener('click', () => startGame(QUESTIONS, 'full'));
  $('#btn-continue').addEventListener('click', continueGame);
  $('#btn-home').addEventListener('click', () => {
    state.mode = 'full';
    state.list = [];
    showScreen('start');
    refreshStart();
  });

  document.addEventListener('keydown', (e) => {
    if (!screens.game.classList.contains('active')) return;
    const n = Number(e.key);
    if (n >= 1 && n <= 4 && !state.locked) {
      const btn = $$('.option')[n - 1];
      if (btn) btn.click();
    }
  });

  window.addEventListener('beforeunload', () => {
    if (screens.game.classList.contains('active')) saveGame();
  });

  /* ---------------- 初始化 ---------------- */
  if (!QUESTIONS.length) {
    document.body.innerHTML =
      '<p class="noscript">题库加载失败，请确认 questions.js 与 index.html 在同一目录。</p>';
    return;
  }

  renderHero();
  refreshSoundBtn();
  refreshStart();
  showScreen('start');
})();

const STORAGE_KEY = 'ff4_ginmi_counts_v1';
const MAX_LEVEL = 99;
const BASE_LEVEL = 70;
const STAT_ORDER = ['力', '素早さ', '体力', '知性', '精神'];
const PATTERN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];

function loadCounts() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveCounts(all) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
}

function getCounts(all, char) {
  if (all[char.name]) return all[char.name];
  return char.initialCounts.slice();
}

function currentLevel(counts) {
  const sum = counts.reduce((a, b) => a + (Number(b) || 0), 0);
  return BASE_LEVEL + sum;
}

function statValue(char, statName, counts) {
  const s = char.stats[statName];
  let v = s.lv70;
  char.patterns.forEach((letter, i) => {
    const idx = letter.charCodeAt(0) - 65; // A=0..H=7
    v += (Number(counts[i]) || 0) * s.deltas[idx];
  });
  return v;
}

function detectPattern(char, selections) {
  // selections: array of 5 numbers in STAT_ORDER order
  const matches = [];
  for (let i = 0; i < 8; i++) {
    const ok = STAT_ORDER.every((sname, si) => char.stats[sname].deltas[i] === selections[si]);
    if (ok) matches.push(PATTERN_LETTERS[i]);
  }
  return matches; // usually 0 or 1 entries; could be >1 if a character has duplicate rows
}

function render() {
  const all = loadCounts();
  const listEl = document.getElementById('char-list');
  const summaryEl = document.getElementById('summary');
  listEl.innerHTML = '';

  const rows = CHAR_DATA.map(char => {
    const counts = getCounts(all, char);
    const lv = currentLevel(counts);
    const remain = MAX_LEVEL - lv;
    const pct = Math.round(((lv - BASE_LEVEL) / (MAX_LEVEL - BASE_LEVEL)) * 100);
    const targetCount = char.patterns.length;
    const expectedTries = remain > 0 ? Math.round((remain * 8) / targetCount) : 0;
    const achieved = Object.keys(char.stats).filter(s => statValue(char, s, counts) >= char.stats[s].target).length;
    return { char, counts, lv, remain, pct, expectedTries, achieved };
  });

  // summary
  const sorted = [...rows].sort((a, b) => a.expectedTries - b.expectedTries);
  let summaryHtml = '<h2>優先度（試行回数が少ない順）</h2>';
  sorted.forEach(r => {
    summaryHtml += `
      <div class="summary-row">
        <div class="s-name">${r.char.name}</div>
        <div class="s-bar"><div class="s-bar-fill" style="width:${r.pct}%"></div></div>
        <div class="s-pct">${r.pct}%</div>
        <div class="s-tries">${r.remain > 0 ? '残り' + r.expectedTries + '回' : '完了'}</div>
      </div>`;
  });
  summaryEl.innerHTML = summaryHtml;

  // cards in original order
  rows.forEach(r => {
    const { char, counts, lv, remain, pct, expectedTries, achieved } = r;
    const card = document.createElement('div');
    card.className = 'char-card';

    let patternHtml = '';
    char.patterns.forEach((letter, i) => {
      patternHtml += `
        <div class="pattern-input">
          <label>パターン<span class="letter">${letter}</span></label>
          <input type="number" inputmode="numeric" min="0" max="29"
                 data-char="${char.name}" data-idx="${i}" value="${counts[i]}">
        </div>`;
    });

    let statHtml = '';
    Object.keys(char.stats).forEach(sname => {
      const s = char.stats[sname];
      const val = statValue(char, sname, counts);
      const done = val >= s.target;
      statHtml += `
        <div class="stat-row ${done ? 'achieved' : ''}">
          <div class="st-name">${sname}</div>
          <div class="st-val"><b>${val}</b> / ${s.target}</div>
          <div class="badge">${done ? '○' : ''}</div>
          <div class="st-equip">${s.equip || ''}</div>
        </div>`;
    });

    card.innerHTML = `
      <div class="char-head">
        <div class="name">${char.name}</div>
        <div class="lv">現在Lv <b>${lv}</b> ${remain > 0 ? '（残り' + remain + '）' : '（達成）'}</div>
      </div>
      <div class="progress-wrap">
        <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
        <div class="progress-meta">
          <span>${pct}%</span>
          <span>${remain > 0 ? '期待残り試行 ' + expectedTries + '回' : '達成済み'}</span>
        </div>
      </div>
      <div class="pattern-inputs">${patternHtml}</div>
      <details class="pattern-detect">
        <summary>パターン判定ツール</summary>
        <p class="detect-help">レベルアップ直後の増加量を選んでください</p>
        <div class="detect-grid">
          ${STAT_ORDER.map(sname => `
            <div class="detect-item">
              <label>${sname}</label>
              <select class="detect-select" data-char="${char.name}" data-stat="${sname}">
                <option value="">-</option>
                <option value="-1">-1</option>
                <option value="0">0</option>
                <option value="1">+1</option>
                <option value="2">+2</option>
                <option value="3">+3</option>
              </select>
            </div>`).join('')}
        </div>
        <div class="detect-result" data-char-result="${char.name}"></div>
      </details>
      <details class="stat-detail">
        <summary>ステータス詳細（達成 ${achieved}/5）</summary>
        <div class="stat-table">${statHtml}</div>
      </details>
      <div class="char-foot">
        <span></span>
        <button class="reset-char-btn" data-char="${char.name}">この初期値に戻す</button>
      </div>
    `;
    listEl.appendChild(card);
  });

  // wire inputs
  listEl.querySelectorAll('input[type=number]').forEach(inp => {
    inp.addEventListener('input', () => {
      const all2 = loadCounts();
      const charName = inp.dataset.char;
      const idx = Number(inp.dataset.idx);
      const char = CHAR_DATA.find(c => c.name === charName);
      const counts = getCounts(all2, char);
      let v = parseInt(inp.value, 10);
      if (isNaN(v) || v < 0) v = 0;
      if (v > 29) v = 29;
      counts[idx] = v;
      all2[charName] = counts;
      saveCounts(all2);
      render();
    });
  });

  listEl.querySelectorAll('.reset-char-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const all2 = loadCounts();
      delete all2[btn.dataset.char];
      saveCounts(all2);
      render();
    });
  });

  // pattern detection tool
  function updateDetectResult(charName) {
    const char = CHAR_DATA.find(c => c.name === charName);
    const selects = listEl.querySelectorAll(`.detect-select[data-char="${CSS.escape(charName)}"]`);
    const resultEl = listEl.querySelector(`.detect-result[data-char-result="${CSS.escape(charName)}"]`);
    const values = [];
    let allFilled = true;
    selects.forEach(sel => {
      if (sel.value === '') { allFilled = false; return; }
      values[STAT_ORDER.indexOf(sel.dataset.stat)] = Number(sel.value);
    });
    if (!allFilled) {
      resultEl.innerHTML = '';
      return;
    }
    const matches = detectPattern(char, values);
    if (matches.length === 0) {
      resultEl.innerHTML = `<div class="detect-none">一致するパターンが見つかりません（入力を確認してください）</div>`;
    } else {
      const letter = matches[0];
      const isTarget = char.patterns.includes(letter);
      if (isTarget) {
        const idx = char.patterns.indexOf(letter);
        resultEl.innerHTML = `
          <div class="detect-hit target">
            <span class="letter-big">${letter}</span> パターン ・ 採用対象です
            <button class="adopt-btn" data-char="${charName}" data-idx="${idx}">回数+1して採用</button>
          </div>`;
      } else {
        resultEl.innerHTML = `
          <div class="detect-hit reject">
            <span class="letter-big">${letter}</span> パターン ・ 対象外 → リセットしてやり直してください
          </div>`;
      }
    }
  }

  listEl.querySelectorAll('.detect-select').forEach(sel => {
    sel.addEventListener('change', () => updateDetectResult(sel.dataset.char));
  });

  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.adopt-btn');
    if (!btn) return;
    const all2 = loadCounts();
    const charName = btn.dataset.char;
    const idx = Number(btn.dataset.idx);
    const char = CHAR_DATA.find(c => c.name === charName);
    const counts = getCounts(all2, char);
    counts[idx] = (Number(counts[idx]) || 0) + 1;
    all2[charName] = counts;
    saveCounts(all2);
    render();
  });
}

document.getElementById('reset-all-btn').addEventListener('click', () => {
  if (confirm('全キャラの入力をリセットしますか？')) {
    localStorage.removeItem(STORAGE_KEY);
    render();
  }
});

render();

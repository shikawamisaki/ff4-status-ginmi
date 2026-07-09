const STORAGE_KEY = 'ff4_ginmi_counts_v1';
const MAX_LEVEL = 99;
const BASE_LEVEL = 70;

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
}

document.getElementById('reset-all-btn').addEventListener('click', () => {
  if (confirm('全キャラの入力をリセットしますか？')) {
    localStorage.removeItem(STORAGE_KEY);
    render();
  }
});

render();

const STORAGE_KEY = 'ff4_ginmi_counts_v1';
const EQUIP_STORAGE_KEY = 'ff4_ginmi_equip_v1';
const MAX_LEVEL = 99;
const BASE_LEVEL = 70;
const STAT_ORDER = ['力', '素早さ', '体力', '知性', '精神'];
const PATTERN_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
const EQUIP_SLOTS = ['右手', '左手', '頭', '体', '腕'];

function emptyEquipSlots() {
  return EQUIP_SLOTS.map(() => ({
    name: '',
    bonus: { 力: 0, 素早さ: 0, 体力: 0, 知性: 0, 精神: 0 },
  }));
}

function loadEquip() {
  try {
    return JSON.parse(localStorage.getItem(EQUIP_STORAGE_KEY)) || {};
  } catch (e) {
    return {};
  }
}

function saveEquip(all) {
  localStorage.setItem(EQUIP_STORAGE_KEY, JSON.stringify(all));
}

function getEquip(all, char) {
  if (all[char.name]) return all[char.name];
  return emptyEquipSlots();
}

function equipBonusTotal(equipSlots, statName) {
  return equipSlots.reduce((sum, slot) => sum + (Number(slot.bonus[statName]) || 0), 0);
}

function findItemMatch(text) {
  const t = text.trim();
  if (t.length < 2) return null;
  if (ITEM_DB[t]) return ITEM_DB[t];
  const matches = Object.keys(ITEM_DB).filter(k => k.includes(t) || t.includes(k));
  if (matches.length === 1) return ITEM_DB[matches[0]];
  return null;
}

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
  const allEquip = loadEquip();
  const listEl = document.getElementById('char-list');
  const summaryEl = document.getElementById('summary');

  const openState = {};
  listEl.querySelectorAll('details[data-details-key]').forEach(d => {
    openState[d.dataset.detailsKey] = d.open;
  });

  listEl.innerHTML = '';

  const rows = CHAR_DATA.map(char => {
    const counts = getCounts(all, char);
    const equip = getEquip(allEquip, char);
    const lv = currentLevel(counts);
    const remain = MAX_LEVEL - lv;
    const pct = Math.round(((lv - BASE_LEVEL) / (MAX_LEVEL - BASE_LEVEL)) * 100);
    const achieved = Object.keys(char.stats).filter(s => {
      const total = statValue(char, s, counts) + equipBonusTotal(equip, s);
      return total >= char.stats[s].target;
    }).length;
    return { char, counts, equip, lv, remain, pct, achieved };
  });

  // summary
  let summaryHtml = '<h2>進捗一覧</h2>';
  rows.forEach(r => {
    summaryHtml += `
      <div class="summary-row">
        <div class="s-name">${r.char.name}</div>
        <div class="s-bar"><div class="s-bar-fill" style="width:${r.pct}%"></div></div>
        <div class="s-pct">${r.pct}%</div>
        <div class="s-tries">${r.remain > 0 ? '残り' + r.remain : '完了'}</div>
      </div>`;
  });
  summaryEl.innerHTML = summaryHtml;

  // cards in original order
  rows.forEach(r => {
    const { char, counts, equip, lv, remain, pct, achieved } = r;
    const card = document.createElement('div');
    card.className = 'char-card';

    let patternHtml = '';
    char.patterns.forEach((letter, i) => {
      patternHtml += `
        <div class="pattern-input">
          <label>パターン<span class="letter">${letter}</span></label>
          <div class="stepper">
            <button type="button" class="step-btn minus" data-char="${char.name}" data-idx="${i}">−</button>
            <span class="step-value" data-char="${char.name}" data-idx="${i}">${counts[i]}</span>
            <button type="button" class="step-btn plus" data-char="${char.name}" data-idx="${i}">+</button>
          </div>
        </div>`;
    });

    let statHtml = '';
    Object.keys(char.stats).forEach(sname => {
      const s = char.stats[sname];
      const base = statValue(char, sname, counts);
      const bonus = equipBonusTotal(equip, sname);
      const total = Math.min(99, base + bonus);
      const done = total >= s.target;
      statHtml += `
        <div class="stat-row ${done ? 'achieved' : ''}" data-stat-row="${char.name}::${sname}">
          <div class="st-name">${sname}</div>
          <div class="st-val"><b class="st-val-num">${total}</b> / ${s.target} ${bonus ? '<span class="st-bonus">(素' + base + ' +' + bonus + ')</span>' : ''}</div>
          <div class="badge">${done ? '○' : ''}</div>
        </div>`;
    });

    let equipHtml = '';
    EQUIP_SLOTS.forEach((slotLabel, si) => {
      const slot = equip[si];
      const initialMatch = slot.name ? findItemMatch(slot.name) : null;
      const matchText = initialMatch ? '一致：登録済み装備'
        : (slot.name && slot.name.trim().length >= 2 ? '未登録（補正値を手入力できます）' : '');
      equipHtml += `
        <div class="equip-slot">
          <div class="equip-slot-head">
            <span class="equip-slot-label">${slotLabel}</span>
            <input type="text" class="equip-name" placeholder="アイテム名（例：英雄の盾）"
                   data-char="${char.name}" data-slot="${si}" value="${slot.name || ''}">
          </div>
          <div class="equip-match${initialMatch ? ' matched' : ''}" data-char="${char.name}" data-slot="${si}">${matchText}</div>
          <div class="equip-bonus-grid">
            ${STAT_ORDER.map(sname => `
              <div class="equip-bonus-item">
                <label>${sname}</label>
                <input type="number" inputmode="numeric" class="equip-bonus"
                       data-char="${char.name}" data-slot="${si}" data-stat="${sname}"
                       value="${slot.bonus[sname] || 0}">
              </div>`).join('')}
          </div>
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
          <span>${remain > 0 ? '残り' + remain + 'Lv' : '達成済み'}</span>
        </div>
      </div>
      <div class="pattern-inputs">${patternHtml}</div>
      <details class="pattern-detect" data-details-key="${char.name}-detect">
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
      <details class="equip-detail" data-details-key="${char.name}-equip">
        <summary>装備補正</summary>
        <p class="detect-help">今の装備を右手・左手・頭・体・腕の順で入力してください</p>
        ${equipHtml}
      </details>
      <details class="stat-detail" data-details-key="${char.name}-stat">
        <summary>ステータス詳細（達成 <span class="achieved-count" data-achieved-for="${char.name}">${achieved}</span>/5）</summary>
        <div class="stat-table">${statHtml}</div>
      </details>
      <div class="char-foot">
        <span></span>
        <button class="reset-char-btn" data-char="${char.name}">この初期値に戻す</button>
      </div>
    `;
    listEl.appendChild(card);
  });

  listEl.querySelectorAll('details[data-details-key]').forEach(d => {
    if (openState[d.dataset.detailsKey]) d.open = true;
  });

  // wire pattern count steppers
  listEl.querySelectorAll('.step-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const all2 = loadCounts();
      const charName = btn.dataset.char;
      const idx = Number(btn.dataset.idx);
      const char = CHAR_DATA.find(c => c.name === charName);
      const counts = getCounts(all2, char);
      const delta = btn.classList.contains('plus') ? 1 : -1;
      let v = (Number(counts[idx]) || 0) + delta;
      if (v < 0) v = 0;
      if (v > 29) v = 29;
      counts[idx] = v;
      all2[charName] = counts;
      saveCounts(all2);
      render();
    });
  });

  // recompute + patch just one character's stat display, without a full re-render
  // (keeps focus on whatever input the user is still typing in)
  function refreshCharStats(charName) {
    const all2 = loadCounts();
    const allEquip2 = loadEquip();
    const char = CHAR_DATA.find(c => c.name === charName);
    const counts = getCounts(all2, char);
    const equip = getEquip(allEquip2, char);
    let achievedCount = 0;
    STAT_ORDER.forEach(sname => {
      const s = char.stats[sname];
      const base = statValue(char, sname, counts);
      const bonus = equipBonusTotal(equip, sname);
      const total = Math.min(99, base + bonus);
      const done = total >= s.target;
      if (done) achievedCount++;
      const row = listEl.querySelector(`[data-stat-row="${CSS.escape(charName + '::' + sname)}"]`);
      if (!row) return;
      row.classList.toggle('achieved', done);
      row.querySelector('.st-val-num').textContent = total;
      let bonusEl = row.querySelector('.st-bonus');
      if (bonus) {
        const txt = `(素${base} +${bonus})`;
        if (bonusEl) {
          bonusEl.textContent = txt;
        } else {
          bonusEl = document.createElement('span');
          bonusEl.className = 'st-bonus';
          bonusEl.textContent = txt;
          row.querySelector('.st-val').appendChild(bonusEl);
        }
      } else if (bonusEl) {
        bonusEl.remove();
      }
      row.querySelector('.badge').textContent = done ? '○' : '';
    });
    const achievedEl = listEl.querySelector(`[data-achieved-for="${CSS.escape(charName)}"]`);
    if (achievedEl) achievedEl.textContent = achievedCount;
  }

  // wire equipment inputs
  listEl.querySelectorAll('.equip-name').forEach(inp => {
    inp.addEventListener('input', () => {
      const allEquip2 = loadEquip();
      const charName = inp.dataset.char;
      const slotIdx = Number(inp.dataset.slot);
      const char = CHAR_DATA.find(c => c.name === charName);
      const equip = getEquip(allEquip2, char);
      equip[slotIdx].name = inp.value;

      const matched = findItemMatch(inp.value);
      const matchEl = listEl.querySelector(`.equip-match[data-char="${CSS.escape(charName)}"][data-slot="${slotIdx}"]`);
      if (matched) {
        equip[slotIdx].bonus = { ...matched };
        STAT_ORDER.forEach(sname => {
          const bonusInp = listEl.querySelector(
            `.equip-bonus[data-char="${CSS.escape(charName)}"][data-slot="${slotIdx}"][data-stat="${sname}"]`);
          if (bonusInp) bonusInp.value = matched[sname];
        });
        if (matchEl) {
          matchEl.textContent = '一致：登録済み装備';
          matchEl.classList.add('matched');
        }
      } else if (matchEl) {
        matchEl.textContent = inp.value.trim().length >= 2 ? '未登録（補正値を手入力できます）' : '';
        matchEl.classList.remove('matched');
      }

      allEquip2[charName] = equip;
      saveEquip(allEquip2);
      refreshCharStats(charName);
    });
  });

  listEl.querySelectorAll('.equip-bonus').forEach(inp => {
    inp.addEventListener('input', () => {
      const allEquip2 = loadEquip();
      const charName = inp.dataset.char;
      const slotIdx = Number(inp.dataset.slot);
      const stat = inp.dataset.stat;
      const char = CHAR_DATA.find(c => c.name === charName);
      const equip = getEquip(allEquip2, char);
      let v = parseInt(inp.value, 10);
      if (isNaN(v)) v = 0;
      equip[slotIdx].bonus[stat] = v;
      allEquip2[charName] = equip;
      saveEquip(allEquip2);
      refreshCharStats(charName);
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

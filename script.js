/**
 * D&D 5e Character Sheet — script.js
 * Auto-calculations, localStorage persistence, import/export, UI logic.
 */

/* ============================================================
   CONSTANTS
   ============================================================ */
const WEAPON_ROWS   = 8;
const SPELL_ROWS    = 35;
const SPELL_LEVELS  = 9;
const LS_KEY        = 'dnd5e_char_sheet';

/* Spell slot totals per level per character level (5e standard).
   Index 0 is an unused placeholder so that array index matches character level (1–20). */
const SPELL_SLOT_TABLE = [
//  level:  1   2   3   4   5   6   7   8   9
  [0, 0, 0, 0, 0, 0, 0, 0, 0], // index 0 — unused placeholder
  [2, 0, 0, 0, 0, 0, 0, 0, 0], // char level 1
  [3, 0, 0, 0, 0, 0, 0, 0, 0], // 2
  [4, 2, 0, 0, 0, 0, 0, 0, 0], // 3
  [4, 3, 0, 0, 0, 0, 0, 0, 0], // 4
  [4, 3, 2, 0, 0, 0, 0, 0, 0], // 5
  [4, 3, 3, 0, 0, 0, 0, 0, 0], // 6
  [4, 3, 3, 1, 0, 0, 0, 0, 0], // 7
  [4, 3, 3, 2, 0, 0, 0, 0, 0], // 8
  [4, 3, 3, 3, 1, 0, 0, 0, 0], // 9
  [4, 3, 3, 3, 2, 0, 0, 0, 0], // 10
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // 11
  [4, 3, 3, 3, 2, 1, 0, 0, 0], // 12
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // 13
  [4, 3, 3, 3, 2, 1, 1, 0, 0], // 14
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // 15
  [4, 3, 3, 3, 2, 1, 1, 1, 0], // 16
  [4, 3, 3, 3, 2, 1, 1, 1, 1], // 17
  [4, 3, 3, 3, 3, 1, 1, 1, 1], // 18
  [4, 3, 3, 3, 3, 2, 1, 1, 1], // 19
  [4, 3, 3, 3, 3, 2, 2, 1, 1], // 20
];

/* ============================================================
   DOM READY
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  buildDynamicTables();
  loadFromStorage();
  recalcAll();
  bindEvents();
  updateThemeButton();
  initDiceRoller();
});

/* ============================================================
   BUILD DYNAMIC TABLE ROWS
   ============================================================ */
function buildDynamicTables() {
  // Weapons table rows
  const wTbody = document.getElementById('weapons-tbody');
  for (let i = 0; i < WEAPON_ROWS; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" data-key="wpnName${i}" placeholder="Weapon name" /></td>
      <td><input type="text" data-key="wpnAtk${i}" placeholder="+0 / DC 12" /></td>
      <td><input type="text" data-key="wpnDmg${i}" placeholder="1d8+3 slashing" /></td>
      <td><input type="text" data-key="wpnNotes${i}" placeholder="Notes…" /></td>
    `;
    wTbody.appendChild(tr);
  }

  // Spell slots rows
  const ssTbody = document.getElementById('spell-slots-tbody');
  for (let lvl = 1; lvl <= SPELL_LEVELS; lvl++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td class="level-label">${lvl}${ordinal(lvl)}</td>
      <td><input type="number" data-key="spellSlotTotal${lvl}" min="0" max="9" value="0" style="width:45px;text-align:center" /></td>
      <td id="slot-diamonds-${lvl}" class="slot-diamonds-cell"></td>
    `;
    ssTbody.appendChild(tr);
  }

  // Spell rows
  const spTbody = document.getElementById('spells-tbody');
  for (let i = 0; i < SPELL_ROWS; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" data-key="spellLvl${i}" style="width:30px" placeholder="C" /></td>
      <td><input type="text" data-key="spellName${i}" placeholder="Spell name" /></td>
      <td><input type="text" data-key="spellCastTime${i}" placeholder="1 action" /></td>
      <td><input type="text" data-key="spellRange${i}" placeholder="60 ft." /></td>
      <td style="text-align:center">
        <label class="checkbox-label"><input type="checkbox" data-key="spellConc${i}" /><span class="check-mark small"></span></label>
      </td>
      <td style="text-align:center">
        <label class="checkbox-label"><input type="checkbox" data-key="spellRitual${i}" /><span class="check-mark small"></span></label>
      </td>
      <td style="text-align:center">
        <label class="checkbox-label"><input type="checkbox" data-key="spellMaterial${i}" /><span class="check-mark small"></span></label>
      </td>
      <td><input type="text" data-key="spellNotes${i}" placeholder="Notes…" /></td>
    `;
    spTbody.appendChild(tr);
  }
}

function ordinal(n) {
  // Special case for teens (11th, 12th, 13th) before checking last digit
  if (n % 100 >= 11 && n % 100 <= 13) return `${n}th`;
  const s = ['th','st','nd','rd'];
  return `${n}${s[n % 10] || 'th'}`;
}

/* ============================================================
   AUTO-CALCULATIONS
   ============================================================ */
function abilityMod(score) {
  return Math.floor((Number(score) - 10) / 2);
}

function profBonus(level) {
  const l = Math.max(1, Math.min(20, Number(level)));
  return Math.ceil(l / 4) + 1;
}

function formatMod(n) {
  return n >= 0 ? `+${n}` : `${n}`;
}

function getScore(ability) {
  const el = document.querySelector(`[data-key="${ability}Score"]`);
  return el ? Number(el.value) : 10;
}

function isChecked(key) {
  const el = document.querySelector(`[data-key="${key}"]`);
  return el ? el.checked : false;
}

function recalcAll() {
  const level = Number(document.getElementById('level').value) || 1;
  const pb    = profBonus(level);

  // Proficiency Bonus display
  document.getElementById('prof-bonus').textContent = formatMod(pb);

  // Ability mods
  const abilities = ['str','dex','con','int','wis','cha'];
  const mods = {};
  abilities.forEach(ab => {
    const score = getScore(ab);
    mods[ab] = abilityMod(score);
    const modEl = document.getElementById(`${ab}-mod`);
    if (modEl) modEl.textContent = formatMod(mods[ab]);

    // Saving throws
    const hasProf = isChecked(`${ab}SaveProf`);
    const saveVal = mods[ab] + (hasProf ? pb : 0);
    const saveEl = document.getElementById(`${ab}-save`);
    if (saveEl) saveEl.textContent = formatMod(saveVal);
  });

  // Skill modifiers (map skill key → ability)
  const skillMap = {
    skillAthletics:     'str',
    skillAcrobatics:    'dex',
    skillSleightOfHand: 'dex',
    skillStealth:       'dex',
    skillArcana:        'int',
    skillHistory:       'int',
    skillInvestigation: 'int',
    skillNature:        'int',
    skillReligion:      'int',
    skillAnimalHandling:'wis',
    skillInsight:       'wis',
    skillMedicine:      'wis',
    skillPerception:    'wis',
    skillSurvival:      'wis',
    skillDeception:     'cha',
    skillIntimidation:  'cha',
    skillPerformance:   'cha',
    skillPersuasion:    'cha',
  };
  const skillIdMap = {
    skillAthletics:     'athletics',
    skillAcrobatics:    'acrobatics',
    skillSleightOfHand: 'sleightofhand',
    skillStealth:       'stealth',
    skillArcana:        'arcana',
    skillHistory:       'history',
    skillInvestigation: 'investigation',
    skillNature:        'nature',
    skillReligion:      'religion',
    skillAnimalHandling:'animalhandling',
    skillInsight:       'insight',
    skillMedicine:      'medicine',
    skillPerception:    'perception',
    skillSurvival:      'survival',
    skillDeception:     'deception',
    skillIntimidation:  'intimidation',
    skillPerformance:   'performance',
    skillPersuasion:    'persuasion',
  };

  let perceptionMod = mods['wis'];
  let perceptionProf = isChecked('skillPerception');

  Object.keys(skillMap).forEach(key => {
    const ab     = skillMap[key];
    const hasP   = isChecked(key);
    const modVal = mods[ab] + (hasP ? pb : 0);
    const elId   = 'mod-' + skillIdMap[key];
    const el     = document.getElementById(elId);
    if (el) el.textContent = formatMod(modVal);

    if (key === 'skillPerception') {
      perceptionMod  = mods['wis'];
      perceptionProf = hasP;
    }
  });

  // Initiative = DEX mod
  const initEl = document.getElementById('initiative');
  if (initEl) initEl.textContent = formatMod(mods['dex']);

  // Passive Perception = 10 + WIS mod + (prof if perception checked)
  const ppEl = document.getElementById('passive-perception');
  if (ppEl) ppEl.textContent = 10 + perceptionMod + (perceptionProf ? pb : 0);

  // Sanity & Honor mods (optional variant rules)
  const sanityScore = Number(document.querySelector('[data-key="sanityScore"]')?.value) || 0;
  const honorScore  = Number(document.querySelector('[data-key="honorScore"]')?.value)  || 0;
  const sanityModEl = document.getElementById('sanity-mod');
  const honorModEl  = document.getElementById('honor-mod');
  if (sanityModEl) sanityModEl.textContent = formatMod(abilityMod(sanityScore));
  if (honorModEl)  honorModEl.textContent  = formatMod(abilityMod(honorScore));

  // Spellcasting
  const spellAbilityEl = document.getElementById('spell-ability');
  const spellAbility   = spellAbilityEl ? spellAbilityEl.value : '';
  const spellModEl = document.getElementById('spell-mod');
  const spellDCEl  = document.getElementById('spell-dc');
  const spellAtkEl = document.getElementById('spell-atk');

  if (spellAbility && mods[spellAbility] !== undefined) {
    const sm = mods[spellAbility];
    if (spellModEl) spellModEl.textContent = formatMod(sm);
    if (spellDCEl)  spellDCEl.textContent  = 8 + pb + sm;
    if (spellAtkEl) spellAtkEl.textContent  = formatMod(pb + sm);
  } else {
    if (spellModEl) spellModEl.textContent = '—';
    if (spellDCEl)  spellDCEl.textContent  = '—';
    if (spellAtkEl) spellAtkEl.textContent  = '—';
  }

  // Spell slot diamonds — rebuild each level's diamonds
  for (let lvl = 1; lvl <= SPELL_LEVELS; lvl++) {
    rebuildDiamonds(lvl);
  }
}

/* ============================================================
   SPELL SLOT DIAMONDS
   ============================================================ */
function rebuildDiamonds(lvl) {
  const cell = document.getElementById(`slot-diamonds-${lvl}`);
  if (!cell) return;

  const totalInput = document.querySelector(`[data-key="spellSlotTotal${lvl}"]`);
  const total = totalInput ? Math.min(9, Math.max(0, Number(totalInput.value))) : 0;

  // Preserve existing expended data
  const savedExpended = getSlotExpended(lvl);

  cell.innerHTML = '';
  const container = document.createElement('div');
  container.className = 'slot-diamonds';

  for (let i = 0; i < total; i++) {
    const d = document.createElement('div');
    d.className = 'slot-diamond' + (i < savedExpended ? ' expended' : '');
    d.title = `Slot ${i + 1}`;
    d.addEventListener('click', () => {
      d.classList.toggle('expended');
      saveToStorage();
    });
    container.appendChild(d);
  }

  cell.appendChild(container);
}

function getSlotExpended(lvl) {
  const data = loadRaw();
  return Number(data[`spellSlotExpended${lvl}`]) || 0;
}

function countDiamondsExpended(lvl) {
  const cell = document.getElementById(`slot-diamonds-${lvl}`);
  if (!cell) return 0;
  return cell.querySelectorAll('.slot-diamond.expended').length;
}

/* ============================================================
   STORAGE
   ============================================================ */
function loadRaw() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY)) || {};
  } catch {
    return {};
  }
}

function collectAllData() {
  const data = {};

  // All inputs/selects/textareas with data-key
  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.dataset.key;
    if (el.type === 'checkbox') {
      data[key] = el.checked;
    } else {
      data[key] = el.value;
    }
  });

  // Spell slot expended diamonds
  for (let lvl = 1; lvl <= SPELL_LEVELS; lvl++) {
    data[`spellSlotExpended${lvl}`] = countDiamondsExpended(lvl);
  }

  return data;
}

function saveToStorage() {
  const data = collectAllData();
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

function loadFromStorage() {
  const data = loadRaw();
  if (!data || Object.keys(data).length === 0) return;
  applyData(data);
}

function applyData(data) {
  document.querySelectorAll('[data-key]').forEach(el => {
    const key = el.dataset.key;
    if (!(key in data)) return;

    if (el.type === 'checkbox') {
      el.checked = Boolean(data[key]);
    } else {
      el.value = data[key];
    }
  });

  // Spell slot diamonds (expended counts stored separately, rebuilt after total inputs loaded)
  for (let lvl = 1; lvl <= SPELL_LEVELS; lvl++) {
    rebuildDiamonds(lvl);
    // Re-apply expended state
    const expended = Number(data[`spellSlotExpended${lvl}`]) || 0;
    const cell = document.getElementById(`slot-diamonds-${lvl}`);
    if (cell) {
      cell.querySelectorAll('.slot-diamond').forEach((d, i) => {
        if (i < expended) d.classList.add('expended');
        else d.classList.remove('expended');
      });
    }
  }

  // Dark mode
  if (data.darkMode) {
    document.body.classList.add('dark-mode');
    updateThemeButton();
  }
}

/* ============================================================
   BIND EVENTS
   ============================================================ */
function bindEvents() {
  // Tab navigation
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchPage(btn.dataset.page));
  });

  // All inputs → recalc + save
  document.addEventListener('input', onAnyInput);
  document.addEventListener('change', onAnyChange);

  // Spell slot total inputs need diamond rebuild
  for (let lvl = 1; lvl <= SPELL_LEVELS; lvl++) {
    const input = document.querySelector(`[data-key="spellSlotTotal${lvl}"]`);
    if (input) {
      input.addEventListener('input', () => {
        rebuildDiamonds(lvl);
        saveToStorage();
      });
    }
  }

  // Toolbar buttons
  document.getElementById('btn-new').addEventListener('click', newCharacter);
  document.getElementById('btn-export').addEventListener('click', exportJSON);
  document.getElementById('import-file').addEventListener('change', importJSON);
  document.getElementById('btn-print').addEventListener('click', () => window.print());
  document.getElementById('btn-theme').addEventListener('click', toggleTheme);
}

function onAnyInput(e) {
  if (!e.target.matches('[data-key]')) return;
  recalcAll();
  saveToStorage();
}

function onAnyChange(e) {
  if (!e.target.matches('[data-key]')) return;
  recalcAll();
  saveToStorage();
}

/* ============================================================
   TAB NAVIGATION
   ============================================================ */
function switchPage(pageId) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => {
    b.classList.remove('active');
    b.setAttribute('aria-selected', 'false');
  });

  const page = document.getElementById(pageId);
  if (page) page.classList.add('active');

  const btn = document.querySelector(`.tab-btn[data-page="${pageId}"]`);
  if (btn) {
    btn.classList.add('active');
    btn.setAttribute('aria-selected', 'true');
  }
}

/* ============================================================
   NEW CHARACTER
   ============================================================ */
function newCharacter() {
  if (!confirm('Clear all character data and start fresh? This cannot be undone.')) return;

  // Reset all inputs
  document.querySelectorAll('[data-key]').forEach(el => {
    if (el.type === 'checkbox') {
      el.checked = false;
    } else if (el.tagName === 'SELECT') {
      el.selectedIndex = 0;
    } else if (el.type === 'number') {
      el.value = el.dataset.default || el.min || '0';
    } else {
      el.value = '';
    }
  });

  // Reset defaults
  const defaults = {
    level: 1, ac: 10, hpMax: 0, hpCurrent: 0, hpTemp: 0, hdSpent: 0,
    strScore: 10, dexScore: 10, conScore: 10, intScore: 10, wisScore: 10, chaScore: 10,
    speedWalk: 30, speedSwim: 0, speedClimb: 0, speedFly: 0,
    coinCP: 0, coinSP: 0, coinEP: 0, coinGP: 0, coinPP: 0,
  };
  Object.keys(defaults).forEach(k => {
    const el = document.querySelector(`[data-key="${k}"]`);
    if (el) el.value = defaults[k];
  });

  // Clear spell slot diamonds
  for (let lvl = 1; lvl <= SPELL_LEVELS; lvl++) {
    const totalIn = document.querySelector(`[data-key="spellSlotTotal${lvl}"]`);
    if (totalIn) totalIn.value = 0;
    rebuildDiamonds(lvl);
  }

  localStorage.removeItem(LS_KEY);
  recalcAll();
}

/* ============================================================
   EXPORT JSON
   ============================================================ */
function exportJSON() {
  const data = collectAllData();
  const name = data.charName || 'character';
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${name.replace(/[^a-z0-9_\-]/gi, '_')}_dnd.json`;
  a.click();
  URL.revokeObjectURL(url);
}

/* ============================================================
   IMPORT JSON
   ============================================================ */
function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = evt => {
    try {
      const data = JSON.parse(evt.target.result);
      applyData(data);
      recalcAll();
      saveToStorage();
    } catch {
      alert('Invalid JSON file. Please choose a valid character export.');
    }
  };
  reader.readAsText(file);

  // Reset so same file can be re-imported
  e.target.value = '';
}

/* ============================================================
   DARK / LIGHT MODE
   ============================================================ */
function toggleTheme() {
  document.body.classList.toggle('dark-mode');
  updateThemeButton();
  saveToStorage();
}

function updateThemeButton() {
  const btn = document.getElementById('btn-theme');
  if (!btn) return;
  const isDark = document.body.classList.contains('dark-mode');
  btn.textContent = isDark ? '☀️ Light' : '🌙 Dark';
}
/* ============================================================
   DICE ROLLER — Logic
   Append this to script.js
   ============================================================ */

const DICE_HISTORY_MAX = 10;
const DICE_ROLL_ANIM_MS = 400;
let diceHistory = [];

/* ---------- Initialization (call in DOMContentLoaded or after DOM ready) ---------- */
function initDiceRoller() {
  const fab     = document.getElementById('dice-roller-fab');
  const overlay = document.getElementById('dice-roller-overlay');
  const closeBtn = document.getElementById('dice-roller-close');
  const customInput = document.getElementById('dice-custom-input');
  const customRoll  = document.getElementById('dice-custom-roll');
  const advBtn      = document.getElementById('dice-adv-btn');
  const disadvBtn   = document.getElementById('dice-disadv-btn');
  const clearBtn    = document.getElementById('dice-clear-history');

  if (!fab || !overlay) return;

  fab.addEventListener('click', () => diceTogglePanel(true));
  closeBtn.addEventListener('click', () => diceTogglePanel(false));

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) diceTogglePanel(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !overlay.classList.contains('hidden')) {
      diceTogglePanel(false);
    }
  });

  document.querySelectorAll('.dice-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const die = btn.dataset.die;
      diceExecuteRoll(`1${die}`);
    });
  });

  advBtn.addEventListener('click', () => diceExecuteRoll('2d20kh1', 'Advantage'));
  disadvBtn.addEventListener('click', () => diceExecuteRoll('2d20kl1', 'Disadvantage'));

  customRoll.addEventListener('click', () => {
    const notation = customInput.value.trim();
    if (notation) diceExecuteRoll(notation);
  });

  customInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      const notation = customInput.value.trim();
      if (notation) diceExecuteRoll(notation);
    }
  });

  clearBtn.addEventListener('click', diceClearHistory);
}

/* ---------- Panel open/close ---------- */
function diceTogglePanel(open) {
  const overlay = document.getElementById('dice-roller-overlay');
  const fab = document.getElementById('dice-roller-fab');
  if (!overlay) return;

  if (open) {
    overlay.classList.remove('hidden');
    overlay.setAttribute('aria-hidden', 'false');
    fab.style.display = 'none';
    document.getElementById('dice-custom-input').focus();
  } else {
    overlay.classList.add('hidden');
    overlay.setAttribute('aria-hidden', 'true');
    fab.style.display = '';
  }
}

/* ---------- Parse & Execute ---------- */
function diceExecuteRoll(notation, labelOverride) {
  const parsed = diceParse(notation);
  if (!parsed) {
    diceShowResult('Invalid notation', '', '—', notation);
    return;
  }

  const resultEl = document.getElementById('dice-result');
  const totalEl  = document.getElementById('dice-result-total');
  resultEl.classList.remove('hidden');

  /* Animated rolling phase */
  totalEl.classList.add('rolling');
  const label = labelOverride || notation;
  let flickerCount = 0;
  const flickerInterval = setInterval(() => {
    totalEl.textContent = diceRandomFlicker(parsed);
    flickerCount++;
    if (flickerCount >= Math.floor(DICE_ROLL_ANIM_MS / 50)) {
      clearInterval(flickerInterval);
      totalEl.classList.remove('rolling');
      diceFinalize(parsed, label, notation);
    }
  }, 50);
}

function diceRandomFlicker(parsed) {
  let sum = parsed.modifier;
  for (const group of parsed.groups) {
    for (let i = 0; i < group.count; i++) {
      sum += Math.floor(Math.random() * group.sides) + 1;
    }
  }
  return sum;
}

function diceFinalize(parsed, label, rawNotation) {
  const results = [];

  for (const group of parsed.groups) {
    const rolls = [];
    for (let i = 0; i < group.count; i++) {
      rolls.push(Math.floor(Math.random() * group.sides) + 1);
    }

    let kept = rolls.map((v, i) => ({ value: v, index: i, dropped: false }));

    /* keep-highest / keep-lowest logic */
    if (group.keep !== null) {
      const sorted = [...kept].sort((a, b) => {
        return group.keepDir === 'h' ? b.value - a.value : a.value - b.value;
      });
      const keepCount = Math.min(group.keep, kept.length);
      const keepIndices = new Set(sorted.slice(0, keepCount).map(r => r.index));
      kept.forEach(r => {
        r.dropped = !keepIndices.has(r.index);
      });
    }

    results.push({ sides: group.sides, rolls: kept });
  }

  /* Compute total */
  let total = parsed.modifier;
  const allDice = [];
  for (const group of results) {
    for (const r of group.rolls) {
      if (!r.dropped) total += r.value;
      allDice.push({ ...r, sides: group.sides });
    }
  }

  /* Build individual dice HTML */
  const indivHtml = allDice.map(d => {
    let cls = 'die-val';
    if (d.dropped) cls += ' die-val--dropped';
    else if (d.sides === 20 && d.value === 20) cls += ' die-val--crit';
    else if (d.sides === 20 && d.value === 1)  cls += ' die-val--fumble';
    return `<span class="${cls}">${d.value}</span>`;
  }).join('');

  const modStr = parsed.modifier !== 0
    ? ` ${parsed.modifier > 0 ? '+' : ''}${parsed.modifier}`
    : '';

  diceShowResult(label, indivHtml + (modStr ? `<span class="die-val">${modStr}</span>` : ''), total, rawNotation);
  diceAddHistory(rawNotation, label, total);
}

function diceShowResult(label, indivHtml, total, rawNotation) {
  document.getElementById('dice-result').classList.remove('hidden');
  document.getElementById('dice-result-label').textContent = label;
  document.getElementById('dice-result-individual').innerHTML = indivHtml;
  document.getElementById('dice-result-total').textContent = total;
}

/* ---------- Parser ----------
   Supports: NdS, NdS+M, NdS-M, NdSkhK, NdSklK, multiple groups via "+"
   Examples: 2d6+3, 4d6kh3, 1d20+5, 2d20kl1, 1d8+1d6+3, d20           */
function diceParse(notation) {
  const input = notation.toLowerCase().replace(/\s+/g, '');
  if (!input) return null;

  /* Split on + or - but keep the sign as a token */
  const tokens = input.match(/[+-]?[^+-]+/g);
  if (!tokens) return null;

  const groups = [];
  let modifier = 0;

  for (const token of tokens) {
    const sign = token.startsWith('-') ? -1 : 1;
    const clean = token.replace(/^[+-]/, '');

    /* Dice pattern: (N)d(S)(kh|kl)(K) */
    const diceMatch = clean.match(/^(\d*)d(\d+)(?:(kh|kl)(\d+))?$/);
    if (diceMatch) {
      const count = diceMatch[1] ? parseInt(diceMatch[1], 10) : 1;
      const sides = parseInt(diceMatch[2], 10);
      const keepDir = diceMatch[3] ? diceMatch[3][1] : null;       // 'h' or 'l'
      const keepNum = diceMatch[4] ? parseInt(diceMatch[4], 10) : null;

      if (count < 1 || count > 100 || sides < 1 || sides > 1000) return null;
      if (keepNum !== null && (keepNum < 1 || keepNum > count)) return null;

      groups.push({
        count,
        sides,
        keep: keepNum,
        keepDir,
        sign,
      });
    } else if (/^\d+$/.test(clean)) {
      modifier += sign * parseInt(clean, 10);
    } else {
      return null; // invalid token
    }
  }

  if (groups.length === 0) return null;
  return { groups, modifier };
}

/* ---------- History ---------- */
function diceAddHistory(rawNotation, label, total) {
  const now = new Date();
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  diceHistory.unshift({ notation: label, total, time });
  if (diceHistory.length > DICE_HISTORY_MAX) diceHistory.pop();

  diceRenderHistory();
}

function diceRenderHistory() {
  const list = document.getElementById('dice-history');
  if (!list) return;
  list.innerHTML = '';

  for (const entry of diceHistory) {
    const li = document.createElement('li');
    li.className = 'dice-history-item';
    li.innerHTML = `
      <span class="dice-history-time">${entry.time}</span>
      <span class="dice-history-notation">${escDice(entry.notation)}</span>
      <span class="dice-history-result">= ${entry.total}</span>
    `;
    list.appendChild(li);
  }
}

function diceClearHistory() {
  diceHistory = [];
  diceRenderHistory();
  const resultEl = document.getElementById('dice-result');
  if (resultEl) resultEl.classList.add('hidden');
}

/* HTML-escape helper for history entries */
function escDice(str) {
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

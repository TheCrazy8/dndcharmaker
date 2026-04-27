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

/* ============================================================
   OPTIONAL EXTRA SOURCE DATA
   Users may supply local JSON files — data is loaded into
   memory only and never committed to this repository.
   Multiple files may be loaded at once; each becomes a named
   source in the spell/feat browsers.
   Expected file format:
   {
     "source":     "My Source Name",   ← optional; defaults to filename
     "spells":     [ { "n":"…", "l":1, "s":"…", "ct":"…", "r":"…",
                       "d":"…", "c":false, "ri":false, "co":"VS" }, … ],
     "feats":      [ { "name":"…", "desc":"…" }, … ],
     "subclasses": { "ClassName": ["Subclass A", "Subclass B"], … }
   }
   ============================================================ */
let _extraSources = []; // [{ name, spells, feats, subclasses }, …]

/** Returns all spells (SRD + any loaded sources), each tagged with a .src field. */
function getAllSpells() {
  const srd = SRD_SPELLS.map(sp => Object.assign({ src: 'SRD' }, sp));
  const extra = _extraSources.flatMap(src =>
    src.spells.map(sp => Object.assign({ src: src.name }, sp))
  );
  return [...srd, ...extra];
}

/** Returns all feats (SRD + any loaded sources), each tagged with a .src field. */
function getAllFeats() {
  const srd = SRD_FEATS.map(f => Object.assign({ src: 'SRD' }, f));
  const extra = _extraSources.flatMap(src =>
    src.feats.map(f => Object.assign({ src: src.name }, f))
  );
  return [...srd, ...extra];
}

/** Returns merged subclass lists (SRD + any loaded sources). */
function getAllSubclasses() {
  const merged = {};
  Object.keys(SRD_SUBCLASSES).forEach(cls => {
    merged[cls] = [...SRD_SUBCLASSES[cls]];
  });
  _extraSources.forEach(src => {
    Object.entries(src.subclasses).forEach(([cls, subs]) => {
      if (!merged[cls]) merged[cls] = [];
      subs.forEach(s => { if (!merged[cls].includes(s)) merged[cls].push(s); });
    });
  });
  return merged;
}

/* ============================================================
   OPTIONAL SOURCE DATA LOADER
   ============================================================ */
function validateSourceData(data) {
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Source data must be a JSON object.');
  }
  if (data.spells !== undefined) {
    if (!Array.isArray(data.spells)) throw new Error('"spells" must be an array.');
    data.spells.forEach((sp, i) => {
      if (typeof sp.n !== 'string') throw new Error(`spells[${i}].n must be a string (spell name).`);
      if (typeof sp.l !== 'number') throw new Error(`spells[${i}].l must be a number (spell level).`);
    });
  }
  if (data.feats !== undefined) {
    if (!Array.isArray(data.feats)) throw new Error('"feats" must be an array.');
    data.feats.forEach((f, i) => {
      if (typeof f.name !== 'string') throw new Error(`feats[${i}].name must be a string.`);
      if (typeof f.desc !== 'string') throw new Error(`feats[${i}].desc must be a string.`);
    });
  }
  if (data.subclasses !== undefined) {
    if (typeof data.subclasses !== 'object' || Array.isArray(data.subclasses)) {
      throw new Error('"subclasses" must be an object mapping class names to arrays.');
    }
    Object.entries(data.subclasses).forEach(([cls, subs]) => {
      if (!Array.isArray(subs)) throw new Error(`subclasses["${cls}"] must be an array.`);
    });
  }
}

/** Derives a source name from a filename (strips extension, uppercases). */
function sourceNameFromFile(filename) {
  return filename.replace(/\.[^.]+$/, '').toUpperCase();
}

/** Updates the source filter <select> dropdowns to reflect currently loaded sources. */
function updateSourceFilters() {
  const sourceNames = _extraSources.map(s => s.name);
  ['spell-source-filter', 'feat-source-filter'].forEach(id => {
    const sel = document.getElementById(id);
    if (!sel) return;
    const current = sel.value;
    // Remove dynamically added options (keep "All Sources" and "SRD")
    const toRemove = Array.from(sel.options).filter(opt => opt.value !== '' && opt.value !== 'SRD');
    toRemove.forEach(opt => opt.remove());
    // Add an option for each loaded source
    sourceNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    // Restore prior selection if still valid, otherwise reset to "All"
    if ([...sel.options].some(o => o.value === current)) {
      sel.value = current;
    } else {
      sel.value = '';
    }
  });
}

function loadSourceFiles(files) {
  if (!files || files.length === 0) return;
  let loaded = 0;
  const errors = [];
  const replaced = [];
  const total = files.length;

  Array.from(files).forEach(file => {
    const reader = new FileReader();
    reader.onload = evt => {
      try {
        const data = JSON.parse(evt.target.result);
        validateSourceData(data);
        const name = (typeof data.source === 'string' && data.source.trim())
          ? data.source.trim()
          : sourceNameFromFile(file.name);
        // Replace an existing source with the same name, or append a new one
        const existing = _extraSources.findIndex(s => s.name === name);
        const entry = {
          name,
          spells:     data.spells     || [],
          feats:      data.feats      || [],
          subclasses: data.subclasses || {},
        };
        if (existing >= 0) {
          _extraSources[existing] = entry;
          replaced.push(name);
        } else {
          _extraSources.push(entry);
        }
        loaded++;
        if (loaded + errors.length === total) finalize();
      } catch (err) {
        errors.push(`${file.name}: ${err.message}`);
        if (loaded + errors.length === total) finalize();
      }
    };
    reader.readAsText(file);
  });

  function finalize() {
    updateSourceFilters();
    const summary = _extraSources.map(s =>
      `  ${s.name}: ${s.spells.length} spells, ${s.feats.length} feats, ` +
      `${Object.keys(s.subclasses).length} subclass groups`
    ).join('\n');
    let msg = '';
    if (loaded > 0) {
      msg += `${loaded} source file(s) loaded.\nActive sources:\n${summary}`;
      if (replaced.length > 0) {
        msg += `\n\nNote: the following sources were replaced with new data: ${replaced.join(', ')}`;
      }
    }
    if (errors.length > 0) {
      msg += (msg ? '\n\n' : '') + `Errors:\n${errors.map(e => '  ' + e).join('\n')}`;
    }
    alert(msg);
    // Refresh any open browser panels
    const spellOverlay = document.getElementById('spell-browser-overlay');
    if (spellOverlay && !spellOverlay.classList.contains('hidden')) filterSpells();
    const featOverlay = document.getElementById('feat-browser-overlay');
    if (featOverlay && !featOverlay.classList.contains('hidden')) filterFeats();
  }

  // Reset so the same file(s) can be re-loaded
  const input = document.getElementById('source-files');
  if (input) input.value = '';
}

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
  initPortrait();
  initExpertise();
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

  // Inventory rows
  buildInventoryRows();
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
  const l = Math.max(1, Number(level));
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
  let perceptionProf = false;
  let perceptionExpertise = false;

  Object.keys(skillMap).forEach(key => {
    const ab       = skillMap[key];
    const checkbox = document.querySelector(`[data-key="${key}"]`);
    const hasP     = checkbox ? checkbox.checked : false;
    const hasExp   = checkbox ? checkbox.dataset.expertise === 'true' : false;
    const profMult = hasExp ? 2 : (hasP ? 1 : 0);
    const modVal   = mods[ab] + (profMult * pb);
    const elId     = 'mod-' + skillIdMap[key];
    const el       = document.getElementById(elId);
    if (el) el.textContent = formatMod(modVal);

    if (key === 'skillPerception') {
      perceptionMod       = mods['wis'];
      perceptionProf      = hasP || hasExp;
      perceptionExpertise = hasExp;
    }
  });

  // Initiative = DEX mod
  const initEl = document.getElementById('initiative');
  if (initEl) initEl.textContent = formatMod(mods['dex']);

  // Passive Perception = 10 + WIS mod + prof/expertise bonus
  const ppEl = document.getElementById('passive-perception');
  const ppMult = perceptionExpertise ? 2 : (perceptionProf ? 1 : 0);
  if (ppEl) ppEl.textContent = 10 + perceptionMod + (ppMult * pb);

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

  // XP progress bar
  updateXPBar();

  // Inventory weight
  calcInventory();
}

/* ============================================================
   XP PROGRESS BAR
   ============================================================ */
const XP_THRESHOLDS = [
  0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000,
  85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000
];

function updateXPBar() {
  const level = Math.max(1, Number(document.getElementById('level')?.value) || 1);
  const xp = Number(document.getElementById('xp')?.value) || 0;

  const currentThreshold = XP_THRESHOLDS[level] ?? XP_THRESHOLDS[XP_THRESHOLDS.length - 1];
  const nextThreshold = XP_THRESHOLDS[level + 1] ?? null;
  const xpIntoLevel = xp - currentThreshold;
  const xpNeeded = nextThreshold !== null ? nextThreshold - currentThreshold : 0;
  // Uncapped: allow pct > 100 when XP overshoots the next threshold.
  // When there is no next threshold (max level or homebrew beyond array), bar is full.
  const pct = nextThreshold !== null && xpNeeded > 0
    ? Math.max(0, (xpIntoLevel / xpNeeded) * 100)
    : 100;

  const lvlEl = document.getElementById('xp-current-level');
  const curEl = document.getElementById('xp-current-val');
  const nextEl = document.getElementById('xp-next-val');
  const fillEl = document.getElementById('xp-bar-fill');
  const textEl = document.getElementById('xp-bar-text');
  const prevLabel = document.getElementById('xp-prev-label');
  const nextLabel = document.getElementById('xp-next-label');

  if (lvlEl) lvlEl.textContent = level;
  if (curEl) curEl.textContent = xp.toLocaleString();
  if (nextEl) nextEl.textContent = nextThreshold !== null ? nextThreshold.toLocaleString() : '—';
  if (fillEl) {
    // Visual fill is capped at 100% (bar track clips overflow), but turns gold when maxed
    fillEl.style.width = Math.min(100, pct) + '%';
    fillEl.classList.toggle('maxed', nextThreshold === null);
  }
  if (textEl) textEl.textContent = nextThreshold !== null ? Math.round(pct) + '%' : 'MAX';
  if (prevLabel) prevLabel.textContent = currentThreshold.toLocaleString() + ' XP';
  if (nextLabel) nextLabel.textContent = nextThreshold !== null ? 'Next: ' + nextThreshold.toLocaleString() + ' XP' : 'Max Level!';
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

  // Restore concentration state
  initConcentration();
}

/* ============================================================
   BIND EVENTS
   ============================================================ */
function bindEvents() {

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
  document.getElementById('btn-characters').addEventListener('click', openCharacterManager);
  document.getElementById('btn-pointbuy').addEventListener('click', openPointBuy);
  document.getElementById('btn-rules').addEventListener('click', openRulesRef);
  document.getElementById('source-files')?.addEventListener('change', e => loadSourceFiles(e.target.files));

  // Close SRD overlays on backdrop click
  ['spell-browser-overlay', 'feat-browser-overlay', 'rules-overlay'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('click', e => { if (e.target === el) el.classList.add('hidden'); });
  });

  // Close subclass popup on outside click
  document.addEventListener('click', e => {
    const popup = document.getElementById('subclass-popup');
    const btn   = document.getElementById('btn-subclass-presets');
    if (popup && !popup.classList.contains('hidden') &&
        !popup.contains(e.target) && e.target !== btn) {
      popup.classList.add('hidden');
    }
  });

  // Escape key closes any open SRD overlay/popup
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    ['spell-browser-overlay', 'feat-browser-overlay', 'rules-overlay'].forEach(id => {
      document.getElementById(id)?.classList.add('hidden');
    });
    document.getElementById('subclass-popup')?.classList.add('hidden');
  });
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
    if (flickerCount > Math.floor(DICE_ROLL_ANIM_MS / 50)) {
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



/* ============================================================
   EXPERTISE FEATURE
   ============================================================ */
/* Skill checkboxes cycle through 3 states on double-click:
 *   1. Not proficient (unchecked)
 *   2. Proficient (checked, green)
 *   3. Expertise (checked, gold — double proficiency bonus)
 */

function initExpertise() {
  // Add double-click handler to all skill proficiency checkboxes
  document.querySelectorAll('.skill-prof').forEach(checkbox => {
    const label = checkbox.closest('.checkbox-label') || checkbox.parentElement;

    label.addEventListener('dblclick', (e) => {
      e.preventDefault();
      e.stopPropagation();
      cycleSkillProficiency(checkbox);
    });
  });

  // Load expertise state from storage
  const data = loadRaw();
  document.querySelectorAll('.skill-prof').forEach(checkbox => {
    const key = checkbox.dataset.key;
    if (data[key + 'Expertise']) {
      checkbox.dataset.expertise = 'true';
      updateExpertiseVisual(checkbox);
    }
  });
}

function cycleSkillProficiency(checkbox) {
  const hasExpertise = checkbox.dataset.expertise === 'true';
  const isProf = checkbox.checked;

  if (!isProf) {
    // Not proficient → Proficient
    checkbox.checked = true;
    checkbox.dataset.expertise = 'false';
  } else if (!hasExpertise) {
    // Proficient → Expertise
    checkbox.dataset.expertise = 'true';
  } else {
    // Expertise → Not proficient
    checkbox.checked = false;
    checkbox.dataset.expertise = 'false';
  }

  updateExpertiseVisual(checkbox);
  recalcAll();
  saveExpertiseData();
  saveToStorage();
}

function updateExpertiseVisual(checkbox) {
  const mark = checkbox.nextElementSibling; // .check-mark
  if (!mark) return;

  if (checkbox.checked && checkbox.dataset.expertise === 'true') {
    mark.classList.add('expertise');
  } else {
    mark.classList.remove('expertise');
  }
}

function saveExpertiseData() {
  const data = loadRaw();
  document.querySelectorAll('.skill-prof').forEach(checkbox => {
    const key = checkbox.dataset.key;
    data[key + 'Expertise'] = checkbox.dataset.expertise === 'true';
  });
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage save failed:', e);
  }
}

/* ============================================================
   PORTRAIT FEATURE
   ============================================================ */
/* ---------- Portrait Upload / Display / Clear ---------- */

function initPortrait() {
  const data = loadRaw();
  const base64 = data.charPortrait;
  if (base64) {
    showPortrait(base64);
  }
}

function uploadPortrait(event) {
  const file = event.target.files[0];
  if (!file) return;

  // Validate file type
  if (!file.type.startsWith('image/')) {
    alert('Please select an image file.');
    return;
  }

  // Limit file size to 500KB after encoding
  const reader = new FileReader();
  reader.onload = function (e) {
    const base64 = e.target.result;
    // Check size (base64 is ~33% larger than raw)
    if (base64.length > 700000) {
      alert('Image is too large. Please use an image under 500KB.');
      return;
    }
    showPortrait(base64);
    savePortraitData(base64);
  };
  reader.readAsDataURL(file);

  // Reset file input so same file can be re-uploaded
  event.target.value = '';
}

function clearPortrait() {
  const img = document.getElementById('portrait-img');
  const placeholder = document.getElementById('portrait-placeholder');
  if (img) {
    img.src = '';
    img.style.display = 'none';
  }
  if (placeholder) {
    placeholder.style.display = 'flex';
  }
  savePortraitData('');
}

function showPortrait(base64) {
  const img = document.getElementById('portrait-img');
  const placeholder = document.getElementById('portrait-placeholder');
  if (!base64) return;
  if (img) {
    img.src = base64;
    img.style.display = 'block';
  }
  if (placeholder) {
    placeholder.style.display = 'none';
  }
}

function savePortraitData(base64) {
  const data = loadRaw();
  data.charPortrait = base64;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn('localStorage save failed (portrait may be too large):', e);
    alert('Failed to save portrait. The image may be too large for localStorage.');
  }
}


/* ============================================================
   REST FEATURE
   ============================================================ */
/* ---------- Short Rest / Long Rest ---------- */

function shortRest() {
  const level = Number(document.getElementById('level')?.value) || 1;
  const maxDice = Math.max(1, Math.floor(level / 2));
  const hdSpentEl = document.querySelector('[data-key="hdSpent"]');
  const currentSpent = Number(hdSpentEl?.value) || 0;

  const msg = `Short Rest\n\n` +
    `You can spend up to ${maxDice} hit dice (half your level, minimum 1) to recover HP.\n` +
    `Currently spent: ${currentSpent} hit dice.\n\n` +
    `This will not auto-heal — roll your hit dice manually and add HP.\n\n` +
    `Proceed with short rest?`;

  if (!confirm(msg)) return;

  // Short rest doesn't auto-restore anything mechanical in base 5e,
  // but some features reset on short rest. We just confirm it happened.
  // The player manually handles hit dice spending via the dice roller.

  saveToStorage();
}

function longRest() {
  const hpMaxEl = document.querySelector('[data-key="hpMax"]');
  const hpCurEl = document.querySelector('[data-key="hpCurrent"]');
  const hdSpentEl = document.querySelector('[data-key="hdSpent"]');
  const level = Number(document.getElementById('level')?.value) || 1;
  const hpMax = Number(hpMaxEl?.value) || 0;
  const hdSpent = Number(hdSpentEl?.value) || 0;

  // Calculate hit dice recovery (up to half level, minimum 1)
  const hdRecovery = Math.max(1, Math.floor(level / 2));
  const newHdSpent = Math.max(0, hdSpent - hdRecovery);

  let details = `Long Rest\n\n`;
  details += `• HP restored to maximum (${hpMax})\n`;
  details += `• Hit dice recovered: ${Math.min(hdRecovery, hdSpent)} (spent: ${hdSpent} → ${newHdSpent})\n`;
  details += `• Death saves cleared\n`;

  // Check for exhaustion level 1
  const exhaustion1 = document.querySelector('[data-key="exhaustion1"]');
  if (exhaustion1?.checked) {
    details += `• Exhaustion reduced by 1 level\n`;
  }

  details += `\nProceed with long rest?`;

  if (!confirm(details)) return;

  // Restore HP to max
  if (hpCurEl) hpCurEl.value = hpMax;

  // Recover hit dice
  if (hdSpentEl) hdSpentEl.value = newHdSpent;

  // Clear death saves
  for (let i = 1; i <= 3; i++) {
    const sEl = document.querySelector(`[data-key="deathSuccess${i}"]`);
    const fEl = document.querySelector(`[data-key="deathFail${i}"]`);
    if (sEl) sEl.checked = false;
    if (fEl) fEl.checked = false;
  }

  // Reduce exhaustion by 1 level (uncheck highest active level)
  for (let i = 6; i >= 1; i--) {
    const exEl = document.querySelector(`[data-key="exhaustion${i}"]`);
    if (exEl?.checked) {
      exEl.checked = false;
      break;
    }
  }

  // Restore all spell slots (unmark expended diamonds)
  for (let lvl = 1; lvl <= 9; lvl++) {
    const cell = document.getElementById(`slot-diamonds-${lvl}`);
    if (cell) {
      cell.querySelectorAll('.slot-diamond.expended').forEach(d => {
        d.classList.remove('expended');
      });
    }
  }

  recalcAll();
  saveToStorage();
}


/* ============================================================
   CHARACTERS FEATURE
   ============================================================ */
/* ---------- Multiple Character Save Slots ---------- */

const CHAR_MANIFEST_KEY = 'dnd5e_chars_manifest';
const CHAR_DATA_PREFIX = 'dnd5e_chars_';

function getCharManifest() {
  try {
    return JSON.parse(localStorage.getItem(CHAR_MANIFEST_KEY)) || [];
  } catch {
    return [];
  }
}

function saveCharManifest(manifest) {
  localStorage.setItem(CHAR_MANIFEST_KEY, JSON.stringify(manifest));
}

function openCharacterManager() {
  const overlay = document.getElementById('character-manager-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  renderCharacterList();
}

function closeCharacterManager() {
  const overlay = document.getElementById('character-manager-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function renderCharacterList() {
  const list = document.getElementById('char-mgr-list');
  const empty = document.getElementById('char-mgr-empty');
  const manifest = getCharManifest();

  // Clear existing entries (keep the empty message)
  list.querySelectorAll('.char-mgr-entry').forEach(el => el.remove());

  if (manifest.length === 0) {
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';

  manifest.forEach((entry, index) => {
    const div = document.createElement('div');
    div.className = 'char-mgr-entry';
    div.innerHTML = `
      <div class="char-mgr-info">
        <span class="char-mgr-name">${escapeHtml(entry.name || 'Unnamed')}</span>
        <span class="char-mgr-meta">${escapeHtml(entry.className || '—')} · Lv ${entry.level || 1}</span>
        <span class="char-mgr-date">Saved: ${entry.savedAt || '—'}</span>
      </div>
      <div class="char-mgr-entry-actions">
        <button class="char-mgr-btn load" onclick="loadCharacterSlot(${index})" title="Load">📂 Load</button>
        <button class="char-mgr-btn rename" onclick="renameCharacterSlot(${index})" title="Rename">✏️</button>
        <button class="char-mgr-btn delete" onclick="deleteCharacterSlot(${index})" title="Delete">🗑️</button>
      </div>
    `;
    list.appendChild(div);
  });
}

function saveCharacterSlot() {
  const data = collectAllData();
  const name = data.charName || 'Unnamed Character';
  const className = data.mainClass || '';
  const level = data.level || 1;

  const manifest = getCharManifest();
  const slotId = 'slot_' + Date.now();
  const now = new Date().toLocaleDateString() + ' ' + new Date().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

  manifest.push({
    id: slotId,
    name: name,
    className: className,
    level: level,
    savedAt: now
  });

  saveCharManifest(manifest);
  localStorage.setItem(CHAR_DATA_PREFIX + slotId, JSON.stringify(data));

  renderCharacterList();
}

function loadCharacterSlot(index) {
  const manifest = getCharManifest();
  if (index < 0 || index >= manifest.length) return;

  const entry = manifest[index];
  const raw = localStorage.getItem(CHAR_DATA_PREFIX + entry.id);
  if (!raw) {
    alert('Character data not found. It may have been deleted.');
    return;
  }

  if (!confirm(`Load "${entry.name}"? This will replace your current character data.`)) return;

  try {
    const data = JSON.parse(raw);
    applyData(data);
    recalcAll();
    saveToStorage();
    closeCharacterManager();
  } catch {
    alert('Failed to load character data.');
  }
}

function deleteCharacterSlot(index) {
  const manifest = getCharManifest();
  if (index < 0 || index >= manifest.length) return;

  const entry = manifest[index];
  if (!confirm(`Delete saved character "${entry.name}"? This cannot be undone.`)) return;

  localStorage.removeItem(CHAR_DATA_PREFIX + entry.id);
  manifest.splice(index, 1);
  saveCharManifest(manifest);
  renderCharacterList();
}

function renameCharacterSlot(index) {
  const manifest = getCharManifest();
  if (index < 0 || index >= manifest.length) return;

  const entry = manifest[index];
  const newName = prompt('Enter new name:', entry.name);
  if (newName === null || newName.trim() === '') return;

  entry.name = newName.trim();
  saveCharManifest(manifest);
  renderCharacterList();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}


/* ============================================================
   INVENTORY FEATURE
   ============================================================ */
/* ---------- Inventory Weight Tracking ---------- */

const INVENTORY_ROWS = 20;

function buildInventoryRows() {
  const tbody = document.getElementById('inventory-tbody');
  if (!tbody) return;

  for (let i = 0; i < INVENTORY_ROWS; i++) {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><input type="text" data-key="invName${i}" placeholder="Item name" /></td>
      <td><input type="number" data-key="invQty${i}" min="0" value="" placeholder="0" class="inv-num-input" /></td>
      <td><input type="number" data-key="invWeight${i}" min="0" step="0.1" value="" placeholder="0" class="inv-num-input" /></td>
      <td class="inv-row-total" id="inv-row-total-${i}">0</td>
      <td><input type="text" data-key="invNotes${i}" placeholder="Notes…" /></td>
    `;
    tbody.appendChild(tr);
  }
}

function calcInventory() {
  let totalWeight = 0;

  for (let i = 0; i < INVENTORY_ROWS; i++) {
    const qtyEl = document.querySelector(`[data-key="invQty${i}"]`);
    const wtEl = document.querySelector(`[data-key="invWeight${i}"]`);
    const totalEl = document.getElementById(`inv-row-total-${i}`);

    const qty = Number(qtyEl?.value) || 0;
    const wt = Number(wtEl?.value) || 0;
    const rowTotal = Math.round(qty * wt * 100) / 100;

    if (totalEl) totalEl.textContent = rowTotal > 0 ? rowTotal : '—';
    totalWeight += rowTotal;
  }

  totalWeight = Math.round(totalWeight * 100) / 100;

  // Update summary
  const totalEl = document.getElementById('inv-total-weight');
  if (totalEl) totalEl.textContent = totalWeight;

  // Calculate encumbrance based on STR score (variant encumbrance rules)
  const strScore = getScore('str');
  const carryCapacity = strScore * 15;
  const lightThreshold = strScore * 5;   // encumbered above this
  const heavyThreshold = strScore * 10;  // heavily encumbered above this

  const capacityEl = document.getElementById('inv-capacity');
  if (capacityEl) capacityEl.textContent = `(Capacity: ${carryCapacity} lb)`;

  const statusEl = document.getElementById('inv-encumbrance');
  if (statusEl) {
    if (totalWeight > carryCapacity) {
      statusEl.textContent = '⚠️ Over Capacity!';
      statusEl.className = 'inv-encumbrance inv-over';
    } else if (totalWeight > heavyThreshold) {
      statusEl.textContent = '🔴 Heavily Encumbered';
      statusEl.className = 'inv-encumbrance inv-heavy';
    } else if (totalWeight > lightThreshold) {
      statusEl.textContent = '🟡 Encumbered';
      statusEl.className = 'inv-encumbrance inv-enc';
    } else {
      statusEl.textContent = '✅ Normal';
      statusEl.className = 'inv-encumbrance inv-normal';
    }
  }
}




/* ============================================================
   POINTBUY FEATURE
   ============================================================ */
/* ---------- Point Buy / Standard Array Logic ---------- */

const PB_COST_TABLE = { 8:0, 9:1, 10:2, 11:3, 12:4, 13:5, 14:7, 15:9 };
const PB_MAX_POINTS = 27;
const PB_ABILITIES = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

let pbScores = { str:8, dex:8, con:8, int:8, wis:8, cha:8 };

function openPointBuy() {
  const overlay = document.getElementById('pointbuy-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  pbReset();
}

function closePointBuy() {
  const overlay = document.getElementById('pointbuy-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function switchPBTab(tab) {
  document.querySelectorAll('.pointbuy-tab').forEach(t => t.classList.remove('active'));
  document.querySelector(`.pointbuy-tab[data-pbtab="${tab}"]`)?.classList.add('active');

  document.getElementById('pb-tab-pointbuy').classList.toggle('hidden', tab !== 'pointbuy');
  document.getElementById('pb-tab-standard').classList.toggle('hidden', tab !== 'standard');
}

function pbAdjust(ability, delta) {
  const current = pbScores[ability];
  const next = current + delta;

  if (next < 8 || next > 15) return;

  // Check if we have enough points
  const currentTotalCost = pbTotalCost();
  const newCost = currentTotalCost - PB_COST_TABLE[current] + PB_COST_TABLE[next];

  if (newCost > PB_MAX_POINTS) return;

  pbScores[ability] = next;
  pbUpdateDisplay();
}

function pbTotalCost() {
  let total = 0;
  PB_ABILITIES.forEach(ab => {
    total += PB_COST_TABLE[pbScores[ab]] || 0;
  });
  return total;
}

function pbUpdateDisplay() {
  const totalCost = pbTotalCost();
  const remaining = PB_MAX_POINTS - totalCost;

  document.getElementById('pb-points-left').textContent = remaining;

  PB_ABILITIES.forEach(ab => {
    const scoreEl = document.getElementById(`pb-${ab}`);
    const costEl = document.getElementById(`pb-cost-${ab}`);
    if (scoreEl) scoreEl.textContent = pbScores[ab];
    if (costEl) costEl.textContent = `(${PB_COST_TABLE[pbScores[ab]]} pts)`;
  });

  // Color the remaining points
  const ptsEl = document.getElementById('pb-points-left');
  if (ptsEl) {
    ptsEl.style.color = remaining === 0 ? 'var(--accent-green)' :
                         remaining < 0 ? 'var(--accent-red)' : 'var(--text-heading)';
  }
}

function pbReset() {
  PB_ABILITIES.forEach(ab => { pbScores[ab] = 8; });
  pbUpdateDisplay();
}

function pbApply() {
  if (!confirm('Apply these ability scores to your character sheet? This will overwrite current scores.')) return;

  PB_ABILITIES.forEach(ab => {
    const el = document.querySelector(`[data-key="${ab}Score"]`);
    if (el) el.value = pbScores[ab];
  });

  recalcAll();
  saveToStorage();
  closePointBuy();
}

/* Standard Array functions */
function saValidate() {
  const selects = PB_ABILITIES.map(ab => document.getElementById(`sa-${ab}`));
  const values = selects.map(s => s?.value).filter(v => v !== '');
  const statusEl = document.getElementById('sa-status');
  const applyBtn = document.getElementById('sa-apply-btn');

  // Check for duplicates
  const unique = new Set(values);
  const hasDupes = unique.size !== values.length;
  const allAssigned = values.length === 6;

  if (hasDupes) {
    if (statusEl) {
      statusEl.textContent = '⚠️ Each value can only be used once!';
      statusEl.style.color = 'var(--accent-red)';
    }
    if (applyBtn) applyBtn.disabled = true;
  } else if (!allAssigned) {
    if (statusEl) {
      statusEl.textContent = `${6 - values.length} ability score(s) remaining`;
      statusEl.style.color = 'var(--text-muted)';
    }
    if (applyBtn) applyBtn.disabled = true;
  } else {
    if (statusEl) {
      statusEl.textContent = '✅ All scores assigned!';
      statusEl.style.color = 'var(--accent-green)';
    }
    if (applyBtn) applyBtn.disabled = false;
  }
}

function saReset() {
  PB_ABILITIES.forEach(ab => {
    const sel = document.getElementById(`sa-${ab}`);
    if (sel) sel.value = '';
  });
  saValidate();
}

function saApply() {
  if (!confirm('Apply standard array scores to your character sheet? This will overwrite current scores.')) return;

  PB_ABILITIES.forEach(ab => {
    const sel = document.getElementById(`sa-${ab}`);
    const scoreEl = document.querySelector(`[data-key="${ab}Score"]`);
    if (sel && scoreEl && sel.value) {
      scoreEl.value = Number(sel.value);
    }
  });

  recalcAll();
  saveToStorage();
  closePointBuy();
}

/* ============================================================
   CONCENTRATION FEATURE
   ============================================================ */

function startConcentration() {
  document.getElementById('concentration-active').style.display = 'block';
  document.getElementById('concentration-inactive').style.display = 'none';
  document.getElementById('concentration-start-btn').style.display = 'none';
  document.getElementById('concentration-spell').focus();
}

function dismissConcentration() {
  if (!confirm('Drop concentration?')) return;
  const spellEl = document.getElementById('concentration-spell');
  const durEl = document.getElementById('concentration-duration');
  if (spellEl) spellEl.value = '';
  if (durEl) durEl.value = '';
  document.getElementById('concentration-active').style.display = 'none';
  document.getElementById('concentration-inactive').style.display = 'block';
  document.getElementById('concentration-start-btn').style.display = 'block';
  saveToStorage();
}

function initConcentration() {
  const spellEl = document.getElementById('concentration-spell');
  const isActive = spellEl ? spellEl.value.trim() !== '' : false;
  const activeEl = document.getElementById('concentration-active');
  const inactiveEl = document.getElementById('concentration-inactive');
  const startBtn = document.getElementById('concentration-start-btn');
  if (activeEl) activeEl.style.display = isActive ? 'block' : 'none';
  if (inactiveEl) inactiveEl.style.display = isActive ? 'none' : 'block';
  if (startBtn) startBtn.style.display = isActive ? 'none' : 'block';
}

/* ============================================================
   SRD PRESETS — Subclass
   ============================================================ */
function openSubclassPresets() {
  const popup = document.getElementById('subclass-popup');
  const list  = document.getElementById('subclass-popup-list');
  const title = document.getElementById('subclass-popup-title');
  if (!popup || !list) return;
  if (typeof SRD_SUBCLASSES === 'undefined') return;

  const cls     = document.getElementById('main-class')?.value || '';
  const options = getAllSubclasses()[cls];

  title.textContent = cls ? `${cls} Subclasses` : 'Subclasses';

  if (!options || options.length === 0) {
    list.innerHTML = `<p class="srd-popup-empty">${cls ? 'No subclasses for ' + escSrd(cls) + '.' : 'Select a class first.'}</p>`;
  } else {
    list.innerHTML = options.map(sub =>
      `<button class="srd-popup-item" onclick="applySubclass(${JSON.stringify(sub)})">${sub}</button>`
    ).join('');
  }

  // Position below the button
  const btn  = document.getElementById('btn-subclass-presets');
  const rect = btn.getBoundingClientRect();
  popup.style.top  = (rect.bottom + window.scrollY + 4) + 'px';
  popup.style.left = (rect.left  + window.scrollX)     + 'px';

  popup.classList.remove('hidden');
}

function closeSubclassPresets() {
  document.getElementById('subclass-popup')?.classList.add('hidden');
}

function applySubclass(name) {
  const el = document.getElementById('subclass');
  if (el) {
    el.value = name;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  closeSubclassPresets();
}

/* ============================================================
   SRD PRESETS — Spell Browser
   ============================================================ */
function openSpellBrowser() {
  const overlay = document.getElementById('spell-browser-overlay');
  if (!overlay) return;
  document.getElementById('spell-search').value = '';
  document.getElementById('spell-level-filter').value = '';
  document.getElementById('spell-school-filter').value = '';
  document.getElementById('spell-source-filter').value = '';
  // Build full indexed list once
  renderSpellList(getAllSpells().map((sp, idx) => ({ sp, idx })));
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.getElementById('spell-search').focus();
}

function closeSpellBrowser() {
  const overlay = document.getElementById('spell-browser-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function filterSpells() {
  const query  = document.getElementById('spell-search').value.trim().toLowerCase();
  const level  = document.getElementById('spell-level-filter').value;
  const school = document.getElementById('spell-school-filter').value;
  const source = document.getElementById('spell-source-filter').value;

  // Keep track of original index alongside each spell to avoid indexOf() in render
  const filtered = getAllSpells()
    .map((sp, idx) => ({ sp, idx }))
    .filter(({ sp }) => {
      if (level  !== '' && String(sp.l) !== level)               return false;
      if (school !== '' && sp.s !== school)                       return false;
      if (source !== '' && sp.src !== source)                     return false;
      if (query  !== '' && !sp.n.toLowerCase().includes(query))  return false;
      return true;
    });
  renderSpellList(filtered);
}

function renderSpellList(spells) {
  const list = document.getElementById('spell-browser-list');
  if (!list) return;
  if (spells.length === 0) {
    list.innerHTML = '<p class="srd-empty">No spells match your filters.</p>';
    return;
  }
  const levelLabel = l => l === 0 ? 'C' : String(l);
  list.innerHTML = spells.map(({ sp, idx }) => {
    const tags = [];
    if (sp.src !== 'SRD') tags.push(`<span class="srd-tag srd-tag--phb">${escSrd(sp.src)}</span>`);
    if (sp.c)  tags.push('<span class="srd-tag srd-tag--conc">Conc.</span>');
    if (sp.ri) tags.push('<span class="srd-tag srd-tag--ritual">Ritual</span>');
    return `<div class="srd-spell-row" onclick="applySpell(${idx})">
      <div class="srd-spell-main">
        <span class="srd-spell-lvl">${levelLabel(sp.l)}</span>
        <span class="srd-spell-name">${escSrd(sp.n)}</span>
        <span class="srd-spell-school">${escSrd(sp.s)}</span>
        ${tags.join('')}
      </div>
      <div class="srd-spell-meta">
        <span>${escSrd(sp.ct)}</span>
        <span>${escSrd(sp.r)}</span>
        <span>${escSrd(sp.d)}</span>
        <span class="srd-spell-comp">${escSrd(sp.co)}</span>
      </div>
    </div>`;
  }).join('');
}

function applySpell(spellIdx) {
  const sp = getAllSpells()[spellIdx];
  if (!sp) return;

  // Build a key→element map from all data-key inputs once
  const keyMap = {};
  document.querySelectorAll('[data-key]').forEach(el => { keyMap[el.dataset.key] = el; });

  // Find the first row where the spell name is empty
  let targetRow = -1;
  for (let i = 0; i < SPELL_ROWS; i++) {
    const nameEl = keyMap[`spellName${i}`];
    if (nameEl && nameEl.value.trim() === '') { targetRow = i; break; }
  }
  if (targetRow === -1) {
    alert('All spell rows are filled. Clear a row first.');
    return;
  }

  const levelLabel = sp.l === 0 ? 'C' : String(sp.l);
  const set = (key, val) => {
    const el = keyMap[key];
    if (!el) return;
    if (el.type === 'checkbox') el.checked = Boolean(val);
    else el.value = val;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  };

  set(`spellLvl${targetRow}`,      levelLabel);
  set(`spellName${targetRow}`,     sp.n);
  set(`spellCastTime${targetRow}`, sp.ct);
  set(`spellRange${targetRow}`,    sp.r);
  set(`spellConc${targetRow}`,     sp.c);
  set(`spellRitual${targetRow}`,   sp.ri);
  set(`spellMaterial${targetRow}`, sp.co.includes('M'));
  set(`spellNotes${targetRow}`,    sp.s);

  saveToStorage();
  closeSpellBrowser();
}

/* ============================================================
   SRD PRESETS — Feat Browser
   ============================================================ */
function openFeatBrowser() {
  const overlay = document.getElementById('feat-browser-overlay');
  if (!overlay) return;
  document.getElementById('feat-search').value = '';
  document.getElementById('feat-source-filter').value = '';
  renderFeatList(getAllFeats());
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
  document.getElementById('feat-search').focus();
}

function closeFeatBrowser() {
  const overlay = document.getElementById('feat-browser-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function filterFeats() {
  const query  = document.getElementById('feat-search').value.trim().toLowerCase();
  const source = document.getElementById('feat-source-filter').value;
  let filtered = getAllFeats();
  if (source !== '') filtered = filtered.filter(f => f.src === source);
  if (query  !== '') filtered = filtered.filter(f => f.name.toLowerCase().includes(query) || f.desc.toLowerCase().includes(query));
  renderFeatList(filtered);
}

function renderFeatList(feats) {
  const list = document.getElementById('feat-browser-list');
  if (!list) return;
  if (feats.length === 0) {
    list.innerHTML = '<p class="srd-empty">No feats match your search.</p>';
    return;
  }
  list.innerHTML = feats.map(f =>
    `<div class="srd-feat-row" onclick="applyFeat(${JSON.stringify(f.name)})">
      <div class="srd-feat-name">${escSrd(f.name)}${f.src !== 'SRD' ? ` <span class="srd-tag srd-tag--phb">${escSrd(f.src)}</span>` : ''}</div>
      <div class="srd-feat-desc">${escSrd(f.desc)}</div>
    </div>`
  ).join('');
}

function applyFeat(name) {
  const ta = document.getElementById('feats');
  if (!ta) return;
  const current = ta.value.trim();
  ta.value = current ? current + '\n' + name : name;
  ta.dispatchEvent(new Event('input', { bubbles: true }));
  saveToStorage();
  closeFeatBrowser();
}

/* ============================================================
   SRD PRESETS — Rules Reference
   ============================================================ */
function openRulesRef() {
  const overlay = document.getElementById('rules-overlay');
  if (!overlay) return;

  // Render conditions (once)
  const condList = document.getElementById('rules-conditions-list');
  if (condList && condList.children.length === 0) {
    condList.innerHTML = SRD_CONDITIONS.map(c =>
      `<div class="srd-rule-card">
        <div class="srd-rule-name">${escSrd(c.name)}</div>
        <div class="srd-rule-desc">${escSrd(c.desc)}</div>
      </div>`
    ).join('');
  }

  // Render actions (once)
  const actList = document.getElementById('rules-actions-list');
  if (actList && actList.children.length === 0) {
    actList.innerHTML = SRD_ACTIONS.map(a =>
      `<div class="srd-rule-card">
        <div class="srd-rule-name">${escSrd(a.name)} <span class="srd-rule-type">${escSrd(a.type)}</span></div>
        <div class="srd-rule-desc">${escSrd(a.desc)}</div>
      </div>`
    ).join('');
  }

  switchRulesTab('conditions');
  overlay.classList.remove('hidden');
  overlay.setAttribute('aria-hidden', 'false');
}

function closeRulesRef() {
  const overlay = document.getElementById('rules-overlay');
  if (!overlay) return;
  overlay.classList.add('hidden');
  overlay.setAttribute('aria-hidden', 'true');
}

function switchRulesTab(tab) {
  document.querySelectorAll('.srd-rules-tab').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  document.getElementById('rules-conditions-list').classList.toggle('hidden', tab !== 'conditions');
  document.getElementById('rules-actions-list').classList.toggle('hidden',    tab !== 'actions');
}

/* Shared HTML-escape helper for SRD content */
const ESC_MAP = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
function escSrd(str) {
  return String(str).replace(/[&<>"']/g, m => ESC_MAP[m]);
}

# ⚔️ D&D 5e Character Sheet Maker

A complete, interactive **Dungeons & Dragons 5e (2024)** character sheet web application — pure HTML, CSS, and JavaScript, no frameworks required. Deploy instantly via GitHub Pages.

---

## 🎲 Features

### 4-Page Character Sheet
| Page | Contents |
|---|---|
| **Main Sheet** | Character info, combat stats, 6 ability scores with modifiers/skills/saves, proficiency bonus, initiative, speed, passive perception, weapons table, class features, species traits, feats |
| **Additional Info** | Hunger/Thirst/Illness tracker, Sanity & Honor, Senses, Conditions, Silk, Multiclass Info, Talisman, Other Info |
| **Spellcasting** | Spell slots (levels 1–9), prepared spells table (35 rows), appearance, backstory, alignment, languages, equipment, magic item attunement, coins (CP/SP/EP/GP/PP) |
| **Notes** | Free-form full-page notes |

### Auto-Calculations
- **Ability Modifiers** — `floor((score - 10) / 2)`
- **Proficiency Bonus** — based on character level (levels 1–4: +2, 5–8: +3, 9–12: +4, 13–16: +5, 17–20: +6)
- **Saving Throws** — ability modifier + proficiency bonus (if proficient)
- **Skill Modifiers** — ability modifier + proficiency bonus (if proficient)
- **Initiative** — DEX modifier
- **Passive Perception** — 10 + WIS modifier + proficiency bonus (if Perception proficient)
- **Spell Save DC** — 8 + proficiency bonus + spellcasting ability modifier
- **Spell Attack Bonus** — proficiency bonus + spellcasting ability modifier
- **Spellcasting Modifier** — modifier of chosen spellcasting ability
- **Sanity & Honor Modifiers** — computed like ability modifiers (variant rules)

### Quality-of-Life Features
- 🔁 **Auto-save** to `localStorage` on every change
- 🔄 **Load on startup** — restores your character automatically
- 💾 **Export to JSON** — download your character as a `.json` file
- 📂 **Import from JSON** — upload a previously exported character
- 🆕 **New Character** — clears all fields (with confirmation dialog)
- 🖨️ **Print-friendly** — prints the active page cleanly
- 🌙 **Dark / Light mode** toggle
- 📱 **Responsive** — works on desktop and tablets

### Class List (40 Classes)
Abyssal, Artificer, Barbarian, Bard, Blood Hunter, Cleric, Dragon Knight, Druid, Elementalist, Fighter, Gunslinger, Illrigger, Kinetic, Magus, Martyr, Medium, Monk, Necromancer, Occultist, Paladin, Paragon, Psion, Pugilist, Ranger, Rogue, Runecrafter, Shaman, Shaper, Sorcerer, Spellblade, Summoner, Swashbuckler, Vessel, Vigilante, Warlock, Warlord, Weaver, Witch, Witcher, Wizard

---

## 🚀 Deploying to GitHub Pages

1. Go to your repository on GitHub
2. Click **Settings** → **Pages**
3. Under **Source**, select the `main` branch and `/ (root)` folder
4. Click **Save**
5. Your site will be live at `https://<username>.github.io/<repo-name>/` within a few minutes

---

## 🗂️ File Structure

```
index.html   — All 4 pages with tab navigation
style.css    — D&D parchment-themed styling with dark mode & print styles
script.js    — Auto-calculations, localStorage, import/export logic
srd-data.js  — SRD 5.1 spells, feats, and subclasses (CC BY 4.0)
README.md    — This file
```

---

## 🛠️ Tech Stack

- **Pure vanilla HTML, CSS, JavaScript** — no build tools, no frameworks
- **Google Fonts** — Cinzel & IM Fell English for an authentic parchment feel
- **localStorage** — client-side persistence, no server needed

---

## 📜 License

This project is open source. Feel free to fork, customize, and share!

---

## 📗 Optional Source Content

### Why non-SRD content is not included

The *Player's Handbook* (PHB) and other sourcebooks are copyrighted works by Wizards of the Coast and are **not** covered by the [Creative Commons Attribution 4.0 International (CC BY 4.0)](https://creativecommons.org/licenses/by/4.0/) licence that governs the SRD 5.1 data bundled in `srd-data.js`. Including PHB spells, feats, or subclasses directly in this repository would violate that copyright.

### How to load your own data locally

The app ships a **"📗 Load Sources"** button in the toolbar. Clicking it opens a file picker that accepts one or more `.json` files. Each file is loaded into memory as a named **source** and injected into the Spell Browser, Feat Browser, and Subclass picker at runtime — **nothing is ever uploaded or stored on a server.**

You can load multiple files at once. Each file becomes its own named source in the source-filter dropdowns. Re-loading a file whose source name matches an already-loaded source replaces the previous data for that source.

#### JSON file format

```json
{
  "source": "My Sourcebook",
  "spells": [
    {
      "n":  "Spell Name",
      "l":  1,
      "s":  "Evocation",
      "ct": "1 Action",
      "r":  "60 ft.",
      "d":  "Instantaneous",
      "c":  false,
      "ri": false,
      "co": "VS"
    }
  ],
  "feats": [
    {
      "name": "Feat Name",
      "desc": "One-line description of the feat."
    }
  ],
  "subclasses": {
    "Fighter": ["Echo Knight", "Psi Warrior"],
    "Wizard":  ["Bladesinging", "Order of Scribes"]
  },
  "monsters": [
    {
      "name":  "Goblin",
      "cr":    "1/4",
      "type":  "Humanoid (goblinoid)",
      "size":  "Small",
      "ac":    "15 (leather armor, shield)",
      "hp":    "7 (2d6)",
      "speed": "30 ft.",
      "str": 8, "dex": 14, "con": 10, "int": 10, "wis": 8, "cha": 8,
      "notes": "Nimble Escape. Scimitar +4 to hit, 1d6+2 slashing."
    }
  ]
}
```

| Field | Type | Notes |
|---|---|---|
| `source` | string | Display name for this source in the filter dropdowns. Defaults to the filename (without extension, uppercased) if omitted. |
| `spells[*].n` | string | Spell name (**required**) |
| `spells[*].l` | number | Level 0 = cantrip (**required**) |
| `spells[*].s` | string | School of magic |
| `spells[*].ct` | string | Casting time |
| `spells[*].r` | string | Range |
| `spells[*].d` | string | Duration |
| `spells[*].c` | boolean | Requires concentration |
| `spells[*].ri` | boolean | Can be cast as ritual |
| `spells[*].co` | string | Components (`V`, `S`, `M`, `VS`, `VSM`, …) |
| `feats[*].name` | string | Feat name (**required**) |
| `feats[*].desc` | string | Description (**required**) |
| `subclasses` | object | Maps class name → array of subclass name strings |
| `monsters[*].name` | string | Monster name (**required**) |
| `monsters[*].cr` | string | Challenge rating (e.g. `"1/4"`, `"5"`) |
| `monsters[*].type` | string | Creature type (e.g. `"Humanoid (goblinoid)"`) |
| `monsters[*].size` | string | Size category (e.g. `"Small"`, `"Large"`) |
| `monsters[*].ac` | string | Armor class (e.g. `"15 (leather armor)"`) |
| `monsters[*].hp` | string | Hit points (e.g. `"7 (2d6)"`) |
| `monsters[*].speed` | string | Speed (e.g. `"30 ft."`) |
| `monsters[*].str` … `.cha` | number | Ability scores (STR / DEX / CON / INT / WIS / CHA) |
| `monsters[*].notes` | string | Special traits, attacks, or any additional info |

All top-level keys (`source`, `spells`, `feats`, `subclasses`, `monsters`) are **optional** — you can provide only the sections you need.

### What happens without extra source data

The app works exactly as before: only SRD 5.1 content is shown. The **"📗 Load Sources"** button is always visible but has no effect until you load a file. Once data is loaded, use the **Source** filter dropdown (All Sources / SRD / *your source name*) in the Spell Browser and Feat Browser to narrow results.

> **Important:** You are responsible for ensuring any data you load locally complies with the applicable licences. This project does not endorse or facilitate copyright infringement.
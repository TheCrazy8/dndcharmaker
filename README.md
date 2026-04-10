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
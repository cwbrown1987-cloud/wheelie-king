// Clothing store data. A clothing item = a base garment model (assets/clothing/base/<base>.glb, skinned to
// the Playground rider) + a look (colours, wordmarks/logos, or a painted texture PNG) + a price.
// New design = new entry here; no new model needed. Look fields (all optional):
//   base: fabric colour   texture: URL of a painted PNG on the base's UV template (replaces the generated art)
//   marks: [{ text, font: 'hoodrich' | any CSS font, color, at: anchor name from the base README, width (m), y offset (m) }]
//   pocket: kangaroo pocket (hoodie)   string: drawstring colour   hood: hood colour   hoodUp: hood worn up by default
//   trainers: upper, accent, sole, line, stripe (side stripe on the outer face)
export const CLOTHING_BASES = {
  hoodie: { slot: 'top', style: 'hoodie', label: 'Hoodie', file: 'hoodie.glb' },
  jumper: { slot: 'top', style: 'jacket', label: 'Crewneck jumper', file: 'jumper.glb' },
  tshirt: { slot: 'top', style: 'tee', label: 'T-shirt', file: 'tshirt.glb' },
  joggers: { slot: 'pants', style: 'joggers', label: 'Joggers', file: 'joggers.glb' },
  shorts: { slot: 'pants', style: 'shorts', label: 'Shorts', file: 'shorts.glb' },
  trainers: { slot: 'shoes', style: 'skate', label: 'Trainers', file: 'trainers.glb' },
};
const HR = (color, extra = {}) => ({ text: 'HOODRICH', font: 'hoodrich', color, ...extra });
export const CLOTHING = [
  { id: 'hr_hoodie_black', group: 'hr_hoodie', name: 'Hoodrich Core Hoodie', base: 'hoodie', price: 650, rarity: 'Epic',
    look: { base: '#16171a', string: '#0d0d0f', pocket: true, marks: [HR('#f4f4f2', { at: 'chest', width: 0.25 }), HR('#f4f4f2', { at: 'back', width: 0.27 })] } },
  { id: 'hr_hoodie_grey', group: 'hr_hoodie', name: 'Hoodrich Core Hoodie · Grey', base: 'hoodie', price: 650, rarity: 'Epic',
    look: { base: '#8e9197', string: '#1a1a1c', pocket: true, marks: [HR('#121214', { at: 'chest', width: 0.25 }), HR('#121214', { at: 'back', width: 0.27 })] } },
  { id: 'hr_hoodie_blackred', group: 'hr_hoodie', name: 'Hoodrich Core Hoodie · Black/Red', base: 'hoodie', price: 700, rarity: 'Legendary',
    look: { base: '#141416', string: '#c81e28', pocket: true, hoodUp: true, marks: [HR('#d4202c', { at: 'chest', width: 0.25 }), HR('#d4202c', { at: 'back', width: 0.27 })] } },
  { id: 'hr_joggers_black', group: 'hr_joggers', name: 'Hoodrich Core Joggers', base: 'joggers', price: 450, rarity: 'Epic',
    look: { base: '#16171a', marks: [HR('#f4f4f2', { at: 'thigh', width: 0.115 })] } },
  { id: 'hr_joggers_grey', group: 'hr_joggers', name: 'Hoodrich Core Joggers · Grey', base: 'joggers', price: 450, rarity: 'Epic',
    look: { base: '#8e9197', marks: [HR('#121214', { at: 'thigh', width: 0.115 })] } },
  { id: 'hr_trainers_white', group: 'hr_trainers', name: 'Court Trainers · Triple White', base: 'trainers', price: 380, rarity: 'Rare',
    look: { upper: '#f4f4f2', accent: '#dcdcd8', panel: '#e8e8e4', sole: '#fbfbf8', outsole: '#cfcfca', line: '#b9b9b4', stripe: '#d2d2cd', lace: '#ffffff', tab: '#1a1a1a' } },
  { id: 'hr_trainers_redwhite', group: 'hr_trainers', name: 'Court Trainers · Red/White', base: 'trainers', price: 420, rarity: 'Epic',
    look: { upper: '#f4f4f2', accent: '#c81e28', panel: '#f4f4f2', sole: '#fbfbf8', outsole: '#c81e28', line: '#c81e28', stripe: '#c81e28', lace: '#ffffff', tab: '#c81e28' } },
  // plain basics (prove the tee / jumper / shorts bases)
  { id: 'wk_tee_white', group: 'wk_tee', name: 'Plain Tee · White', base: 'tshirt', price: 120, rarity: 'Common', look: { base: '#efefea' } },
  { id: 'wk_tee_black', group: 'wk_tee', name: 'Plain Tee · Black', base: 'tshirt', price: 120, rarity: 'Common', look: { base: '#1b1c1f' } },
  { id: 'wk_tee_logo', group: 'wk_tee', name: 'Wheelie King Logo Tee', base: 'tshirt', price: 180, rarity: 'Rare', look: { base: '#1d6a3c', marks: [{ text: 'WHEELIE KING', font: '900 1px "Arial Black", Impact, system-ui, sans-serif', color: '#f2fff4', at: 'chest', width: 0.24 }] } },
  { id: 'wk_jumper_navy', group: 'wk_jumper', name: 'Plain Crewneck Jumper · Navy', base: 'jumper', price: 240, rarity: 'Common', look: { base: '#25355a' } },
  { id: 'wk_jumper_oat', group: 'wk_jumper', name: 'Plain Crewneck Jumper · Oat', base: 'jumper', price: 240, rarity: 'Common', look: { base: '#cbbd9f' } },
  { id: 'wk_shorts_charcoal', group: 'wk_shorts', name: 'Plain Shorts · Charcoal', base: 'shorts', price: 150, rarity: 'Common', look: { base: '#34373d' } },
];
const DESCRIPTIONS = {
  hoodie: 'Heavyweight pullover with kangaroo pocket, ribbed cuffs and hem, and drawstrings. Hood up or down.',
  jumper: 'Soft crewneck jumper with ribbed collar, cuffs and hem.',
  tshirt: 'Regular-fit cotton tee with a crew neck.',
  joggers: 'Tapered fleece joggers with ribbed ankle cuffs.',
  shorts: 'Loose shorts that stop just above the knee.',
  trainers: 'Low-top court trainers with a cushioned sole.',
};
const swatch = l => l.base || l.upper || '#888888', accentOf = l => l.marks?.[0]?.color || l.accent || l.string || '#ffffff';
// Shop/gear-state view of each item (same shape as gear-catalogue items; clothing:true marks the 3D rider garments).
export const CLOTHING_ITEMS = CLOTHING.map(c => ({ id: c.id, gear: true, clothing: true, garment: c.base, base: c.group, slot: CLOTHING_BASES[c.base].slot, category: 'clothing',
  style: CLOTHING_BASES[c.base].style, theme: c.id, name: c.name, primary: swatch(c.look), accent: accentOf(c.look), rarity: c.rarity, price: c.price, description: DESCRIPTIONS[c.base], look: c.look }));
export const clothingById = id => CLOTHING.find(c => c.id === id) || null;

// Bossfall rules and maths, shared by index.html, 3d.html, sim.js and tune.js.
// No DOM and no drawing in here: playRound() decides the whole round up front and the pages only show it.
// A round: one random champion (attack + mana), one boss, six cards from the deck in flip order.
const CHAMPS = [
  { name: 'Berserker',  icon: '🪓', atk: 15, mana: 0,  w: 3 },
  { name: 'Knight',     icon: '⚔️', atk: 12, mana: 2,  w: 3 },
  { name: 'Paladin',    icon: '🛡️', atk: 10, mana: 4,  w: 3 },
  { name: 'Ranger',     icon: '🏹', atk: 8,  mana: 5,  w: 3 },
  { name: 'Battlemage', icon: '🧙', atk: 6,  mana: 8,  w: 3 },
  { name: 'Archmage',   icon: '✨', atk: 3,  mana: 12, w: 3 },
  { name: 'Dragon',     icon: '🐉', atk: 14, mana: 8,  w: 1 },
];
const CARDS = [
  { name: 'Dagger',        icon: '🗡️', t: 'phys',  v: 3,   n: 5 },
  { name: 'Sword',         icon: '⚔️', t: 'phys',  v: 5,   n: 5 },
  { name: 'Axe',           icon: '🪓', t: 'phys',  v: 7,   n: 4 },
  { name: 'Lance',         icon: '🔱', t: 'phys',  v: 9,   n: 2 },
  { name: 'Warhammer',     icon: '🔨', t: 'phys',  v: 12,  n: 1 },
  { name: 'Spark',         icon: '⚡', t: 'spell', v: 6,   cost: 1, n: 4 },
  { name: 'Firebolt',      icon: '🔥', t: 'spell', v: 10,  cost: 2, n: 4 },
  { name: 'Lightning',     icon: '🌩️', t: 'spell', v: 15,  cost: 3, n: 3 },
  { name: 'Meteor',        icon: '☄️', t: 'spell', v: 24,  cost: 5, n: 2 },
  { name: 'Cataclysm',     icon: '🌋', t: 'spell', v: 40,  cost: 8, n: 1 },
  { name: 'Battle cry',    icon: '📯', t: 'mult',  v: 1.5, n: 4 },
  { name: 'Twin strike',   icon: '🤺', t: 'mult',  v: 2,   n: 3 },
  { name: "Dragon's fury", icon: '🐲', t: 'mult',  v: 3,   n: 1 },
];
const BOSSES = [
  { name: 'Bandit Lord', icon: '🦹', hp: 60 },
  { name: 'Lich King',   icon: '☠️', hp: 70 },
  { name: 'Stone Titan', icon: '🗿', hp: 80 },
  { name: 'Kraken',      icon: '🐙', hp: 95 },
];
// Tier by overkill (damage minus boss HP). Tier 0: the boss survives and nothing is paid.
const TIER_MIN = [0, 10, 25, 50, 100, 200, 400];
const TIER_LABEL = ['Boss survives', 'Beaten, 0–9 over', '10–24 over', '25–49 over', '50–99 over', '100–199 over', '200–399 over', '400+ over'];
// rtp is measured by sim.js; update it when cards, bosses or pays change.
const STANCES = {
  skirmish: { name: 'Skirmish',    tag: 'steady',   pay: [0, 1, 2, 2.5, 4, 7, 18, 50],  rtp: 96.2 },
  warband:  { name: 'Warband',     tag: 'balanced', pay: [0, 1, 1, 2, 3, 9, 38, 200],   rtp: 96.0 },
  dragon:   { name: 'Dragon hunt', tag: 'wild',     pay: [0, 1, 1, 1, 2, 7, 30, 1000],  rtp: 96.3 },
};
function tierOf(o) { let t = 0; for (let i = 0; i < TIER_MIN.length; i++) if (o >= TIER_MIN[i]) t = i + 1; return t; }
function effText(c) { return c.t === 'mult' ? '×' + c.v : '+' + c.v; }
// Artwork file name for a champion, boss or card: art/<slug>.webp.
function slug(n) { return n.toLowerCase().replace(/'/g, '').replace(/ /g, '-'); }
function pickWeighted(list, rng) {
  let r = rng() * list.reduce((a, x) => a + x.w, 0);
  for (const x of list) { r -= x.w; if (r < 0) return x; }
  return list[list.length - 1];
}
function playRound(rng = Math.random) {
  const champ = pickWeighted(CHAMPS, rng);
  const boss = BOSSES[Math.floor(rng() * BOSSES.length)];
  const deck = [];
  CARDS.forEach(c => { for (let i = 0; i < c.n; i++) deck.push(c); });
  let dmg = champ.atk, mana = champ.mana;
  const events = [];
  for (let i = 0; i < 6; i++) {
    const c = deck.splice(Math.floor(rng() * deck.length), 1)[0];
    let text, fx = c.t, voided = false;
    if (c.t === 'phys') { dmg += c.v; text = `${c.name} strikes: +${c.v} damage`; }
    else if (c.t === 'mult') { dmg = Math.floor(dmg * c.v); text = `${c.name}: all damage so far ×${c.v}!`; }
    else if (mana >= c.cost) { mana -= c.cost; dmg += c.v; text = `${c.name} costs ${c.cost} mana: +${c.v} damage`; }
    else { voided = true; fx = 'void'; text = `${c.name} needs ${c.cost} mana, you have ${mana}. It fizzles!`; }
    events.push({ card: c, fx, voided, dmg, mana, text });
  }
  const overkill = dmg - boss.hp;
  return { champ, boss, events, dmg, overkill, tier: tierOf(overkill) };
}

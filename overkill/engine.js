// Overkill round engine. This file is the stand-in for the Stake Engine math + RGS:
// it produces one finished round (a "book") with its payout multiplier, and the
// page only animates it. Nothing the player does after betting changes the result.
// Shared by index.html (script tag) and sim.js (require).
(function (root) {
  // w = how often the champion turns up, relative to the others.
  const CHAMPS = [
    { id: 'berserker',  name: 'Berserker',     icon: '🪓', atk: 14, mana: 0,  w: 3 },
    { id: 'knight',     name: 'Knight',        icon: '⚔️', atk: 12, mana: 2,  w: 3 },
    { id: 'paladin',    name: 'Paladin',       icon: '🛡️', atk: 11, mana: 4,  w: 3 },
    { id: 'ranger',     name: 'Ranger',        icon: '🏹', atk: 10, mana: 5,  w: 3 },
    { id: 'spellblade', name: 'Spellblade',    icon: '🗡️', atk: 8,  mana: 7,  w: 3 },
    { id: 'archmage',   name: 'Archmage',      icon: '🧙', atk: 6,  mana: 12, w: 3 },
    { id: 'dragon',     name: 'Dragon Knight', icon: '🐉', atk: 14, mana: 8,  w: 1 },
  ];
  // n = copies in the deck. Six are drawn each round, without replacement.
  const CARDS = [
    { id: 'curse',     name: 'Hex',          icon: '🕸️', t: 'mult',  v: 0.5, n: 5 },
    { id: 'warcry',    name: 'War Cry',      icon: '📯', t: 'mult',  v: 1.5, n: 6 },
    { id: 'twin',      name: 'Twin Strike',  icon: '⚔️', t: 'mult',  v: 2,   n: 6 },
    { id: 'frenzy',    name: 'Frenzy',       icon: '💢', t: 'mult',  v: 3,   n: 3 },
    { id: 'titan',     name: "Titan's Grip", icon: '✊', t: 'mult',  v: 5,   n: 2 },
    { id: 'godslayer', name: 'Godslayer',    icon: '👑', t: 'mult',  v: 10,  n: 1 },
    { id: 'spark',     name: 'Spark',        icon: '⚡', t: 'spell', v: 15,  cost: 1, n: 5 },
    { id: 'firebolt',  name: 'Firebolt',     icon: '🔥', t: 'spell', v: 30,  cost: 2, n: 5 },
    { id: 'lightning', name: 'Lightning',    icon: '🌩️', t: 'spell', v: 50,  cost: 3, n: 4 },
    { id: 'meteor',    name: 'Meteor',       icon: '☄️', t: 'spell', v: 100, cost: 5, n: 2 },
    { id: 'cataclysm', name: 'Cataclysm',    icon: '🌋', t: 'spell', v: 250, cost: 8, n: 1 },
  ];
  const BOSSES = [
    { id: 'bandit', name: 'Bandit Lord',  icon: '🦹', hp: 260 },
    { id: 'lich',   name: 'Lich King',    icon: '💀', hp: 180 },
    { id: 'titan',  name: 'Stone Titan',  icon: '🗿', hp: 210 },
    { id: 'kraken', name: 'Kraken',       icon: '🐙', hp: 150 },
  ];
  // Payout tiers by total damage as a multiple of the boss's HP.
  // Below 1x the boss survives and the round pays nothing.
  const TIERS = [
    { min: 0,   pay: 0,    label: 'Boss survives' },
    { min: 1,   pay: 1,    label: 'Slain' },
    { min: 2,   pay: 2,    label: '2× HP' },
    { min: 3,   pay: 3,    label: '3× HP' },
    { min: 5,   pay: 5,    label: '5× HP' },
    { min: 8,   pay: 10,   label: '8× HP' },
    { min: 15,  pay: 20,   label: '15× HP' },
    { min: 30,  pay: 50,   label: '30× HP' },
    { min: 60,  pay: 150,  label: '60× HP' },
    { min: 150, pay: 1000, label: '150× HP' },
  ];
  // Measured by sim.js. Update after changing anything above.
  const RTP = 96.6;
  const MAX_WIN = TIERS[TIERS.length - 1].pay;

  function tierOf(ratio) { let t = 0; for (let i = 0; i < TIERS.length; i++) if (ratio >= TIERS[i].min) t = i; return t; }
  function pickWeighted(list, rng) {
    let r = rng() * list.reduce((a, x) => a + x.w, 0);
    for (const x of list) { r -= x.w; if (r < 0) return x; }
    return list[list.length - 1];
  }
  function buildDeck() { const d = []; CARDS.forEach(c => { for (let i = 0; i < c.n; i++) d.push(c); }); return d; }

  // One round. Multipliers scale the champion's attack. Spells hit the boss directly
  // if there is mana left for them. After six cards the champion strikes for its attack.
  function playRound(rng) {
    rng = rng || Math.random;
    const champ = pickWeighted(CHAMPS, rng);
    const boss = BOSSES[Math.floor(rng() * BOSSES.length)];
    const deck = buildDeck();
    let mult = 1, mana = champ.mana, spellDmg = 0;
    const events = [];
    for (let i = 0; i < 6; i++) {
      const card = deck.splice(Math.floor(rng() * deck.length), 1)[0];
      let cast = true;
      if (card.t === 'mult') mult *= card.v;
      else if (mana >= card.cost) { mana -= card.cost; spellDmg += card.v; }
      else cast = false;
      events.push({ card: card.id, cast, atk: Math.round(champ.atk * mult), mult, mana, spellDmg });
    }
    const strike = Math.round(champ.atk * mult);
    const total = strike + spellDmg;
    const ratio = total / boss.hp;
    const tier = tierOf(ratio);
    return { champ: champ.id, boss: boss.id, events, strike, spellDmg, total, ratio, tier, payoutMultiplier: TIERS[tier].pay };
  }

  const api = { CHAMPS, CARDS, BOSSES, TIERS, RTP, MAX_WIN, tierOf, playRound };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ENGINE = api;
})(typeof self !== 'undefined' ? self : this);

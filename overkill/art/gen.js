// Generate Overkill's art through OpenRouter into raw/, skipping files that exist.
// usage: OPENROUTER_API_KEY=... node gen.js [name ...]   (names limit the run; delete a raw file to redo it)
// Then run convert.js to cut out the figures and write the small WebP files the game loads.
const fs = require('fs');
const path = require('path');

const MODEL = 'google/gemini-3.1-flash-image';
const RAW = path.join(__dirname, 'raw');
// The first approved image; every other one is asked to match its style.
const STYLE_REF = path.join(RAW, 'champ-berserker.png');

const STYLE = 'Hand-painted 2D game art in the style of a dark fantasy deck-building roguelike: bold dark outlines, flat painterly shading, slightly exaggerated proportions, muted palette with one strong accent colour. No text, no letters, no border, no frame, no user interface.';
const REF = 'Use the attached image only as a reference for drawing style, outline weight and shading; do not copy its subject or its colours.';
// Figures are painted on flat magenta so convert.js can cut them out.
const KEY = 'The background is one completely flat, solid, pure magenta colour (#FF00FF) with no gradient, no ground, no shadow on the floor and no scenery. The whole figure is inside the image with a clear magenta margin on every side, and nothing on the figure is magenta or pink.';
const champ = s => `${s}. Full body game character sprite seen from the side, facing right, in a ready battle stance. Square image. ${KEY} ${STYLE}`;
const boss = s => `${s}. A huge, menacing boss monster sprite for a game, full body, facing left, looming. Square image. ${KEY} ${STYLE}`;
const card = (s, bg) => `${s}. Card illustration for a game: one bold subject filling most of the image, reads clearly at thumbnail size, ${bg} background with a soft glow behind the subject. Landscape 4:3 image. ${STYLE}`;
const BOOST = 'dark warm red and amber', CURSE = 'dark violet and black', SPELL = 'deep midnight blue';

const ART = {
  'champ-berserker': champ('A wild bare-chested berserker with a red beard, fur pelt and a huge two-handed battle axe'),
  'champ-knight': champ('A sturdy knight in steel plate armour with a longsword and a kite shield with a red crest'),
  'champ-paladin': champ('A paladin in white and gold armour with a glowing golden warhammer and a tower shield'),
  'champ-ranger': champ('A hooded ranger in a green cloak drawing a longbow, a faint blue glow on the arrow tip'),
  'champ-spellblade': champ('A lithe spellblade in dark leather, a curved sword in one hand wreathed in blue arcane flame'),
  'champ-archmage': champ('An old archmage with a long white beard in deep blue star-patterned robes, raising a staff crackling with blue lightning'),
  'champ-dragon': champ('A dragon knight in golden scaled armour with a horned dragon helm, small dragon wings and a flaming lance'),
  'boss-bandit': boss('A bandit lord: a giant masked brute in spiked black leather and a tattered red cape, holding two cruel curved blades'),
  'boss-lich': boss('A lich king: a crowned skeletal sorcerer in tattered royal purple robes with green ghost-fire in its eye sockets and hands'),
  'boss-titan': boss('A stone titan: a towering golem of cracked grey granite with molten orange lava glowing in the cracks'),
  'boss-kraken': boss('A kraken: a colossal dark teal sea monster with many thick tentacles and one glowing yellow eye'),
  'card-curse': card('A sinister spider web with a glowing purple skull sigil caught in the middle', CURSE),
  'card-warcry': card('A golden war horn being blown, bright sound waves bursting from it', BOOST),
  'card-twin': card('Two gleaming swords crossed in an X with sparks where they meet', BOOST),
  'card-frenzy': card('A snarling red-eyed warrior face mid battle roar, blood-red aura flaring around it', BOOST),
  'card-titan': card('A giant armoured gauntlet fist clenched and crackling with golden power', BOOST),
  'card-godslayer': card('A radiant golden crown pierced by a colossal glowing greatsword, beams of light bursting outward', BOOST),
  'card-spark': card('A small bright blue-white spark of electricity, a tiny star-shaped burst', SPELL),
  'card-firebolt': card('A blazing orange fireball flying with a trailing tail of flame', SPELL),
  'card-lightning': card('A huge forked bolt of white-blue lightning striking down', SPELL),
  'card-meteor': card('A flaming meteor rock falling diagonally with a long fiery trail', SPELL),
  'card-cataclysm': card('An erupting volcano with a giant column of lava and fire splitting the sky', SPELL),
  back: `An ornate fantasy playing card back, perfectly symmetrical, tarnished gold filigree on dark crimson leather, a glowing ember rune sigil in the centre, flat front-on view filling the whole image edge to edge. Portrait 5:7 image. ${STYLE} ${REF}`,
  bg: `A side-on battle arena backdrop for a game: the inside of a dark ruined spire, tall broken stone pillars and arches fading into purple mist, a few dim torches, and a flat cracked stone floor across the bottom quarter of the image. Empty: no characters, no creatures. Dark and low contrast so characters stand out in front of it, deep purple, indigo and brown. Landscape 4:3 image. ${STYLE} ${REF}`,
};

async function generate(name, prompt) {
  const content = [{ type: 'text', text: name === 'champ-berserker' ? prompt : `${prompt} ${prompt.includes(REF) ? '' : REF}` }];
  if (name !== 'champ-berserker') content.push({ type: 'image_url', image_url: { url: 'data:image/png;base64,' + fs.readFileSync(STYLE_REF).toString('base64') } });
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, modalities: ['image', 'text'], usage: { include: true }, messages: [{ role: 'user', content }] }),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`${res.status} ${JSON.stringify(body.error || body).slice(0, 300)}`);
  const images = body.choices[0].message.images || [];
  if (!images.length) throw new Error('no image returned: ' + JSON.stringify(body.choices[0].message).slice(0, 300));
  const m = images[0].image_url.url.match(/^data:image\/(\w+);base64,(.+)$/);
  // Always saved as .png: the name only has to be stable, Chromium reads the real format.
  fs.writeFileSync(path.join(RAW, `${name}.png`), Buffer.from(m[2], 'base64'));
  return (body.usage && body.usage.cost) || 0;
}

(async () => {
  fs.mkdirSync(RAW, { recursive: true });
  const only = process.argv.slice(2);
  const have = new Set(fs.readdirSync(RAW).map(f => f.replace(/\.\w+$/, '')));
  const todo = Object.keys(ART).filter(n => (only.length ? only.includes(n) : true) && !have.has(n));
  let cost = 0, failed = 0;
  const worker = async () => {
    for (let name; (name = todo.shift());) {
      for (let attempt = 1; ; attempt++) {
        try { const c = await generate(name, ART[name]); cost += c; console.log('ok', name, '$' + c.toFixed(3)); break; }
        catch (e) {
          if (attempt === 3) { failed++; console.log('FAILED', name, e.message); break; }
          await new Promise(r => setTimeout(r, 5000 * attempt));
        }
      }
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  console.log(`done, failed ${failed}, cost $${cost.toFixed(2)}`);
})();

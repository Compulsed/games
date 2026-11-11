// Generate every piece of Bossfall art through OpenRouter into raw/, skipping files that exist.
// usage: OPENROUTER_API_KEY=... node gen-all.js [name ...]   (names limit the run; delete a raw file to redo it)
const fs = require('fs');
const path = require('path');

const MODEL = 'google/gemini-3.1-flash-image';
const RAW = path.join(__dirname, 'raw');
// The first approved image; every other one is asked to match its style.
const STYLE_REF = path.join(RAW, 'berserker.png');

const STYLE = 'Fantasy trading card illustration, painterly brushwork, gold rim light, portrait 5:7 aspect ratio, no text, no letters, no border, no frame.';
const REF = 'Use the attached image only as a reference for painting style, palette and lighting; do not copy its subject.';
const champ = s => `${s}, heroic full figure, centred in the upper three quarters of the image, dark purple stormy background, the bottom fifth of the image dark and uncluttered. ${STYLE} ${REF}`;
const boss = s => `${s}, a menacing boss monster, centred in the upper three quarters of the image, dark crimson and black background with ember glow, the bottom fifth of the image dark and uncluttered. ${STYLE} ${REF}`;
const icon = (s, bg) => `${s}. One single object, very large, in the upper two thirds of the image, bold simple shape that reads clearly at thumbnail size, no people, no hands, plain ${bg} background with a soft glow behind the object, the bottom third dark and empty. ${STYLE} ${REF}`;
const STEEL = 'dark slate grey', BLUE = 'deep midnight blue', GOLD = 'dark amber and bronze';

const ART = {
  knight: champ('A knight in polished plate armour with a longsword and shield'),
  paladin: champ('A paladin in white and gold armour holding a glowing warhammer and a tower shield'),
  ranger: champ('A hooded ranger drawing a longbow, a faint blue magical glow on the arrow'),
  battlemage: champ('A battlemage in leather and light armour, a sword in one hand and blue fire in the other'),
  archmage: champ('An old archmage in flowing star-patterned robes, a staff crackling with bright blue arcane energy'),
  dragon: champ('A huge golden-scaled dragon rearing up with wings spread, blue fire in its jaws'),
  'bandit-lord': boss('A bandit lord, a masked brute in spiked black leather with two cruel curved blades'),
  'lich-king': boss('A lich king, a crowned skeletal sorcerer in tattered royal robes with green ghost-fire in its eye sockets'),
  'stone-titan': boss('A stone titan, a towering giant made of cracked granite with molten lava glowing in the cracks'),
  kraken: boss('A kraken, a colossal sea monster with huge tentacles rising from a black sea, one glowing eye'),
  dagger: icon('A steel dagger pointing upward', STEEL),
  sword: icon('A broad steel longsword pointing upward', STEEL),
  axe: icon('A heavy double-bladed battle axe', STEEL),
  lance: icon('A long steel trident spear pointing upward', STEEL),
  warhammer: icon('A massive iron warhammer with a square head', STEEL),
  spark: icon('A small bright blue-white spark of electricity, a tiny star-shaped burst', BLUE),
  firebolt: icon('A blazing orange fireball with a trailing tail of flame', BLUE),
  lightning: icon('A huge forked bolt of white-blue lightning', BLUE),
  meteor: icon('A flaming meteor rock falling diagonally with a long fiery trail', BLUE),
  cataclysm: icon('An erupting volcano with a giant column of lava and fire', BLUE),
  'battle-cry': icon('A golden war horn with banners, sound waves bursting from it', GOLD),
  'twin-strike': icon('Two identical golden swords crossed in an X', GOLD),
  'dragons-fury': icon('A roaring golden dragon head breathing a burst of fire', GOLD),
  back: `An ornate fantasy playing card back design, perfectly symmetrical, gold filigree on deep purple, a glowing rune sigil in the centre, flat front-on view filling the whole image edge to edge. ${STYLE} ${REF}`,
  bg: `A very dark, moody fantasy boss arena: a misty ruined throne hall with broken pillars, deep purple and black, low contrast, faint gold light from above, no characters, no creatures. Painterly brushwork, tall portrait 9:16 aspect ratio, no text. ${REF}`,
};

async function generate(name, prompt) {
  const ref = 'data:image/png;base64,' + fs.readFileSync(STYLE_REF).toString('base64');
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + process.env.OPENROUTER_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: MODEL, modalities: ['image', 'text'], usage: { include: true },
      messages: [{ role: 'user', content: [{ type: 'text', text: prompt }, { type: 'image_url', image_url: { url: ref } }] }],
    }),
  });
  const body = await res.json();
  if (!res.ok || body.error) throw new Error(`${res.status} ${JSON.stringify(body.error || body).slice(0, 300)}`);
  const images = body.choices[0].message.images || [];
  if (!images.length) throw new Error('no image returned: ' + JSON.stringify(body.choices[0].message).slice(0, 300));
  const m = images[0].image_url.url.match(/^data:image\/(\w+);base64,(.+)$/);
  const file = path.join(RAW, `${name}.${m[1] === 'jpeg' ? 'jpg' : m[1]}`);
  fs.writeFileSync(file, Buffer.from(m[2], 'base64'));
  return (body.usage && body.usage.cost) || 0;
}

(async () => {
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

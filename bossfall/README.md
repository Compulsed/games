# Bossfall

A play-coin prototype of a fantasy card game: flip a random champion, flip six
face-down cards in any order, and out-damage the boss. Live at
https://compulsed.github.io/games/bossfall/.

The game is `index.html`, the rules in `engine.js` and the pictures in `art/`:
no build step and no external requests.

- `engine.js` holds the champions, cards, bosses, payouts and `playRound()`,
  which decides a whole round up front. The pages only show the result.
- `sim.js` measures tier odds and return to player for each stance:
  `node sim.js 100000000`. Put the result in the `rtp` fields in `engine.js`
  after changing cards, bosses or payouts.
- `tune.js` tries a set of boss HP values without editing the game:
  `node tune.js 60,70,80,95`.
- `art/` holds the artwork as `<name>.webp`, one per champion, boss and card,
  plus `back.webp` and `bg.webp`. A missing picture falls back to an emoji.
  `art/gen-all.js` generates the full-size images through OpenRouter into
  `art/raw/` (not committed; it needs `raw/berserker.png` as the style
  reference) and `art/convert.js` shrinks them to WebP.
- `shoot.js` plays rounds at phone sizes with Playwright and saves screenshots.
  `shoot-flip.js` captures the card flips and both endings part-way through.

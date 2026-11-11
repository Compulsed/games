# Bossfall

A play-coin prototype of a fantasy card game: flip a random champion, flip six
face-down cards in any order, and out-damage the boss. Live at
https://compulsed.github.io/games/bossfall/.

The whole game is `index.html`: no build step and no external requests.

- `sim.js` measures tier odds and return to player for each stance:
  `node sim.js 100000000`. Put the result in the `rtp` fields in `index.html`
  after changing cards, bosses or payouts.
- `tune.js` tries a set of boss HP values without editing the game:
  `node tune.js 60,70,80,95`.
- `shoot.js` plays rounds at phone sizes with Playwright and saves screenshots.

# Overkill

A Slay-the-Spire-flavoured casino game, built as a proof of concept for the Stake Engine RGS rules.
Play it at https://compulsed.github.io/games/overkill/.

Each round deals a champion (Attack and mana) and six face-down cards against a random boss.
Boosts multiply the champion's Attack (×0.5 to ×10), spells hit the boss if there is mana to cast them,
and after the sixth card the champion strikes. The payout depends on total damage as a multiple of the boss's HP.

## Files

- `engine.js`: the maths. `playRound()` returns one finished round (champion, boss, the six card events, payout multiplier).
  It stands in for the RGS: the page only animates the round it is given.
- `index.html`: the game. No build step, no external requests. Balance is demo credits kept in `localStorage`.
- `sim.js`: `node sim.js 60000000` prints tier odds, RTP and hit rate.

## Maths (60M simulated rounds)

RTP 96.6%, hit rate 1 in 3.2, max win 1000x at about 1 in 32,000, every tier in between reachable.
Change anything in `engine.js`, then rerun `sim.js` and update `RTP` there.

## Not done yet

The real RGS calls (`authenticate`, `play`, `end-round`), replay mode, social-mode wording, currencies and translations.
The art is emoji.

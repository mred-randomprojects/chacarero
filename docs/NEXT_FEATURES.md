# Next features

Requirements dictated by Maxi on 2026-09-21, broken down into trackable items, plus
the plan to build them and a running progress log. Whoever picks this up (human or
agent) should read **Progress** at the bottom first: it says what is shipped, what is
half-done and what to do next.

Conventions: every item has a status box. `[ ]` not started · `[~]` in progress ·
`[x]` shipped (committed on `main`). Sub-items are the acceptance criteria.

---

## 1. Dice close-up after every throw

- [x] 1.1 After the two dice settle on the table, they rise and float straight into
      the camera, big, with the rolled faces pointing at the viewer, so the result is
      unmistakable (a 5 and a 5 read as two fives).
- [x] 1.2 They hold there long enough to read, then return to where they landed on the
      table; only then does the rest of the turn replay (banners, pawn move).
- [x] 1.3 Everyone at the table sees the same presentation (it is driven by the same
      throw id/seed as the tumble).

## 2. Opening roll: who starts

- [x] 2.1 Before the first turn every player throws the dice once, in seat order, with
      the same hold-to-shake interaction as a normal roll.
- [x] 2.2 Highest total starts. Ties re-roll among the tied players only, until one
      wins.
- [x] 2.3 It must feel interactive: each throw gets the close-up (item 1), a banner
      ("Lautaro sacó 9"), a scoreboard of the rolls so far, and a final "Empieza
      Lautaro" with the camera flying to them.
- [x] 2.4 Works online (server rolls, clock defaults apply) and in hot-seat mode.

## 3. Player cards at the bottom of the screen

- [x] 3.1 A row of cards floating at the bottom centre, one per player: token icon +
      colour, name, cash. Starting cash (e.g. $35.000) is visible from the first
      second.
- [x] 3.2 The card of the player on turn is highlighted; jail / bankrupt / offline
      states are visible on the card.
- [x] 3.3 The cash figure animates (counts) when it changes, in sync with the replay.
- [x] 3.4 Replaces the top-left player list (title, room code and buttons move to a
      slim top bar so nothing is lost).

## 4. Pick your token (piece)

- [x] 4.1 A set of tokens to choose from (more than six so a full table still has a
      choice); each token has its own colour and 3D shape on the board, and an icon
      used everywhere in the HUD (cards, prompts, map pins, trade partner buttons).
- [x] 4.2 A token taken by one player is blocked for the others (hot-seat setup and
      online lobby).
- [x] 4.3 Token + colour + pawn are one identity: everywhere the game shows a player it
      uses the same icon and colour.
- [x] 4.4 Pawns on the board use the token's shape instead of the generic chess pawn.

## 5. Shared, directed camera

- [x] 5.1 When a turn starts, a big close-up of that player's pawn on the board, with
      the board still visible.
- [x] 5.2 By default every screen sees the same thing: the camera follows the action
      (turn start → pawn; throw → dice; move → pawn; landing → tile; card → card).
- [x] 5.3 Looking somewhere else is a deliberate act: dragging the camera or opening
      the map / properties switches that screen to free camera until the next turn
      starts (then it re-joins the director); a button/setting turns the director
      off entirely.
- [x] 5.4 When money is paid, it visibly leaves the payer's card at the bottom and
      flies into the receiver's card (or the bank), on top of the bills flying on the
      table.

## 6. Big property card when landing on a free deed

- [x] 6.1 Landing on a free campo / ferrocarril / compañía presents the deed as a big
      card in front of the screen, with a floating-up animation.
- [x] 6.2 Two options: buy (price shown) or send to auction.
- [x] 6.3 On the right, everything the deed says: price, rent bare, rent with the whole
      province, rent per chacra count and estancia, chacra and estancia cost,
      mortgage value (railways: rent by count; companies: dice multipliers).
- [x] 6.4 The same presentation stays up while the deed is being auctioned.

## 7. Gamified camera flight between turns

- [x] 7.1 The move from one pawn to the next is continuous, never a cut: it
      accelerates out (rising away from the table), then decelerates into the next
      pawn.
- [x] 7.2 Fast enough not to bore, slow enough to read as a flight (~1.5 s).

## 8. Suerte / Destino cards, and calmer timers

- [x] 8.1 Landing on Suerte/Destino first prompts the player to draw the card.
- [x] 8.2 The card slides out of its deck, comes up to the screen and flips so the text
      can be read; then a prompt to apply it once read.
- [x] 8.3 Countdowns are not shown until the last minute of a decision; the clocks keep
      working underneath (defaults still fire for absent players).

## 9. 2D board map on a key press

- [x] 9.1 A key (and a button) opens a simplified 2D map of the hex ring: every square
      with its colour band, the owner's colour, buildings and mortgage state.
- [x] 9.2 A pin with each player's token icon on the square they stand on.
- [x] 9.3 Side statistics: free properties, per-player holdings, buildings left in the
      bank, etc.
- [x] 9.4 Clicking a square selects it (opens its panel) so building/mortgaging is one
      click away; the old property list remains reachable from the map.

## 10. Dice thrown next to the pawn

- [x] 10.1 The dice land near the current player's pawn instead of the middle of the
      felt.
- [x] 10.2 A die that lands on a pawn knocks it: the pawn wobbles and the die deflects.
      (Deterministic, seeded — no physics engine, so every screen sees the same
      throw.)

## 11 + 14 + 15 + 16. Trade menu redesign

- [ ] 11.1 A big, beautiful trade screen, split in two: what you offer and what you
      want. Deeds and cash on both sides.
- [ ] 14.1 First step: one big button per other player (token icon + colour + name) to
      pick who you negotiate with.
- [ ] 15.1 Each side shows a 2D minimap grid of that player's deeds: every deed has a
      fixed slot on the grid (by province / railways / companies), owned ones are
      lit, the rest are ghosts.
- [ ] 15.2 Hovering a slot shows the full card big (colour, price, rent…); clicking
      toggles it into the offer / the request.
- [ ] 15.3 A cash amount can be set on each side.
- [ ] 16.1 Each side shows its total value: the sum of the deeds' face prices (not what
      was paid for them) plus the cash, so the fairness of the trade is visible at a
      glance.
- [ ] 11.2 The other player answers from their screen (accept / reject / counter),
      seeing the same layout.

## 12. Faster moves, and the path lights up

- [x] 12.1 Rolling N lights up the next N squares in order, signalling where the pawn
      is going, before/while it walks.
- [x] 12.2 A key skips the walking animation (jump to the destination) for players who
      want to go fast.

## 13. Trade whenever

- [ ] 13.1 A trade can be proposed at (almost) any moment of your own turn, including
      when you owe money and before you pay it — not only between steps.
- [ ] 13.2 Nobody is auto-charged by the decision clock while they are in the middle of
      a trade: proposing pauses the decision, and composing a trade keeps the clock
      from firing.

## 17. Trade outcome celebration

- [ ] 17.1 Accepted: a handshake + confetti + happy sound.
- [ ] 17.2 Rejected: sad trombone + a small "no deal" animation.
- [ ] 17.3 Sound throughout (cards, dice, money, trade outcome).

---

## Structural analysis

What the requirements touch, from the bottom of the stack up:

- **Engine** (`src/game/engine`): players carry a `token`; new phases `openingRoll`
  (item 2) and `awaitingDraw` (item 8); `canProposeTrade` opens up (item 13);
  `Player.color` stays (derived from the token) so nothing downstream breaks.
- **Protocol / server** (`src/net`, `server/`): `chooseToken` and `composing`
  messages; `RoomPlayer.token`; the deadline is not fired while the active player
  is composing a trade (item 13.2).
- **Sessions** (`src/session`): `composing` flag alongside `shaking`.
- **Scene** (`src/scene`): dice presentation + landing near the pawn + pawn knock
  (items 1, 10); camera director with arc flights and manual override (5, 7); the
  presented deed card (6); path highlights (12); token-shaped pawns (4).
- **HUD** (`src/ui`): bottom player cards with money flights (3, 5.4); top bar; big
  property panel (6); trade screen (11/14/15/16); 2D map (9); draw prompt (8.1);
  countdown hidden until the last minute (8.3); celebration overlays (17).
- **Audio**: synthesized sad trombone (17.2); everything else reuses the Kenney set.

Order of work (each step is one or more commits, each pushed to `main`):

1. Tokens (4) — every later HUD piece uses token icons.
2. Bottom player cards + top bar (3), money flights to the cards (5.4).
3. Dice close-up (1) and dice near the pawn with the knock (10).
4. Opening roll (2).
5. Camera director: pawn close-up at turn start, arc flights, override (5, 7).
6. Draw step for cards (8.1, 8.2) and hidden countdown (8.3).
7. Big property card (6).
8. Path highlights and skip (12).
9. 2D map (9).
10. Trade redesign (11/14/15/16), trade-anytime + composing (13), celebration (17).

---

## Progress

Newest entry first. Each entry names the commit(s) so the next agent can `git log`.

- **2026-09-21 — 2D map (9) (`c259b78`).** `src/ui/BoardMap.tsx`: SVG from
  `BOARD_LAYOUT` (board y flipped), `HexMap` + `MapStats`, tabs Mapa/Lista; the
  list body is now `PropertiesTable` in `PropertiesList.tsx` (modal wrapper gone).
  Top bar button renamed "Mapa"; key `L` unchanged.
- **2026-09-21 — path lights + skip (12) (`9b67c9b`).** `GameScreen` computes
  `path` (next N squares in `awaitingMove`, or the rest of the walking route) →
  `Board` → `Tile` (`pathStep`/`pathLength`); the tile material's emissive is now
  driven per frame in `Tile.tsx` (hover/selected included). Skipping the walk was
  already Enter/Space (`skip()` in `usePlayback`); the move banner now says so.
- **2026-09-21 — big property card (6) (`b798222`).** Effects `presentDeed` /
  `hideDeed` on the bus; `PresentedDeed` in `Effects.tsx` (lifts from the bank
  pile, 2x scale, 3x texture via `deedCardTexture(deed, holding, scale)`).
  `GameScreen` requests it while `awaitingBuyDecision` / `auction` and not busy,
  and hides the hover `SquarePanel` meanwhile. `Prompt`'s buy case is the
  `deed-offer` layout (band colour, buttons left, `DeedDetails` right); the stage
  docks to the right for it via `.stage:has(.deed-offer)`.
- **2026-09-21 — draw step + calm timers (8) (`117c528`).** Phase
  `awaitingDraw { deck }` + `drawCard` action/request (protocol, timing default,
  `roll()` helper walk through it). `ChanceCard` in `Effects.tsx` slides out of
  the deck face down (`SLIDE_SECONDS`) before the rise-and-flip. `Countdown` in
  `Prompt.tsx` renders nothing above 60 s remaining.
- **2026-09-21 — camera director (5, 7) (`c0b7983`).** `pawnView()` in
  `cameraViews.ts`; `CameraRig` flights take `style: "arc"` (rise + quartic ease)
  and report user input through `onUserControl`; `GameScreen` keeps `freeLook`
  (set by drag/wheel/camera keys/buttons, cleared by `directorCue()` at every
  turn change); `CameraBar` is three-state (Sigue la partida / Volver a la partida
  / Cámara libre). Modals deliberately do NOT switch to free look — closing them
  puts you back in sync. 5.2's per-step cues were already in place (dice present
  to the camera, pawn chase, card hovers in front of the camera).
- **2026-09-21 — opening roll (2) (`5d7f821`).** Phase `openingRoll { contenders,
  rolls }` in `state.ts`; `openingRoll()` in `actions.ts` driven by the normal
  `rollDice` request (so the server, the clock defaults and the hold-to-shake UI
  needed no new message). `currentPlayerIndex` points at whoever must throw, so
  the camera/seat logic follows for free. Scoreboard prompt in `Prompt.tsx`.
  `canManageHoldings` is false during the opening. Tests: engine + room.
- **2026-09-21 — dice close-up + landing near the pawn (1, 10) (`b552be4`).**
  `Dice.tsx` gained a `present` mode (rise into the camera, hold, return; the
  `onSettled` callback fires after it). Throws aim at `throwTarget()` in
  `src/scene/pawnSpots.ts` (felt just inside the ring in front of the roller's
  square); pawn obstacles come from `Scene.tsx`; a hit writes to `pawnKnocks`
  (`src/scene/pawnKnocks.ts`) and the `Pawn` rocks. `diceHurry` in the same file
  lets Space/Enter cut the hold short. Note: a quick keyboard tap of Space does
  not throw (keydown/keyup closure staleness); holding works, and the button works.
- **2026-09-21 — bottom player cards (3, 5.4) (`43b0801`).** `src/ui/PlayerCards.tsx`
  (row at the bottom centre, counting cash, turn highlight, states, Banco card),
  `src/ui/TopBar.tsx` (title, code, turn, buttons) replacing `PlayersPanel`, and
  `src/ui/MoneyFlights.tsx`: subscribes to the effects bus and mirrors every
  `money` effect as HTML bills flying from the payer's card to the receiver's
  (`data-party` attributes locate the cards). Gotcha: Web Animations with a
  delay need `fill: "both"`, or the element sits at (0,0) until it starts.
- **2026-09-21 — tokens (4) (`a628dc0`).** Eight tokens in `src/game/tokens.ts`
  (colour + emoji icon + name), 3D shapes from primitives in `src/scene/Token.tsx`,
  pickers in the hot-seat setup and the online lobby (`chooseToken` message, taken
  pieces refused by the server), `Player.token` in the engine with `Player.color`
  derived from it, `TokenIcon` replacing colour dots in the HUD. Banner and log
  still use small colour dots (deliberate: they are compact).
- **2026-09-21 — requirements captured.** This file. Nothing built yet.

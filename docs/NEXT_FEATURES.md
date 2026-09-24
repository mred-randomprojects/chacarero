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

- [x] 11.1 A big, beautiful trade screen, split in two: what you offer and what you
      want. Deeds and cash on both sides.
- [x] 14.1 First step: one big button per other player (token icon + colour + name) to
      pick who you negotiate with.
- [x] 15.1 Each side shows a 2D minimap grid of that player's deeds: every deed has a
      fixed slot on the grid (by province / railways / companies), owned ones are
      lit, the rest are ghosts.
- [x] 15.2 Hovering a slot shows the full card big (colour, price, rent…); clicking
      toggles it into the offer / the request.
- [x] 15.3 A cash amount can be set on each side.
- [x] 16.1 Each side shows its total value: the sum of the deeds' face prices (not what
      was paid for them) plus the cash, so the fairness of the trade is visible at a
      glance.
- [x] 11.2 The other player answers from their screen (accept / reject / counter),
      seeing the same layout.

## 12. Faster moves, and the path lights up

- [x] 12.1 Rolling N lights up the next N squares in order, signalling where the pawn
      is going, before/while it walks.
- [x] 12.2 A key skips the walking animation (jump to the destination) for players who
      want to go fast.

## 13. Trade whenever

- [x] 13.1 A trade can be proposed at (almost) any moment of your own turn, including
      when you owe money and before you pay it — not only between steps.
- [x] 13.2 Nobody is auto-charged by the decision clock while they are in the middle of
      a trade: proposing pauses the decision, and composing a trade keeps the clock
      from firing.

## 17. Trade outcome celebration

- [x] 17.1 Accepted: a handshake + confetti + happy sound.
- [x] 17.2 Rejected: sad trombone + a small "no deal" animation.
- [x] 17.3 Sound throughout (cards, dice, money, trade outcome).

---

# Batch 2 (2026-09-21, after playing batch 1)

Maxi's review of the first batch, with screenshots. Same conventions. The
guiding rule he added, now in `docs/GUIDELINES.md`: **the game is a play in a
theatre — whatever happens on the table, the camera follows it, step by step**.
Numbers updating and pop-ups saying what happened are not enough.

## B1. Bigger icons at setup

- [x] B1.1 The token icons in the setup / lobby pickers are too small to tell
      apart; make them big (with the name), pick-by-sight.

## B2. No building limit

- [x] B2.1 The bank never runs out of chacras or estancias: remove the limit from
      the engine and the "32 chacras · 12 estancias" counters from the HUD/map.
      (Maxi: limiting buildings is not a good idea. It was in the engine before
      batch 1; surfacing it on the Banco card was what he noticed.)

## B3–B6, B14. Dice that behave

- [x] B3.1 Shaking must look like dice in a cupped hand: a rhythmic rattle in
      front of the camera (the hands are the camera), not random jitter above
      the seat.
- [x] B4.1 After the dice come to rest, wait ~1.5 s so everyone can read them on
      the table, then do the close-up.
- [x] B5.1 Dice never teleport: every relocation is a visible flight (grabbing
      them from where they lie into the hands, throwing, the close-up and back to
      exactly where they landed).
- [x] B6.1 The two dice never pass through each other: separated landing spots
      and mid-flight separation so they read as solid.
- [x] B14.1 Doubles: the dice glow gold for a moment and "¡DOBLES!" flashes on
      screen.

## B7, B15, B18. Step by step, and nothing gets stuck

- [x] B7.1 The deed on offer must not flash-appear, vanish and reappear: it
      appears once, after the pawn has arrived and the landing has been
      announced.
- [x] B15.1 Nothing that belongs to a later step shows up early (the card on
      offer while the pawn is still walking, etc.): what the table shows is
      driven by the replayed view state, not by the final game state.
- [x] B18.1 A lifted deed can never get stuck on screen (it did after a buy):
      showing/hiding is derived from state, not from fire-and-forget bus
      messages that a skip could swallow. Tests for the view-state rules.

## B8. The offer's buttons belong next to the card

- [x] B8.1 The buy / auction panel sits beside the lifted deed (right of it,
      vertically aligned), not in the top-right corner.

## B9, B11, B17. The camera is the audience

- [x] B9.1 The camera follows the pawn hop by hop, close behind it, looking
      inward across the board.
- [x] B11.1 Movement is slower: no rush, seeing things move is the fun. Replay
      timings (clock allowance) stay in sync with the scene speeds.
- [x] B17.1 Every replayed happening gets a camera cue: money flying between
      piles, a deed flying from the bank to a seat, a building dropping, going
      to jail, a bankruptcy. Not just the pawn and the turn start.
- [x] B17.2 A landing gets a small flourish (settle on the tile; the deed lift
      is the flourish for a free deed).

## B12. Cards say what the real ones say

- [x] B12.1 Railway and company deeds carry the explanatory text of the physical
      cards (on the table texture, the lifted card and the details panel), not
      just the number ladder.

## B13. Focus on a player

- [x] B13.1 Clicking a player's card at the bottom flies to their side of the
      table (their deeds and money); the number keys stay as a shortcut.

## B16, B20. Keys that are safe, and visible

- [x] B16.1 Space/Enter never take a decision with consequences (buy, bid,
      accept a trade, pay-or-draw choice); they only advance the harmless steps.
- [x] B20.1 Every action button shows its shortcut ("Negociar [N]"), and the key
      does what the button does. Keys must not collide with the camera keys.

## B19. Real cards in the trade screen (and beyond)

- [x] B19.1 The preview in the middle is the real card (same artwork as on the
      table), not a restyled table.
- [x] B19.2 What is on the table on each side is shown as a fan of real cards,
      like a hand, not as a text list.
- [x] B19.3 The same real-card artwork is used wherever deeds are listed in the
      HUD (the compact trade prompt at least).

## B21. Square corners

- [x] B21.1 Card-like UI (deed slots, previews, hands, player cards) has square
      corners like the physical cards; panels lose most of their rounding.

## B22. Table layout

- [x] B22.1 A player's deed cards on the table never collide visually with their
      bill stacks (screenshot 3).

## Guidelines

- [x] G.1 `docs/GUIDELINES.md` with the project rules (one 3D scene, theatre
      camera, step by step, no unrequested scope), linked from the README.

---

# Batch 3 (2026-09-21, second review — things batch 2 claimed and did not deliver)

Maxi played again. Several batch-2 fixes were not actually working; this
batch fixes them for real and adds programmatic verification (sampling the
camera and pawn positions during a scripted run), not just screenshots.

## C1. No seat flights; the seat view is an instant peek

- [x] C1.1 The director never flies to a player's seat by itself (not during the
      opening throws, not anywhere): it stays on the pawns/the board.
- [x] C1.2 Looking at your own side (deeds and money) is a **snap**: the number
      key / the player card / "Mi lugar" jump there instantly; pressing again
      (or Escape) snaps back to where the camera was. No flight.

## C2, C5, C8, C10. Pawns teleport and the camera does not follow the first player

- [x] C10.1 Pawns never teleport: the scene's pawn positions come from the
      replayed view (the position changes when the move event is applied, not
      when the state arrives). Test.
- [x] C2.1 The camera follows the walking pawn hop by hop for every player,
      every turn — verified by sampling the camera target against the pawn
      position during a scripted run.
- [x] C5.1 A plain click on the board (selecting a square) must not hand the
      camera to the user; only a real drag or the wheel does. (This is why the
      director died for one player and came back for the next.)
- [x] C8.1 The director cue at the start of a turn fires even when the same
      player throws last in the opening and then starts.

## C3. The landing is framed

- [x] C3.1 When the pawn arrives, the camera settles on the square it stopped on
      before the landing is announced (works even if the chase was skipped).

## C4, C9. Flights are visible from start to end, and followed

- [x] C4.1 A deed (or bills) flying to a seat never vanishes: the view applies
      the event the moment the flight lands, so the card is on the table the
      instant the flying one disappears.
- [x] C9.1 The camera frames both ends of a flight (from and to) and follows the
      object; verified by sampling.

## C6, C7. The lifted deed is a fixed-size 2D card; the Suerte card shows everywhere at once

- [x] C6.1 The deed on offer is an HTML image (same artwork) at a fixed size in
      the centre-left of the screen with a float-up animation — never clipped
      by the table.
- [x] C7.1 The small Suerte/Destino card in the action bar appears at the same
      moment as the big one (both from the view's card on the table).

## Verification

- [x] V.1 Dev hook exposes the camera and pawn trackers; a scripted browser run
      through the opening, a roll, a walk, a landing, a buy and the deed flight
      asserts that the camera target stays near the moving thing throughout.

---

# Batch 4 (2026-09-21, third review — the camera as a rule, Space as a pace, rent as a question)

Maxi played again and sent ten notes. Same conventions. Three of them turned out
to be bugs found by measuring the previous batch (a Space auto-repeat cut the
walk; the chase died after a landing and never restarted for the next move;
the turn cue compared itself with the previous cue instead of with the camera).

## D1. Catastro: the deed grid as the `L` overlay, with owners and previews

- [x] D1.1 `L` opens on a new first tab, **Catastro**: the trade screen's deed
      grid for the whole table — every deed in its fixed slot (province
      columns, zones as rows, railways, companies), lit in the owner's colour
      **with the owner's token icon on it** (the owner must never read as the
      property's colour band), buildings and mortgage state; free deeds are
      ghosts. Mapa and Lista stay as the other tabs. (Items 1, 6)
- [x] D1.2 Hovering a slot (or a tile on the Mapa tab) shows the real card big
      beside it; clicking selects the square (its panel opens). (Item 1)
- [x] D1.3 The Mapa tab marks the owner with their token icon too, not only a
      colour strip. (Item 1)

## D2. Trade: each side's value, never the subtraction

- [x] D2.1 Under the balance bar, each side's face value labelled with its
      player ("Jugador 1 da $7.400 · Jugador 2 da $10.200"); the "X da $Y más"
      line goes. (Item 2)

## D3. Space hurries (2×), nothing teleports

- [x] D3.1 Space/Enter (and the banner's button) during a replay play it at
      double speed — the pawn hops faster, flights and drops go faster, banners
      hold half as long — instead of jumping to the end. (Items 3, 9)
- [x] D3.2 The OS key auto-repeat can no longer cut a walk: a repeated Space
      only re-asks for the hurry already in effect. (Root cause of "the pawn
      appeared at the destination": `skip()` ran before the `repeat` check.)

## D4. Suerte/Destino: the camera backs off with the card

- [x] D4.1 When a card rises to the screen the camera pulls back and up along
      its own line of sight at the same moment, so the card never cuts through
      the table. (Item 4)

## D5. The camera is bound to the pawn, every walk

- [x] D5.1 The chase restarts for every walk (keyed on the walk itself, not on
      "a walk exists"): a second move in the same action — the leap to jail
      after landing on Marche preso, a card moving the pawn — is followed too.
      Measured. (Item 5; root cause: the landing flight killed the chase and
      the next walk, batched into the same render, never restarted it.)
- [x] D5.2 A walk backwards is followed exactly like a walk forwards. Measured.
      (Item 5)

## D6. Marche preso: one wide shot, no spinning

- [x] D6.1 The leap to jail is slower and higher, framed from above with both
      squares in view (no chase from behind across the board, which flipped
      the camera), then one lean-in on the jail. (Item 7)

## D7. Back to the pawn after every action

- [x] D7.1 When a replay ends and the table waits for the next decision, the
      camera returns to the pawn of the player on turn — unless it is already
      there, or the user took the camera. After paying bail, buying, an
      auction, a trade: back to the pawn. (Item 8)
- [x] D7.2 The turn-start cue checks where the camera actually is, not what
      the last cue was: the first round now gets its close-up for every
      player, not only the first. (Root cause found while measuring.)

## D8. Rent is asked for, and the amount is big

- [x] D8.1 Landing on someone else's deed no longer moves the money by itself:
      the table stops at the payment with the amount **big** on screen and a
      Pagar [P] button (sell / mortgage / negotiate as before); paying then
      flies the bills. Taxes and cards keep paying as before. (Item 10)
- [x] D8.2 Online tables run the engine on the room server, so the droplet
      needs `./deploy.sh` for D8.1 to apply there (hot-seat gets it at once).

## Verification

- [x] V.2 Scripted runs sampling the trackers: a backward walk, the Marche
      preso leap, the return to the pawn after a payment, the first-round turn
      cue, and Space during a walk (2× pace, arrival at the destination, no
      teleport).

## E1. Pawns face where they go

- [x] E1.1 The piece turns (smoothly, through corners) to face the direction it
      walks or leaps; standing still it keeps the last heading, starting out
      facing forward along the ring. (Batch 5, item 1)

## E2. The way out of jail is up front

- [x] E2.1 In jail, a centre prompt says so, with Pagar fianza [P] as the big
      button, the jail card [U] if held, and which attempt the throw would be.
      Space still throws for doubles. (Item 2)

## E3. Dice that behave in the hands

- [x] E3.1 Shaken in the middle of the screen at a readable size (a ray through
      the centre, stopping above the felt), not a wall of dice at the bottom.
      (Item 3)
- [x] E3.2 Letting go keeps them where the hands were until the roll arrives,
      and the throw leaves from there; before, they rushed back to the felt in
      the gap (a round trip online) and were thrown from the table. (Item 6)

## E4. A deed lands in its own place

- [x] E4.1 The flying card leaves from where it lay and lands in the exact slot
      it keeps; the row opens the gap while it flies and the other cards
      slide, never jump (`src/scene/deedSlots.ts`). (Item 4)

## E5. Modals open in the same place

- [x] E5.1 The Lista tab's long table stretched the backdrop's grid row and
      pushed the modal down; the backdrop now has a definite track. (Item 5)

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

- **2026-09-23 — batch 5 shipped and measured** (`38eb3eb` heading, `8be58a9`
  jail, `d416adb` dice, `93378b7` deeds, `8e77a2f` modals). Sampled: a 7-square
  walk with the piece's yaw against its motion, median 0.00 rad, max 0.33
  through a corner; a throw from the hands with no jump (largest step 0.34
  per 40 ms), hands 5.1 units from the camera instead of 2.8; buying a third
  deed with two held: the neighbours slide ±0.74→±1.27 during the flight, the
  card lands at the middle slot exactly and the seat card is there the next
  sample (no frame without it); all three `L` tabs open at top 16.
  Online: the deploy is now `./deploy.sh` (droplet builds, ~12 s).

- **2026-09-21 — batch 4 shipped and measured** (`5d3cca6` camera, `51ea219`
  hurry, `c532e90` rent, `adb46e7` trade, `7853989` Catastro, `71310ec`).
  Sampled with the frame stepper: the Marche preso leap is now 1.6 s long
  under a wide shot (camera y 16, target the board centre, both squares in
  frame) followed by the jail lean-in — before, the camera sat 22 units
  from the leaping pawn; a backward walk (36→33) is chased at median 0.95
  units; the full card flow (draw → camera backs off to y 7.2 keeping its
  target → Aplicar → walk chased → landing framed → back at the pawn); paying
  bail frames the bills and is back at the pawn 1 s after the banner; the
  first-round turn cue flies to P2 at Salida after P1's walk (it used to be
  swallowed by the last-cue comparison); Space at 0.8 s of a 2.9 s walk
  finishes it at 1.86 s with every square walked, and a `repeat` keydown
  changes nothing; a hurried bail banner takes 1.2 s instead of 2.24 s.
  Landing on a rival's deed stops at `awaitingPayment` with the figure at
  3rem; Pagar flies the bills and the camera returns to the pawn.
  Measurement note, again: a hidden browser pane throttles rAF to 1 fps and
  makes a 0.7 s flight look 2 s late — `__chacareroFrames.run(60)` first.
  D8.2 closed 2026-09-23: the droplet now builds a server-only image from
  main (`./deploy.sh`, ~12 s; see deploy/README.md). Known limits: the L overlay's Catastro has no pins
  (the Mapa tab keeps them); a hurry lasts until the current replay ends, the
  next action starts at 1×.

- **2026-09-21 — batch 3 shipped and measured (`4087705`).** Sampled with the
  dev frame stepper at 60 fps: six opening throws with the camera target never
  leaving Salida; a 6-square walk followed hop by hop (camera target median
  0.76 / max 1.36 units from the pawn, camera 4.7–5.1 behind) and framed on
  arrival (target 1.0 from the pawn); a click mid-walk changed nothing (median
  0.76 after it) while a drag hands over; the deed flight ended at 2.26 s and
  the card at the seat appeared at 2.29 s (no sample without a card); the money
  flight framed from the bank pile to the player's pile; the Suerte card's small
  and big versions at 0.02/0.04 s and the Aplicar prompt only after the rise
  (1.55 s); the seat peek snaps and returns to the exact camera. Two more root
  causes found while measuring: `Pawn.onArrive` reported the start square (so
  the landing flight went back to Salida), and drawn cards were revealed before
  they were on the table (the request resolved at once). Note for future
  measurements: a hidden browser pane throttles rAF to 1 fps — always
  `__chacareroFrames.run(60)` first. This browser also had `bannerSeconds: 1`
  saved in localStorage from an old test, which shortens every hold.
- **2026-09-21 — batch 3 captured.** Root causes found by reading: (a) `Pawn`'s
  "teleport when the state jumps" effect fired on every real-state change because
  pawn positions came from `game`, not the view — the pawn jumped to its
  destination, then walked from a stale start; (b) `OrbitControls.onStart`
  fires on any canvas click, so selecting a square set `freeLook` and killed the
  director until the next turn cue — and when the same player throws last in the
  opening and starts, there is no cue at all; (c) the replay applied an event to
  the view at the end of its hold, after the flying deed had already landed and
  unmounted, leaving a gap with no card anywhere.

- **2026-09-21 — batch 2 shipped; second look done.** Production build green;
  hot-seat and online (two tabs, opening throws) checked in the browser: the
  observer's screen keeps showing the thrower until the replay ends. Remaining
  known limits: the in-hand rattle is a scripted rhythm (no hands drawn); dice
  collisions are position-corrected, not simulated; the offer panel sits at a
  fixed 52% from the left, so on very narrow windows it may overlap the lifted
  card's edge; a quick *tap* of Space still does not throw (hold it, or click).
  Not built (not asked): drawn hands for the shake, a rapier physics world.
- **2026-09-21 — B1, B13, B21, B22, G.1 (`97f9994`, `66dec6a`).** `--radius`
  token (3px) for panels, 0 for card-like elements; token picker 46px + names
  (setup card 560px wide); `PlayerCards` are buttons calling `onFocus` →
  `flyToSeat`; `PlayerArea.FIRST_ROW_UP` -3.4 and `SEAT_DEEDS.up` -4.0;
  `docs/GUIDELINES.md` written and linked from the README.
- **2026-09-21 — B19 real cards.** `deedCardDataUrl()` in `cardTextures.ts`;
  `src/ui/DeedCard.tsx` (`DeedCard`, `Hand`) used by `TradeScreen` (preview +
  hands) and `OfferItems` (compact prompt). Grid slots stay schematic (too small
  for artwork).
- **2026-09-21 — B12 card text (next commit after `9e5ee60`).** `deedText()` in
  `describe.ts` (tested), drawn by `deedCardTexture` and `DeedDetails`.
- **2026-09-21 — B8, B16, B20 (`9e5ee60`).** `src/ui/hotkeys.ts` (`actionHotkeys`,
  `actionForKey`, `UI_KEYS`; tested in actionRequest.test) + `Key.tsx` badge;
  `primaryAction` limited to move/draw/ack/endTurn (test updated). Trade key is
  `N` now (`C` = Comprar). The offer stage is positioned beside the card via
  `.stage:has(.deed-offer)` (left 52%, vertically centred).
- **2026-09-21 — camera theatre B9/B11/B17 (`208f83b`).** `SECONDS_PER_SQUARE`
  (0.42) and `CUE_LEAD_SECONDS` in `timing.ts` are the single source of pace
  (Pawn speed, replay holds, clock). `pawnTracker` now has `kind` + `outward`;
  `CameraRig` chases pawns from outside the ring and flights at the current
  angle; `MoneyFlight`/`DeedFlight` publish to the tracker; `GameScreen` cues
  `pushIn` for building/jail and a seat flight for bankruptcy, keyed on
  `playback.current`. The landing flourish is the chase settle + the deed lift.
- **2026-09-21 — dice B3–B6, B14 (`2bbf2c9`).** `src/scene/diceThrow.ts` (pure:
  `landingSpots`, `separate`, `deflectFromPawns`, `flightHeight`, tested) and a
  rewritten `Dice.tsx` with modes rest/grab/shake/fly/settle/present; callbacks
  `onLanded` (director pushes the camera in, `pushIn()` in GameScreen using
  `cameraTracker`), `onPresenting` (doubles flash + jingle), `onSettled`. The seat
  frame is no longer used by the dice (hands = camera). Also found: the turn cue
  fired from the real state; `ViewState.currentPlayerId` fixes it (test added).
- **2026-09-21 — B7/B15/B18 view-state stepping (`5902545`).** `ViewState` now
  has `phase`, `cardOnTable`, `deedOnOffer` (`src/ui/playbackView.ts`, pure,
  tested); `usePlayback.enqueue(after)` calls `beginReplay` then applies events
  and adopts `viewOf(final)` at the end. `Effects` takes `cardOnTable` /
  `deedOnOffer` as props (`useShown` keeps exit animations); the bus only carries
  flights + `revealCard` (which gates the replay step). Rule for the future:
  anything the scene shows because of the game phase reads the *view*, not `game`.
- **2026-09-21 — B2 no building limit (`3b7efd5`).** `bank` gone from GameState,
  no stock checks, counters removed from HUD/map; REGLAS.md notes it.
- **2026-09-21 — batch 2 captured.** 22 review points from Maxi, grouped above
  as B1–B22 + G.1. Order of work: B2 (engine, quick) → B7/B15/B18 (view-state
  stepping: the correctness core) → dice (B3–B6, B14) → camera theatre (B9,
  B11, B17) → B8 → B16/B20 → B12 → B19 → B13 → B21 → B22 → B1 → G.1.

- **2026-09-21 — all 17 items shipped; second look done (`830e1ac`, `aaf2b14`).**
  Verified end to end in the browser: hot-seat (opening throws → roll → move →
  free deed offer → auction; trades propose/review/accept/reject; map) and
  online across two tabs (token picking blocked when taken, opening roll with
  server dice, trade screen sends `composing` without errors). README updated.
  Known limits worth knowing before touching things: a quick *tap* of Space
  does not throw the dice (hold it, or use the button — the keyup closure is
  stale for a same-tick tap); `composing` has no cap on how long it holds the
  clock; the HUD bottom row is tight below ~1100 px wide (cards stack above the
  dice bar); dice/pawn collisions are seeded fake physics, not rigid bodies.
  Not built (not asked): showing the review screen to third parties
  automatically, a fairness cap or warning on lopsided trades, a "skip all
  animations" setting.
- **2026-09-21 — trade outcome (17) (`9f14f18`).** `src/ui/TradeOutcome.tsx`
  (card + canvas confetti; `key={seq}` remounts per outcome), set from the seq
  effect in `GameScreen` when the previous phase was a trade response and the
  action was accept/reject. `sfx.play("sadTrombone")` is synthesised in
  `sfx.ts`; `soundsForTransition(before, after, action)` picks jingle vs trombone.
- **2026-09-21 — trade whenever + composing (13) (`0fe4268`).** `canProposeTrade`
  is now a deny-list (openingRoll, auction, awaitingTradeResponse, gameOver).
  `composing` message in the protocol → `Room.composingPlayerId`; `fireDeadline`
  pushes the deadline by `COMPOSING_GRACE_MS` (30 s) when the actor it would
  default is composing (no cap — a table of friends; add one if it is abused).
  Hot-seat mirrors it in `useLocalSession`. `GameScreen` sets it while the trade
  screen (compose or review) is open. `usePlayback` keeps the face-up card on the
  table when a trade interrupts `awaitingCardAck`.
- **2026-09-21 — trade screen (11, 14, 15, 16) (`1b596ed`).** `src/ui/TradeScreen.tsx`
  replaces `TradeDialog.tsx` (`OfferItems` moved to `OfferItems.tsx` for the compact
  prompt). Modes: `compose` (draft) and `review` (pending trade). `GameScreen`
  opens review automatically for the responder once the proposal's replay ends
  (effect on `[seq, busy]`); the prompt's "Ver en grande" opens it for anyone.
  Grid slots are fixed in `SLOTS` (provinces × zones, FF.CC., Cías.).
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

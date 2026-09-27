# Guidelines

The rules Maxi set for how Terrateniente should feel and how it should be built.
Read them before adding anything. They are ordered by how often they decide
things.

## 1. One 3D scene: the table is the game

Everything that happens in the game happens in the 3D model — it is a
digitisation of the physical box. Deeds, bills, dice, pawns and buildings
move on the table. HTML is for what the table cannot show (a prompt's buttons,
a map), never a replacement for showing it on the table. Prefer making the
scene richer over adding panels.

## 2. The game is a play in a theatre

Whatever happens on the table, the camera follows it, by default, on every
screen: the pawn hop by hop, the bills from one pile to the other, a deed from
the bank to a seat, the dice from the hands to the felt and back up into the
camera, a building dropping, someone marched to jail. Numbers updating and a
banner saying what happened are **not enough**: the audience must see the
thing move. A player who wants to look elsewhere can (drag, keys, the map),
and that screen leaves the play until the next turn — but the default is the
play.

Practically: every replayed event needs a camera cue (`GameScreen` cues off
`playback.current` and the pawn/flight tracker), and every animation is slow
enough to be watched. Seeing things move is part of the fun. No rush.

The pawn of the player on turn is the centre of the play: the camera flies to
it when the turn starts and **comes back to it after every action** (paying,
buying, an auction, a trade), unless the user took the camera or a card is
being held up. Every walk is chased, keyed on the walk itself — a second move
in the same action is followed too. A leap across the board (jail) is watched
from a wide shot instead of chased from behind.

Hurrying is a pace, not a jump: Space/Enter during a replay run everything at
2× (`src/ui/pace.ts`, read by the animations and the replay's own holds).
Nothing is ever skipped; nothing teleports.

## 3. Step by step, and only from the table's own view

The real game state runs ahead (the server or the engine resolves a whole
action at once). The table replays it one step at a time, and **everything
the scene or the HUD shows because of the game's phase reads the replayed
view** (`ViewState` in `src/ui/playbackView.ts`: cash, holdings, the phase
the table has caught up to, whose turn it shows, the card on the table, the
deed on offer), never `game` directly. If something appears before the pawn
has arrived or the banner has been read, that is a bug of this kind. Showing
and hiding is derived from that state (props), not from fire-and-forget
messages that a skip could swallow.

## 4. Nothing teleports

Every relocation of a thing on the table is a visible motion: dice are
grabbed from where they lie, thrown, and come back to exactly where they
landed; cards slide out of their deck; pawns hop. Two solid things never pass
through each other.

## 5. Keys are safe, and printed on the button

Space/Enter only advance the harmless steps. Anything with consequences
(buying, bidding, paying, accepting a deal) has its own letter, shown on the
button (`Comprar [C]`), and never collides with the camera keys
(`src/ui/hotkeys.ts`, tested).

## 6. Cards look like the cards

The same artwork everywhere: on the felt, lifted in front of the camera, in a
hand on the trade screen, in a prompt. Square corners. Railway and company
deeds carry the printed explanation.

## 7. Verify by measuring, not by looking

Screenshots are not proof that motion is right. In development the scene can
be driven from a timer (`window.__terratenienteFrames.run(60)`, needed because a
hidden tab throttles `requestAnimationFrame` to 1 fps) and
`window.__terrateniente.trackers` exposes the camera and the moving thing: sample
them during a scripted run and assert (the camera target stays within a unit
of the walking pawn, the card at the seat appears the frame the flying one
vanishes, the seat peek returns to the exact previous camera). Do this for
every camera or animation change before calling it done.

## 8. It plays on a phone

Decided by Maxi on 2026-09-27: every screen must work on a phone held either
way, on a tablet, and in a small window, not only on a desktop. The 3D table
stays the game (§1); on a small screen the HUD makes room for it rather than
covering it.

Practically:
- **Nothing overlaps a button.** Below the desktop width (1130 px) or height
  (500 px) the HUD is *compact* (the last block of `src/styles.css`): the top bar
  is one row, the player cards, the action bar and the camera bar stack in one
  `.dock` at the bottom (a row when the screen is wider than tall), and the
  prompt and the square panel size themselves to the space between
  (`--dock-height`, measured in `GameScreen`). A new HUD piece goes into that
  structure, not into a new absolutely-positioned corner.
- **Everything scrolls when it does not fit.** The page itself never scrolls
  (the table owns the viewport), so any screen or panel that can outgrow the
  window (menus, setup, lobby, prompts, modals) scrolls on its own.
- **Touch has no hover and no keyboard.** Anything shown on hover must also be
  reachable by a tap; hints say "tocá" on touch screens (`touchScreen` in
  `src/ui/pointer.ts`); key badges hide themselves (`@media (hover: none)`), so
  §5 still holds on a keyboard and costs nothing on a phone. Remember that a
  touch only counts as a user gesture when the finger lifts (audio unlock).
- **The camera frames the board on a narrow screen too**: below a 0.75 aspect
  the field of view opens up so the board's width stays in view
  (`src/scene/fov.ts`).
- **Check new UI at phone size before calling it done**: 375×812, 844×390,
  667×375, 768×1024 and 1024×768 at least, measuring that the HUD pieces do not
  overlap each other or leave the screen (the same way §7 measures motion).

## 9. Build exactly what was asked

No unrequested features or options — offer extras in one line and let Maxi
decide. Track batches of work in `docs/NEXT_FEATURES.md` (status boxes plus a
progress log), commit after every step, and add a test for anything found
broken so it does not come back.

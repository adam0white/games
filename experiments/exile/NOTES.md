# Exile

A third-person prototype made in Unity, to decide whether the idea is worth more work. The heir is framed by his brother for their father's death. He does not take the old throne back. He founds his own kingdom in a forest camp, holds it against one raid, then marches on his brother's keep.

- Made for a computer first: keyboard and mouse. A phone or tablet held sideways gets touch controls drawn by the game: a stick under the left thumb, Strike, Roll and Rally under the right, drag elsewhere to look round. `?touch=1` shows them on a computer.
- `Build/` is a Unity WebGL player build (Unity 6000.6.10f1, built-in render pipeline). It is build output, not source. The source is a Unity project kept outside this repo, on the owner's machine at `~/code/lab/exile-unity` and in the private repo `adam0white/exile-unity`. To change the game, change that project, run `Build.WebGL` and copy `Builds/webgl/Build/` here.
- Figures, buildings, walls, trees and rocks are free CC0 models by Kay Lousberg (KayKit Adventurers and Medieval Hexagon packs, from github.com/KayKit-Game-Assets). Cost: $0. Sounds, effects and the rest are made in code at run time.
- Controls: WASD move, Shift sprint, Space roll, left button or J strike (three in a row ends in a heavy blow), K or Alt block (raise it just before a blow lands to parry), Tab lock on, C changes the camera (follow, mouse look, fixed), F rally, 1 to 5 build.
- The loop: found the kingdom with the Great Hall, hold the fire against the raid, arm followers at a barracks (5), free the witness at the toll fort on the north road, beat the brother, then choose to kill or banish him.
- No play recording, no saves, no outside requests.
- Test switches in the address: `?autoplay=1` (a bot plays), `speed=3`, `raid=60` (seconds until the raid), `god=1`, `debug=1`, `wood=40` (start with stores), `touch=1`, `cam=follow|mouse|fixed`.

Not checked by `kit/check/phone.mjs`. Touch play was checked by hand-written Playwright runs with a phone profile, not on a real phone.

## The Banished layer (2026-11-25)

Built from the second owner's two design sheets: title menu (Play, Shop, Customize, Credits, Sounds and options), XP and five stats (P), stamina, strangers with six choices (V), three rulers, a horse (G), wolves and hogs, coins and a coins-only shop, items, equip and travel menu (M). The hero wakes by the fire after falling; the game is lost only when the fire dies. Nothing takes payment. Not built: bow, PvP, Mountains region, orbs, real animal models (the horse and animals are boxes made in code).

Extra test flags: `coins=N`, `at=x,z`, `test=strangers`, `test=fall`.

## Play records

The page records play for the game lab under the slug `exile` (`kit/lab.js`; the lab accepts the slug in
human-framework `LAB_PROTOTYPES`). The Unity build calls `window.exileEvent(name, json)`; the module script at the foot
of `index.html` turns `start` into `rec.start`, `end` into `rec.end` and everything else into `rec.event`. The notice and
its switch sit in the bottom left corner while the build loads, on the title screen and after an ending.

- What is sent: a start record, a snapshot every 20 s, one event per choice and an end record. The list is in the
  exile-unity README under "Play records". No GPU name, screen size or other device detail.
- A run the player walks away from is still sent when the tab is hidden; it has no outcome and reads as `left`.
- `autoplay=1` records nothing unless the address also has `labRunSource=agent`, which marks the run as an agent's.
- To read them: `npm run lab:inbox` in the human-framework checkout, then
  `node experiments/exile/telemetry.mjs <that checkout>/.lab-inbox --html=report.html`. It prints how far runs got,
  where unfinished runs stopped, falls by place, stranger and stat choices, camera time, combat counts and frame rate,
  and one row per run. `--agents` includes agent runs; `--csv=FILE` writes the rows.

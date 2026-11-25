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

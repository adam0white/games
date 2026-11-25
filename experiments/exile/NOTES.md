# Exile

A third-person prototype made in Unity, to decide whether the idea is worth more work. The heir is framed by his brother for their father's death. He does not take the old throne back. He founds his own kingdom in a forest camp, holds it against one raid, then marches on his brother's keep.

- Desktop only: keyboard and mouse. A phone sees a note saying so.
- `Build/` is a Unity WebGL player build (Unity 6000.6.10f1, built-in render pipeline). It is build output, not source. The source is a Unity project kept outside this repo, on the owner's machine at `~/code/lab/exile-unity`. To change the game, change that project, run `Build.WebGL` and copy `Builds/webgl/Build/` here.
- Everything in the game is made in code at run time: figures, trees, buildings and sounds. No bought or downloaded assets.
- No play recording, no saves, no outside requests.
- Test switches in the address: `?autoplay=1` (a bot plays), `speed=3`, `raid=60` (seconds until the raid), `god=1`, `debug=1`.

Not checked by `kit/check/phone.mjs`: this page has no phone play.

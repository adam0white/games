from pathlib import Path
import subprocess,sys,re
r=Path(__file__).resolve().parents[1]
subprocess.run([sys.executable,str(r/'scripts/setup-godot.py')],check=True)
godot=r/'.godot-tools'/('Godot.app/Contents/MacOS/Godot' if sys.platform=='darwin' else 'Godot_v4.7.2-stable_linux.x86_64')
preset=r/'godot/export_presets.cfg';s=preset.read_text()
s=re.sub(r'custom_template/release=.*',f'custom_template/release="{r}/.godot-tools/templates/web_nothreads_release.zip"',s)
s=re.sub(r'custom_template/debug=.*',f'custom_template/debug="{r}/.godot-tools/templates/web_nothreads_debug.zip"',s)
# Resolve paths in a temporary config, restore portable source even on export failure.
try:
 preset.write_text(s)
 for args in [['--editor','--import'],['--export-release','Web',str(r/'public/game.html')]]:
  subprocess.run([str(godot),'--headless','--path',str(r/'godot'),*args],check=True)
finally:
 preset.write_text(re.sub(r'custom_template/(release|debug)="[^"]*"',lambda m:'custom_template/'+m[1]+'="res://../.godot-tools/templates/web_nothreads_'+m[1]+'.zip"',s))

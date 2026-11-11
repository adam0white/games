from pathlib import Path
import io,urllib.request,zipfile,shutil,sys,subprocess,os
root=Path(__file__).resolve().parents[1]; tools=root/'.godot-tools';tools.mkdir(exist_ok=True)
version='4.7.2';base=f'https://github.com/godotengine/godot-builds/releases/download/{version}-stable/'
if sys.platform=='darwin': filename=f'Godot_v{version}-stable_macos.universal.zip';binary=tools/'Godot.app/Contents/MacOS/Godot'
else: filename=f'Godot_v{version}-stable_linux.x86_64.zip';binary=tools/f'Godot_v{version}-stable_linux.x86_64'
if not binary.exists():
 print('Downloading pinned Godot editor',flush=True)
 archive=tools/'editor.zip';urllib.request.urlretrieve(base+filename,archive)
 with zipfile.ZipFile(archive) as z:z.extractall(tools)
 archive.unlink();binary.chmod(0o755)
 if sys.platform=='darwin':subprocess.run(['xattr','-dr','com.apple.quarantine',str(tools/'Godot.app')],check=False)
if not subprocess.check_output([str(binary),'--version'],text=True).startswith(version+'.'):raise RuntimeError('Godot version mismatch')
# Fetch only required web zip entries from the large cross-platform template archive.
if not (tools/'templates/web_nothreads_release.zip').exists():
 with urllib.request.urlopen(urllib.request.Request(base+f'Godot_v{version}-stable_export_templates.tpz',method='HEAD')) as response: final=response.url;size=int(response.headers['Content-Length'])
 class Remote(io.RawIOBase):
  def __init__(self):self.position=0
  def seekable(self):return True
  def readable(self):return True
  def tell(self):return self.position
  def seek(self,offset,whence=0):
   self.position=offset if whence==0 else self.position+offset if whence==1 else size+offset
   return self.position
  def read(self,n=-1):
   n=min(n if n>=0 else size-self.position,size-self.position)
   if n<=0:return b''
   req=urllib.request.Request(final,headers={'Range':f'bytes={self.position}-{self.position+n-1}'})
   with urllib.request.urlopen(req) as response:
    if response.status!=206:raise RuntimeError('Template host ignored byte range')
    result=response.read()
   if len(result)!=n:raise RuntimeError('Short template range')
   self.position+=len(result);return result
 with zipfile.ZipFile(Remote()) as z:
  for name in ['templates/web_nothreads_release.zip','templates/web_nothreads_debug.zip']:
   target=tools/name;target.parent.mkdir(exist_ok=True);target.write_bytes(z.read(name))
print(binary,flush=True)

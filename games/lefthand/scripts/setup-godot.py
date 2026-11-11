from pathlib import Path, PurePosixPath
import hashlib
import io
import os
import shutil
import stat
import subprocess
import sys
import tempfile
import urllib.request
import zipfile

VERSION = '4.7.2'
BASE = f'https://github.com/godotengine/godot-builds/releases/download/{VERSION}-stable/'
EDITOR_SHA256 = {
    'darwin': 'c58a24e31d720be9d62f60cb5627c4e695fb72f21b0cfe1bc9ccaa9a3b3ba63e',
    'linux': 'cadd3204e728a35d3f13adb7fd0d7902636b79f6b95c40c265eb73b6c35329e4',
}
LINUX_BINARY_SHA256 = '8d106cbe6144c2dc7e881d61d2429c1a8a76e6b22ef48bd5e48dcf934953f71e'
TEMPLATE_SHA256 = {
    'templates/web_nothreads_release.zip': 'd3ee2f08cef0cf3cf6678a6355a92a8db48ccdd35cbd2e8bfd5f0e8a0b4032a0',
    'templates/web_nothreads_debug.zip': '08962aefef811b603541d7951ac67ef00413aad2d978855183c28adee98f626a',
}


def file_hash(path):
    with path.open('rb') as source:
        return hashlib.file_digest(source, 'sha256').hexdigest()


def verify_file(path, expected):
    if path.is_symlink() or not path.is_file() or file_hash(path) != expected:
        raise RuntimeError(f'SHA-256 mismatch: {path}')


def verified_download(url, target, expected):
    # Never expose a partial or unverified download as the cache entry.
    with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as temp:
        partial = Path(temp.name)
    try:
        urllib.request.urlretrieve(url, partial)
        verify_file(partial, expected)
        os.replace(partial, target)
    finally:
        partial.unlink(missing_ok=True)


def editor_archive(tools, platform):
    filename = f'Godot_v{VERSION}-stable_' + ('macos.universal.zip' if platform == 'darwin' else 'linux.x86_64.zip')
    archive = tools / filename
    if archive.exists():
        verify_file(archive, EDITOR_SHA256[platform])
    else:
        print('Downloading pinned Godot editor', flush=True)
        verified_download(BASE + filename, archive, EDITOR_SHA256[platform])
    return archive


def safe_members(archive):
    seen = set()
    for entry in archive.infolist():
        path = PurePosixPath(entry.filename)
        kind = stat.S_IFMT(entry.external_attr >> 16)
        if path.is_absolute() or '..' in path.parts or not path.parts or path in seen:
            raise RuntimeError('Unsafe editor archive entry')
        if kind not in (stat.S_IFREG, stat.S_IFDIR):
            raise RuntimeError('Unsafe editor archive file type')
        seen.add(path)
        yield entry


def extract_verified_editor(archive, tools):
    # Called only after the containing ZIP passes its pinned digest.
    entries = list(safe_members(archive))
    directories = []
    for entry in entries:
        target = tools.joinpath(*PurePosixPath(entry.filename).parts)
        if entry.is_dir():
            target.mkdir(parents=True, exist_ok=True)
            directories.append((target, stat.S_IMODE(entry.external_attr >> 16)))
        else:
            target.parent.mkdir(parents=True, exist_ok=True)
            with archive.open(entry) as source, target.open('wb') as output:
                shutil.copyfileobj(source, output)
            target.chmod(stat.S_IMODE(entry.external_attr >> 16))
    for directory, mode in reversed(directories):
        directory.chmod(mode)


def verify_mac_tree(archive, tools):
    expected = {}
    expected_dirs = {"Godot.app"}
    directory_modes = {}
    for entry in safe_members(archive):
        path = PurePosixPath(entry.filename)
        if path.parts[0] != 'Godot.app':
            raise RuntimeError('Unexpected Godot.app archive entry')
        for parent in path.parents:
            if parent.parts and parent.parts[0] == "Godot.app": expected_dirs.add(parent.as_posix())
        if entry.is_dir():
            expected_dirs.add(path.as_posix())
            directory_modes[path.as_posix()] = stat.S_IMODE(entry.external_attr >> 16)
        else:
            expected[path.as_posix()] = entry
    app = tools / 'Godot.app'
    if app.is_symlink() or not app.is_dir():
        raise RuntimeError('Invalid Godot.app cache')
    actual = set()
    actual_dirs = {"Godot.app"}
    for path in app.rglob('*'):
        if path.is_symlink() or not (path.is_file() or path.is_dir()):
            raise RuntimeError('Invalid Godot.app cache')
        if path.is_file():
            actual.add(path.relative_to(tools).as_posix())
        else:
            actual_dirs.add(path.relative_to(tools).as_posix())
    if actual != set(expected) or actual_dirs != expected_dirs:
        raise RuntimeError('Godot.app cache has missing or extra files')
    for name, mode in directory_modes.items():
        if stat.S_IMODE((tools / name).stat().st_mode) != mode:
            raise RuntimeError(f"Godot.app directory mode mismatch: {name}")
    for name, entry in expected.items():
        path = tools / name
        if stat.S_IMODE(path.stat().st_mode) != stat.S_IMODE(entry.external_attr >> 16):
            raise RuntimeError(f'Godot.app mode mismatch: {name}')
        digest = hashlib.sha256()
        with archive.open(entry) as source:
            for block in iter(lambda: source.read(1024 * 1024), b''):
                digest.update(block)
        if file_hash(path) != digest.hexdigest():
            raise RuntimeError(f'Godot.app content mismatch: {name}')


def verify_linux_binary(binary):
    verify_file(binary, LINUX_BINARY_SHA256)
    if not binary.stat().st_mode & stat.S_IXUSR:
        raise RuntimeError('Godot editor is not executable')


def read_template_members(names):
    url = BASE + f'Godot_v{VERSION}-stable_export_templates.tpz'
    with urllib.request.urlopen(urllib.request.Request(url, method='HEAD')) as response:
        final, size = response.url, int(response.headers['Content-Length'])

    class Remote(io.RawIOBase):
        def __init__(self): self.position = 0
        def seekable(self): return True
        def readable(self): return True
        def tell(self): return self.position
        def seek(self, offset, whence=0):
            self.position = offset if whence == 0 else self.position + offset if whence == 1 else size + offset
            return self.position
        def read(self, n=-1):
            n = min(n if n >= 0 else size - self.position, size - self.position)
            if n <= 0: return b''
            request = urllib.request.Request(final, headers={'Range': f'bytes={self.position}-{self.position+n-1}'})
            with urllib.request.urlopen(request) as response:
                if response.status != 206: raise RuntimeError('Template host ignored byte range')
                data = response.read()
            if len(data) != n: raise RuntimeError('Short template range')
            self.position += len(data)
            return data

    with zipfile.ZipFile(Remote()) as archive:
        return {name: archive.read(name) for name in names}


def ensure_templates(tools):
    template_dir = tools / "templates"
    if template_dir.is_symlink(): raise RuntimeError("Invalid template cache directory")
    for name in TEMPLATE_SHA256:
        if (tools / name).is_symlink(): raise RuntimeError(f"Invalid template cache: {name}")
    missing = [name for name in TEMPLATE_SHA256 if not (tools / name).exists()]
    for name in TEMPLATE_SHA256:
        if name not in missing:
            verify_file(tools / name, TEMPLATE_SHA256[name])
    if missing:
        members = read_template_members(missing)
        for name in missing:
            data = members[name]
            if hashlib.sha256(data).hexdigest() != TEMPLATE_SHA256[name]:
                raise RuntimeError(f'SHA-256 mismatch: {name}')
        for name in missing:
            target = tools / name
            target.parent.mkdir(parents=True, exist_ok=True)
            with tempfile.NamedTemporaryFile(dir=target.parent, delete=False) as temp:
                partial = Path(temp.name)
                try:
                    temp.write(members[name])
                    temp.close()
                    verify_file(partial, TEMPLATE_SHA256[name])
                    os.replace(partial, target)
                finally:
                    partial.unlink(missing_ok=True)
    for name, expected in TEMPLATE_SHA256.items():
        verify_file(tools / name, expected)


def main():
    root = Path(__file__).resolve().parents[1]
    tools = root / '.godot-tools'
    if tools.is_symlink(): raise RuntimeError("Invalid Godot cache directory")
    tools.mkdir(exist_ok=True)
    platform = 'darwin' if sys.platform == 'darwin' else 'linux' if sys.platform == 'linux' else None
    if platform is None: raise RuntimeError('Unsupported Godot platform')
    binary = tools / ('Godot.app/Contents/MacOS/Godot' if platform == 'darwin' else f'Godot_v{VERSION}-stable_linux.x86_64')
    if platform == 'darwin':
        archive = editor_archive(tools, platform)
        with zipfile.ZipFile(archive) as z:
            if not binary.exists():
                app = tools / "Godot.app"
                if app.exists() or app.is_symlink(): raise RuntimeError("Incomplete Godot.app cache")
                with tempfile.TemporaryDirectory(dir=tools) as temporary:
                    extracted = Path(temporary)
                    extract_verified_editor(z, extracted)
                    verify_mac_tree(z, extracted)
                    os.rename(extracted / "Godot.app", app)
            verify_mac_tree(z, tools)
    else:
        if not binary.exists():
            if binary.is_symlink(): raise RuntimeError("Invalid Godot editor cache")
            archive = editor_archive(tools, platform)
            with tempfile.TemporaryDirectory(dir=tools) as temporary:
                extracted = Path(temporary)
                with zipfile.ZipFile(archive) as z: extract_verified_editor(z, extracted)
                candidate = extracted / binary.name
                verify_linux_binary(candidate)
                os.rename(candidate, binary)
        verify_linux_binary(binary)
    # Verify templates before running any downloaded executable.
    ensure_templates(tools)
    if not subprocess.check_output([str(binary), '--version'], text=True).startswith(VERSION + '.'):
        raise RuntimeError('Godot version mismatch')
    print(binary, flush=True)


if __name__ == '__main__':
    main()

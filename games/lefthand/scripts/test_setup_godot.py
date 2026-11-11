import hashlib
import importlib.util
from pathlib import Path
import stat
import tempfile
import unittest
from unittest.mock import patch
import zipfile

spec = importlib.util.spec_from_file_location('godot_setup', Path(__file__).with_name('setup-godot.py'))
setup = importlib.util.module_from_spec(spec)
spec.loader.exec_module(setup)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def archive(path, files):
    with zipfile.ZipFile(path, 'w') as z:
        for name, data, mode in files:
            info = zipfile.ZipInfo(name)
            info.create_system = 3
            info.external_attr = (stat.S_IFREG | mode) << 16
            z.writestr(info, data)


class IntegrityTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def test_archive_digest_checked_before_extraction(self):
        source = self.root / 'source.zip'
        archive(source, [('editor', b'payload', 0o755)])
        target = self.root / 'editor.zip'
        with patch.object(setup.urllib.request, 'urlretrieve', side_effect=lambda url, out: Path(out).write_bytes(source.read_bytes())):
            with self.assertRaisesRegex(RuntimeError, 'SHA-256'):
                setup.verified_download('test', target, '0' * 64)
        self.assertFalse(target.exists())
        self.assertFalse((self.root / 'editor').exists())

    def test_macos_cache_checks_all_files_modes_and_extras(self):
        zpath = self.root / 'editor.zip'
        files = [('Godot.app/Contents/MacOS/Godot', b'editor', 0o755), ('Godot.app/Contents/Resources/data', b'resource', 0o644)]
        archive(zpath, files)
        with zipfile.ZipFile(zpath) as z:
            setup.extract_verified_editor(z, self.root)
            setup.verify_mac_tree(z, self.root)
            resource = self.root / files[1][0]
            resource.write_bytes(b'tampered')
            with self.assertRaisesRegex(RuntimeError, 'Godot.app'):
                setup.verify_mac_tree(z, self.root)
            resource.write_bytes(b'resource')
            resource.chmod(0o600)
            with self.assertRaisesRegex(RuntimeError, 'Godot.app'):
                setup.verify_mac_tree(z, self.root)
            resource.chmod(0o644)
            (self.root / 'Godot.app/extra').write_bytes(b'extra')
            with self.assertRaisesRegex(RuntimeError, 'Godot.app'):
                setup.verify_mac_tree(z, self.root)

    def test_linux_cache_is_verified_before_execution(self):
        binary = self.root / 'Godot_v4.7.2-stable_linux.x86_64'
        binary.write_bytes(b'tampered')
        with patch.object(setup, 'LINUX_BINARY_SHA256', digest(b'official')), patch.object(setup.subprocess, 'check_output') as execute:
            with self.assertRaisesRegex(RuntimeError, 'SHA-256'):
                setup.verify_linux_binary(binary)
            execute.assert_not_called()

    def test_each_template_revalidated_even_when_both_exist(self):
        paths = {'templates/web_nothreads_release.zip': b'release', 'templates/web_nothreads_debug.zip': b'debug'}
        for name, data in paths.items():
            path = self.root / name
            path.parent.mkdir(parents=True, exist_ok=True)
            path.write_bytes(data)
        with patch.object(setup, 'TEMPLATE_SHA256', {name: digest(data) for name, data in paths.items()}):
            setup.ensure_templates(self.root)
            (self.root / 'templates/web_nothreads_debug.zip').write_bytes(b'tampered')
            with self.assertRaisesRegex(RuntimeError, 'SHA-256'):
                setup.ensure_templates(self.root)

    def test_missing_debug_download_is_checked_independently(self):
        data = {'templates/web_nothreads_release.zip': b'release', 'templates/web_nothreads_debug.zip': b'debug'}
        p = self.root / 'templates/web_nothreads_release.zip'
        p.parent.mkdir()
        p.write_bytes(data['templates/web_nothreads_release.zip'])
        with patch.object(setup, 'TEMPLATE_SHA256', {name: digest(value) for name, value in data.items()}), patch.object(setup, 'read_template_members', return_value={'templates/web_nothreads_debug.zip': b'bad'}):
            with self.assertRaisesRegex(RuntimeError, 'SHA-256'):
                setup.ensure_templates(self.root)
        self.assertFalse((self.root / 'templates/web_nothreads_debug.zip').exists())

    def test_template_symlink_is_rejected_even_when_dangling(self):
        path = self.root / 'templates/web_nothreads_release.zip'
        path.parent.mkdir()
        path.symlink_to(self.root / 'outside')
        with self.assertRaisesRegex(RuntimeError, 'Invalid template cache'):
            setup.ensure_templates(self.root)
        self.assertFalse((self.root / 'outside').exists())

    def test_main_refuses_corrupt_cached_template_before_version_execution(self):
        game = self.root / 'game'
        tools = game / '.godot-tools'
        tools.mkdir(parents=True)
        binary = tools / 'Godot_v4.7.2-stable_linux.x86_64'
        binary.write_bytes(b'official')
        binary.chmod(0o755)
        (tools / 'templates').mkdir()
        (tools / 'templates/web_nothreads_release.zip').write_bytes(b'corrupt')
        (tools / 'templates/web_nothreads_debug.zip').write_bytes(b'debug')
        with patch.object(setup, '__file__', str(game / 'scripts/setup-godot.py')), patch.object(setup.sys, 'platform', 'linux'), patch.object(setup, 'LINUX_BINARY_SHA256', digest(b'official')), patch.object(setup, 'TEMPLATE_SHA256', {'templates/web_nothreads_release.zip': digest(b'release'), 'templates/web_nothreads_debug.zip': digest(b'debug')}), patch.object(setup.subprocess, 'check_output') as execute:
            with self.assertRaisesRegex(RuntimeError, 'SHA-256'):
                setup.main()
            execute.assert_not_called()

if __name__ == '__main__':
    unittest.main()

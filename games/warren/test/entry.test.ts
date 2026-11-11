import { expect, it } from 'vitest';
import { fileEntry } from '../src/entry.ts';

it('resolves every file entry before the app initializes', () => {
  for (const path of ['/warren/file', '/warren/file/', '/warren/file/index.html'])
    expect(fileEntry('', path)).toBe('file');
  expect(fileEntry('?file=1', '/warren/')).toBe('file');
  expect(fileEntry('?file=0', '/warren/')).toBe('invalid');
  expect(fileEntry('?file=1&file=1', '/warren/')).toBe('invalid');
  expect(fileEntry('', '/warren/')).toBe('native');
});

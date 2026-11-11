/** Resolve file routes before starting the app or any storage client. */
export function fileEntry(search: string, pathname: string): 'native' | 'file' | 'invalid' {
  const values = new URLSearchParams(search).getAll('file');
  if (values.length > 1 || (values.length === 1 && values[0] !== '1')) return 'invalid';
  return values.length === 1 ||
    pathname === '/warren/file/' ||
    pathname === '/warren/file' ||
    pathname === '/warren/file/index.html'
    ? 'file'
    : 'native';
}

// Share a picture the game made: the phone's share sheet with the image file where the browser can
// share files, else a download of the same picture. Moved here from Night Sand (lab/night-sand) when
// Saltplate needed the same thing.
//   import { shareImage } from '../kit/share.js';
//   const how = await shareImage(canvas, { name: 'my-garden.png', text: 'My garden, 87%' });
//   how is 'shared', 'saved' (downloaded), 'cancelled' (the player closed the sheet) or 'failed'.
// source is a canvas or a Blob. It never throws.
export function canvasBlob(canvas, type = 'image/png') {
  return new Promise(resolve => {
    try { canvas.toBlob(resolve, type); } catch { resolve(null); }
  });
}

export async function shareImage(source, { name = 'picture.png', text = '' } = {}) {
  try {
    const blob = source instanceof Blob ? source : await canvasBlob(source);
    if (!blob) return 'failed';
    const file = new File([blob], name, { type: blob.type || 'image/png' });
    try {
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], text });
        return 'shared';
      }
    } catch (error) {
      if (error?.name === 'AbortError') return 'cancelled';
    }
    // No file sharing here (most desktop browsers): save the picture instead.
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = file.name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 4000);
    return 'saved';
  } catch {
    return 'failed';
  }
}

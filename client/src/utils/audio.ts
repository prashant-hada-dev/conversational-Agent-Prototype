/**
 * Converts a base64 or URL string to a Blob
 */
export async function urlToBlob(url: string): Promise<Blob> {
  // If it's a base64 data URL
  if (url.startsWith('data:')) {
    const base64 = url.split(',')[1];
    const byteString = window.atob(base64);
    const arrayBuffer = new ArrayBuffer(byteString.length);
    const int8Array = new Uint8Array(arrayBuffer);
    
    for (let i = 0; i < byteString.length; i++) {
      int8Array[i] = byteString.charCodeAt(i);
    }
    
    return new Blob([int8Array], { type: 'audio/wav' });
  }
  
  // If it's a URL, fetch it
  const response = await fetch(url);
  return await response.blob();
}

/**
 * Creates an audio blob URL from a blob
 */
export function createBlobUrl(blob: Blob): string {
  return URL.createObjectURL(blob);
}

/**
 * Revokes a blob URL to free up memory
 */
export function revokeBlobUrl(url: string): void {
  if (url.startsWith('blob:')) {
    URL.revokeObjectURL(url);
  }
}
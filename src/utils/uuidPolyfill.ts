/**
 * UUID Polyfill for React Native
 * This provides a simple implementation for generating UUIDs without relying on crypto.getRandomValues()
 */

// Simple implementation of a UUID v4 generator
export const generateUUID = (): string => {
  // Use Math.random() as a fallback for crypto.getRandomValues()
  const randomBytes = () => {
    const bytes = new Uint8Array(16);
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
    return bytes;
  };

  const byteToHex: string[] = [];
  for (let i = 0; i < 256; i++) {
    byteToHex[i] = (i + 0x100).toString(16).slice(1);
  }

  const bytes = randomBytes();
  
  // Set version bits (4 for version 4 UUID)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  // Set variant bits (2 bits for RFC4122)
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  // Format the UUID string
  return (
    byteToHex[bytes[0]] +
    byteToHex[bytes[1]] +
    byteToHex[bytes[2]] +
    byteToHex[bytes[3]] +
    '-' +
    byteToHex[bytes[4]] +
    byteToHex[bytes[5]] +
    '-' +
    byteToHex[bytes[6]] +
    byteToHex[bytes[7]] +
    '-' +
    byteToHex[bytes[8]] +
    byteToHex[bytes[9]] +
    '-' +
    byteToHex[bytes[10]] +
    byteToHex[bytes[11]] +
    byteToHex[bytes[12]] +
    byteToHex[bytes[13]] +
    byteToHex[bytes[14]] +
    byteToHex[bytes[15]]
  );
}; 
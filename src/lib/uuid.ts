// Basit RFC4122 v4 uretici. Yeni native paket eklemeden calisir.
// Ileride expo-crypto eklenirse Crypto.randomUUID() ile degistirilebilir.
export function uuidv4(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
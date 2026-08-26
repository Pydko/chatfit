import * as SecureStore from 'expo-secure-store';

const CHUNK_SIZE = 1800; 

export const ChunkedSecureStore = {
  async getItem(key: string): Promise<string | null> {
    const meta = await SecureStore.getItemAsync(`${key}__n`);
    if (!meta) return SecureStore.getItemAsync(key);

    const count = Number(meta);
    const parts: string[] = [];
    for (let i = 0; i < count; i++) {
      const part = await SecureStore.getItemAsync(`${key}__${i}`);
      if (part === null) return null; 
      parts.push(part);
    }
    return parts.join('');
  },

  async setItem(key: string, value: string): Promise<void> {
    await this.removeItem(key);

    if (value.length <= CHUNK_SIZE) {
      await SecureStore.setItemAsync(key, value);
      return;
    }

    const count = Math.ceil(value.length / CHUNK_SIZE);
    for (let i = 0; i < count; i++) {
      await SecureStore.setItemAsync(
        `${key}__${i}`,
        value.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE),
      );
    }
    await SecureStore.setItemAsync(`${key}__n`, String(count));
  },

  async removeItem(key: string): Promise<void> {
    const meta = await SecureStore.getItemAsync(`${key}__n`);
    if (meta) {
      const count = Number(meta);
      for (let i = 0; i < count; i++) {
        await SecureStore.deleteItemAsync(`${key}__${i}`);
      }
      await SecureStore.deleteItemAsync(`${key}__n`);
    }
    await SecureStore.deleteItemAsync(key);
  },
};
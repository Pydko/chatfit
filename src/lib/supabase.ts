import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';
import { ChunkedSecureStore } from './secure-storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error('Supabase ortam degiskenleri eksik. .env dosyasini kontrol et.');
}

export const supabase = createClient(url, anonKey, {
  auth: {
    storage: ChunkedSecureStore,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
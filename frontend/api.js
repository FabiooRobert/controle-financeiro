import { Platform } from 'react-native';

const webHost = Platform.OS === 'web' && typeof window !== 'undefined'
  ? window.location.hostname
  : 'localhost';
const DEFAULT_API_URL = __DEV__
  ? (Platform.OS === 'android'
    ? 'http://10.0.2.2:3000/api'
    : `http://${webHost}:3000/api`)
  : 'https://controle-financeiro-1-g7xw.onrender.com/api';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/+$/, '');
export const API_BASE = API_URL.endsWith('/api') ? API_URL : `${API_URL}/api`;
export const API_ORIGIN = API_BASE.replace(/\/api$/, '');

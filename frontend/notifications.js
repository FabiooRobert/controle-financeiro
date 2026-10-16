import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { API_BASE } from './api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

export async function registerPush(authToken) {
  if (!Device.isDevice) throw new Error('Registre notificações em um aparelho físico.');
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('mensagens', {
      name: 'Mensagens',
      importance: Notifications.AndroidImportance.HIGH,
      sound: 'default'
    });
  }

  let permission = await Notifications.getPermissionsAsync();
  if (permission.status !== 'granted') {
    permission = await Notifications.requestPermissionsAsync();
  }
  if (permission.status !== 'granted') return null;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId
    ?? Constants.easConfig?.projectId;
  if (!projectId) throw new Error('Configure o projectId EAS do aplicativo.');

  const { data: pushToken } = await Notifications.getExpoPushTokenAsync({ projectId });
  const response = await fetch(`${API_BASE}/notificacoes/token`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token: pushToken })
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Não foi possível registrar as notificações.');
  }

  return pushToken;
}

export async function unregisterPush(authToken, pushToken) {
  if (!pushToken) return;
  const response = await fetch(`${API_BASE}/notificacoes/token`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${authToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ token: pushToken })
  });
  const result = await response.json();
  if (!response.ok || !result.success) {
    throw new Error(result.message || 'Não foi possível remover o registro de notificações.');
  }
}

import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

const CHANNEL_ID = 'rest-timer';

let configured = false;

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});


export async function ensureNotificationSetup(): Promise<boolean> {
  try {
    if (Platform.OS === 'android' && !configured) {
      await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
        name: 'Dinlenme sayaci',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
      });
    }
    configured = true;

    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;

    const asked = await Notifications.requestPermissionsAsync();
    return asked.granted;
  } catch {
    return false;
  }
}


export async function scheduleRestFinished(seconds: number): Promise<string | null> {
  try {
    const granted = await ensureNotificationSetup();
    if (!granted) return null;

    return await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Dinlenme bitti',
        body: 'Siradaki sete hazirsin.',
        sound: true, 
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, Math.round(seconds)),
        channelId: CHANNEL_ID,
      },
    });
  } catch {
    return null;
  }
}

export async function cancelScheduled(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {
  }
}
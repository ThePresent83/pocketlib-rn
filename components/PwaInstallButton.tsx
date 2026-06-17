import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { Button, Snackbar } from 'react-native-paper';
import { THEME } from '../constants/theme';

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
};

function isStandaloneDisplay() {
  if (typeof window === 'undefined') return false;
  return window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true;
}

export default function PwaInstallButton() {
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (Platform.OS !== 'web' || typeof window === 'undefined') return undefined;

    setIsStandalone(isStandaloneDisplay());

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    const handleInstalled = () => {
      setInstallPrompt(null);
      setIsStandalone(true);
      setMessage('PocketLib установлен');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  if (Platform.OS !== 'web' || isStandalone) return null;

  const install = async () => {
    if (!installPrompt) {
      setMessage('В браузере откройте меню и выберите «Установить приложение»');
      return;
    }

    await installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    setInstallPrompt(null);
    if (choice.outcome === 'accepted') {
      setIsStandalone(true);
    }
  };

  return (
    <View style={styles.wrap}>
      <Button mode="contained" icon="cellphone-arrow-down" buttonColor="#fff" textColor={THEME.colors.primary} onPress={install}>
        Установить приложение
      </Button>
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={3200}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginTop: 14,
  },
});

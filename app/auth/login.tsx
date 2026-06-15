import { useEffect, useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { Image } from 'expo-image';
import { login } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { THEME } from '../../constants/theme';
import { getApiBaseUrl, setApiBaseUrlOverride } from '../../services/backendApi';

const COLLEGE_LOGO = require('../../assets/polytech-logo.png');

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { t } = useLanguage();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [serverUrl, setServerUrl] = useState('');
  const [showServerSettings, setShowServerSettings] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getApiBaseUrl().then(setServerUrl).catch(() => {});
  }, []);

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg(t('fill_all_fields'));
      return;
    }

    setLoading(true);
    try {
      if (serverUrl.trim()) {
        await setApiBaseUrlOverride(serverUrl);
      }
    } catch {
      setLoading(false);
      setErrorMsg(t('invalid_server_url'));
      return;
    }

    const user = await login(email.toLowerCase().trim(), password);
    setLoading(false);

    if (user) {
      await signIn(user);
    } else {
      setErrorMsg(t('invalid_login'));
    }
  };

  const testServer = async () => {
    try {
      const normalized = await setApiBaseUrlOverride(serverUrl);
      const response = await fetch(`${normalized}/health`);
      if (!response.ok) throw new Error(String(response.status));
      setErrorMsg(t('server_connection_ok'));
    } catch {
      setErrorMsg(t('server_connection_failed'));
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <View style={styles.logoPanel}>
            <Image source={COLLEGE_LOGO} style={styles.logo} contentFit="contain" />
          </View>
          <Text variant="displaySmall" style={styles.title}>{t('login_title')}</Text>
          <Text variant="titleMedium" style={styles.subtitle}>{t('college_name')}</Text>
          <Text style={styles.caption}>{t('login_subtitle')}</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label={t('password')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            style={styles.input}
          />

          <Button
            mode="text"
            icon="server-network"
            onPress={() => setShowServerSettings(!showServerSettings)}
            style={styles.serverToggle}
          >
            {t('backend_server')}
          </Button>

          {showServerSettings ? (
            <View style={styles.serverBox}>
              <TextInput
                label={t('backend_url')}
                value={serverUrl}
                onChangeText={setServerUrl}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
                mode="outlined"
                style={styles.input}
                placeholder="http://192.168.1.10:8080"
              />
              <Text style={styles.serverHint}>{t('backend_url_hint')}</Text>
              <Button mode="outlined" icon="check-network-outline" onPress={testServer}>
                {t('test_connection')}
              </Button>
            </View>
          ) : null}

          <Button 
            mode="contained" 
            onPress={handleLogin} 
            loading={loading}
            style={styles.button}
          >
            {t('sign_in')}
          </Button>
          
          <Button 
            mode="text" 
            onPress={() => router.push('/auth/register')}
            style={styles.textButton}
          >
            {t('no_account_register')}
          </Button>
        </View>
      </ScrollView>

      <Snackbar visible={!!errorMsg} onDismiss={() => setErrorMsg('')} duration={3000}>
        {errorMsg}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logoPanel: {
    width: 220,
    height: 150,
    borderRadius: 8,
    backgroundColor: '#fff',
    padding: 12,
    marginBottom: 20,
    elevation: 2,
  },
  logo: {
    width: '100%',
    height: '100%',
  },
  title: { fontWeight: 'bold', color: THEME.colors.primary },
  subtitle: { color: THEME.colors.textSecondary, marginTop: 8 },
  caption: { color: THEME.colors.textSecondary, marginTop: 4, fontSize: 12 },
  form: { gap: 16 },
  input: { backgroundColor: '#fff' },
  button: { marginTop: 8, paddingVertical: 6 },
  textButton: { marginTop: 8 },
  serverToggle: { alignSelf: 'flex-start', marginTop: -4 },
  serverBox: { gap: 8, marginTop: -8 },
  serverHint: { color: THEME.colors.textSecondary, fontSize: 12, lineHeight: 18 },
});

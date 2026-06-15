import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Avatar, Button, List, Divider, Card, SegmentedButtons, TextInput, Snackbar } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { THEME } from '../../constants/theme';
import { useEffect, useState } from 'react';
import { getAllBooks } from '../../services/bookService';
import { getAllDisciplines, getAllCategories } from '../../services/disciplineService';
import { AppLanguage, useLanguage } from '../../contexts/LanguageContext';
import { getApiBaseUrl, setApiBaseUrlOverride } from '../../services/backendApi';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const { language, setLanguage, t } = useLanguage();
  const [stats, setStats] = useState({
    totalBooks: 0,
    offlineBooks: 0,
    disciplines: 0,
    categories: 0
  });
  const [serverUrl, setServerUrl] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    loadStats();
    getApiBaseUrl().then(setServerUrl).catch(() => {});
  }, []);

  const loadStats = async () => {
    const books = await getAllBooks();
    const discs = await getAllDisciplines();
    const cats = await getAllCategories();
    
    setStats({
      totalBooks: books.length,
      offlineBooks: books.filter(b => b.is_downloaded).length,
      disciplines: discs.length,
      categories: cats.length
    });
  };

  const saveServerUrl = async () => {
    try {
      const normalized = await setApiBaseUrlOverride(serverUrl);
      setServerUrl(normalized);
      setMessage(t('server_saved'));
    } catch {
      setMessage(t('invalid_server_url'));
    }
  };

  const testServer = async () => {
    try {
      const normalized = await setApiBaseUrlOverride(serverUrl);
      const response = await fetch(`${normalized}/health`);
      if (!response.ok) throw new Error(String(response.status));
      setServerUrl(normalized);
      setMessage(t('server_connection_ok'));
    } catch {
      setMessage(t('server_connection_failed'));
    }
  };

  if (!user) return null;

  const roleLabels: Record<string, string> = {
    admin: t('admin'),
    teacher: t('teacher'),
    student: t('student')
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Avatar.Text 
          size={80} 
          label={user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()} 
          style={styles.avatar}
        />
        <Text variant="headlineSmall" style={styles.name}>{user.full_name}</Text>
        <Text variant="bodyLarge" style={styles.role}>{roleLabels[user.role] || user.role}</Text>
        <Text variant="bodyMedium" style={styles.email}>{user.email}</Text>
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statVal}>{stats.totalBooks}</Text>
          <Text style={styles.statLab}>{t('books')}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statVal}>{stats.offlineBooks}</Text>
          <Text style={styles.statLab}>{t('offline')}</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statVal}>{stats.disciplines}</Text>
          <Text style={styles.statLab}>{t('disciplines')}</Text>
        </Card>
      </View>

      <List.Section style={styles.section}>
        <List.Subheader>{t('profile')}</List.Subheader>
        {user.group_name && <List.Item title={t('group')} description={user.group_name} left={props => <List.Icon {...props} icon="account-group" />} />}
        <List.Item 
          title={t('specialty')}
          description={t('information_systems')}
          left={props => <List.Icon {...props} icon="school" />} 
        />
        <List.Item 
          title={t('registration_date')}
          description={user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'} 
          left={props => <List.Icon {...props} icon="calendar" />} 
        />
      </List.Section>

      <Divider />

      <List.Section style={styles.section}>
        <List.Subheader>{t('settings')}</List.Subheader>
        <View style={styles.languageBox}>
          <Text style={styles.languageTitle}>{t('language')}</Text>
          <SegmentedButtons
            value={language}
            onValueChange={(value) => setLanguage(value as AppLanguage)}
            buttons={[
              { value: 'ru', label: 'RU' },
              { value: 'kk', label: 'KZ' },
              { value: 'en', label: 'EN' },
            ]}
          />
        </View>
        <List.Item title={t('notifications')} left={props => <List.Icon {...props} icon="bell-outline" />} right={props => <List.Icon {...props} icon="chevron-right" />} />
        <List.Item title={t('dark_theme')} left={props => <List.Icon {...props} icon="theme-light-dark" />} right={props => <List.Icon {...props} icon="chevron-right" />} />
        <View style={styles.serverBox}>
          <Text style={styles.languageTitle}>{t('backend_server')}</Text>
          <TextInput
            label={t('backend_url')}
            value={serverUrl}
            onChangeText={setServerUrl}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="url"
            mode="outlined"
            style={styles.serverInput}
            placeholder="http://192.168.1.10:8080"
          />
          <Text style={styles.serverHint}>{t('backend_url_hint')}</Text>
          <View style={styles.serverActions}>
            <Button mode="outlined" onPress={testServer}>{t('test_connection')}</Button>
            <Button mode="contained" onPress={saveServerUrl}>{t('save')}</Button>
          </View>
        </View>
      </List.Section>

      <Button 
        mode="outlined" 
        onPress={signOut} 
        style={styles.logoutBtn}
        textColor={THEME.colors.error}
      >
        {t('logout')}
      </Button>
      
      <Text style={styles.version}>PocketLib v1.0.0 (Diploma Edition)</Text>
      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={2600}>
        {message}
      </Snackbar>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 2,
  },
  avatar: {
    backgroundColor: THEME.colors.primary,
    marginBottom: 16,
  },
  name: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  role: {
    color: THEME.colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  email: {
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    marginTop: 8,
  },
  statCard: {
    padding: 12,
    alignItems: 'center',
    width: '30%',
    backgroundColor: '#fff',
  },
  statVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.colors.primary,
  },
  statLab: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
  },
  languageBox: { paddingHorizontal: 16, paddingBottom: 12 },
  languageTitle: { color: THEME.colors.textSecondary, marginBottom: 8 },
  serverBox: { paddingHorizontal: 16, paddingBottom: 16, gap: 8 },
  serverInput: { backgroundColor: '#fff' },
  serverHint: { color: THEME.colors.textSecondary, fontSize: 12, lineHeight: 18 },
  serverActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 8 },
  logoutBtn: {
    margin: 24,
    borderColor: THEME.colors.error,
  },
  version: {
    textAlign: 'center',
    color: '#ccc',
    fontSize: 10,
    marginBottom: 40,
  }
});

import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, IconButton, SegmentedButtons, Snackbar, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { syncGutenbergBooks, syncOfficialBooks } from '../../services/bookService';
import { deleteUser, getAllUsers, updateUserRole, User } from '../../services/userService';
import { THEME } from '../../constants/theme';

export default function AdminScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [users, setUsers] = useState<User[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => setUsers(await getAllUsers());

  useEffect(() => {
    load();
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }, []);

  if (user?.role !== 'admin') {
    return (
      <View style={styles.center}>
        <Text>Доступ разрешен только администратору.</Text>
      </View>
    );
  }

  const changeRole = async (target: User, role: User['role']) => {
    await updateUserRole(target.id, role);
    await load();
    setMessage(`Роль пользователя ${target.full_name} обновлена`);
  };

  const confirmDelete = (target: User) => {
    Alert.alert('Удалить пользователя?', target.full_name, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deleteUser(target.id);
          await load();
        },
      },
    ]);
  };

  const syncGutenberg = async () => {
    try {
      const count = await syncGutenbergBooks();
      setMessage(`Добавлено во встроенную библиотеку: ${count} книг Gutenberg`);
    } catch {
      setMessage('Не удалось обновить Gutenberg. Проверьте интернет.');
    }
  };

  const syncOfficial = async () => {
    try {
      const count = await syncOfficialBooks();
      setMessage(`Добавлено официальных ссылок: ${count}`);
    } catch {
      setMessage('BK API недоступен. Запустите сервер на порту 3047.');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>Панель администратора</Text>
        <Text style={styles.headerSub}>Пользователи и каталог PocketLib</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Text variant="titleMedium">Книги</Text>
            <View style={styles.actionRow}>
              <Button mode="contained" icon="book-plus" onPress={() => router.push('/add')}>Добавить книгу</Button>
              <Button mode="outlined" icon="book-open-page-variant" onPress={syncGutenberg}>Загрузить Gutenberg</Button>
              <Button mode="text" icon="link-variant" onPress={syncOfficial}>Ссылки gov.kz</Button>
            </View>
          </Card.Content>
        </Card>

        <Text variant="titleLarge" style={styles.sectionTitle}>{t('users')}: {users.length}</Text>
        {users.map((item) => (
          <Card key={item.id} style={styles.userCard}>
            <Card.Content>
              <View style={styles.userHeader}>
                <View style={styles.userInfo}>
                  <Text variant="titleMedium">{item.full_name}</Text>
                  <Text style={styles.meta}>{item.email}</Text>
                </View>
                {item.email === 'admin@university.edu'
                  ? <Chip compact>Основной админ</Chip>
                  : <IconButton icon="delete-outline" iconColor={THEME.colors.error} onPress={() => confirmDelete(item)} />}
              </View>
              <SegmentedButtons
                value={item.role}
                onValueChange={(role) => changeRole(item, role as User['role'])}
                buttons={[
                  { value: 'student', label: 'Студент' },
                  { value: 'teacher', label: 'Преподаватель' },
                  { value: 'admin', label: 'Админ' },
                ]}
              />
            </Card.Content>
          </Card>
        ))}
      </ScrollView>

      <Snackbar visible={!!message} onDismiss={() => setMessage('')} duration={3500}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: { backgroundColor: THEME.colors.primary, padding: 20, paddingTop: 52 },
  headerTitle: { color: '#fff', fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.75)', marginTop: 4 },
  content: { padding: 16, paddingBottom: 40 },
  actionsCard: { backgroundColor: '#fff', marginBottom: 20 },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  sectionTitle: { fontWeight: 'bold', marginBottom: 8 },
  userCard: { backgroundColor: '#fff', marginTop: 10 },
  userHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  userInfo: { flex: 1 },
  meta: { color: THEME.colors.textSecondary, marginTop: 2 },
});

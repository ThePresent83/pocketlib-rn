import { useCallback, useEffect, useState } from 'react';
import { Alert, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Card, Chip, IconButton, SegmentedButtons, Snackbar, Text } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
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
        <Text>{t('admin_access_denied')}</Text>
      </View>
    );
  }

  const changeRole = async (target: User, role: User['role']) => {
    await updateUserRole(target.id, role);
    await load();
    setMessage(`${t('role_updated')}: ${target.full_name}`);
  };

  const confirmDelete = (target: User) => {
    Alert.alert(t('delete_user_title'), target.full_name, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          await deleteUser(target.id);
          await load();
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>{t('admin_panel')}</Text>
        <Text style={styles.headerSub}>{t('admin_subtitle')}</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card style={styles.actionsCard}>
          <Card.Content>
            <Text variant="titleMedium">{t('books')}</Text>
            <View style={styles.actionRow}>
              <Button mode="contained" icon="book-plus" onPress={() => router.push('/add')}>{t('add_book')}</Button>
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
                  {!!item.group_name && <Text style={styles.meta}>{t('group_label')}: {item.group_name}</Text>}
                </View>
                {item.email === 'admin@university.edu'
                  ? <Chip compact>{t('primary_admin')}</Chip>
                  : <IconButton icon="delete-outline" iconColor={THEME.colors.error} onPress={() => confirmDelete(item)} />}
              </View>
              <SegmentedButtons
                value={item.role}
                onValueChange={(role) => changeRole(item, role as User['role'])}
                buttons={[
                  { value: 'student', label: t('student') },
                  { value: 'teacher', label: t('teacher') },
                  { value: 'admin', label: t('admin') },
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

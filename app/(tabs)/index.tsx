import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, Icon, IconButton, Avatar } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { THEME } from '../../constants/theme';
import { getAllBooks, Book, syncGutenbergBooks } from '../../services/bookService';
import { useRouter } from 'expo-router';
import MaterialCard from '../../components/MaterialCard';

export default function Dashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [recentBooks, setRecentBooks] = useState<Book[]>([]);
  const [offlineBooks, setOfflineBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState({ total: 0, offline: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const all = await getAllBooks();
    setRecentBooks(all.slice(0, 5));
    const offline = all.filter(b => b.is_downloaded);
    setOfflineBooks(offline.slice(0, 5));
    setStats({
      total: all.length,
      offline: offline.length
    });
  };

  useEffect(() => {
    loadData();
    syncGutenbergBooks().then(loadData).catch(() => {});
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, []);

  if (!user) return null;

  return (
    <ScrollView 
      style={styles.container} 
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <View style={styles.welcomeSection}>
        <View style={styles.welcomeRow}>
          <View>
            <Text variant="bodyLarge" style={styles.greeting}>С возвращением,</Text>
            <Text variant="headlineSmall" style={styles.userName}>{user.full_name}</Text>
            <Text variant="bodySmall" style={styles.userInfo}>
              {user.group_name ? `${user.group_name} | ` : ''}
              {user.role === 'student' ? 'Студент' : user.role === 'teacher' ? 'Преподаватель' : 'Админ'}
            </Text>
          </View>
          <TouchableOpacity onPress={() => router.push('/profile')}>
            <Avatar.Text 
              size={50} 
              label={user.full_name[0].toUpperCase()} 
              style={{ backgroundColor: THEME.colors.accent }}
              labelStyle={{ color: THEME.colors.primary }}
            />
          </TouchableOpacity>
        </View>

        <View style={styles.quickStats}>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.total}</Text>
            <Text style={styles.statLabel}>Материалов</Text>
          </View>
          <View style={[styles.statBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.statNum}>{stats.offline}</Text>
            <Text style={styles.statLabel}>Офлайн</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>12</Text>
            <Text style={styles.statLabel}>Дисциплин</Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/library')}>
            <View style={[styles.iconCircle, { backgroundColor: '#E8EAF6' }]}>
              <Icon source="bookshelf" size={24} color={THEME.colors.primary} />
            </View>
            <Text style={styles.actionText}>Библиотека</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/library?offline=true')}>
            <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
              <Icon source="download-circle" size={24} color={THEME.colors.success} />
            </View>
            <Text style={styles.actionText}>Офлайн</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/gutendex')}>
            <View style={[styles.iconCircle, { backgroundColor: '#FFF3E0' }]}>
              <Icon source="earth" size={24} color="#E65100" />
            </View>
            <Text style={styles.actionText}>Мировая база</Text>
          </TouchableOpacity>

          {(user.role === 'admin' || user.role === 'teacher') && (
            <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/add')}>
              <View style={[styles.iconCircle, { backgroundColor: '#FCE4EC' }]}>
                <Icon source="plus-box" size={24} color="#C2185B" />
              </View>
              <Text style={styles.actionText}>Добавить</Text>
            </TouchableOpacity>
          )}
        </View>

        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={styles.sectionTitle}>Последние добавленные</Text>
          <TouchableOpacity onPress={() => router.push('/library')}>
            <Text style={styles.seeAll}>Все</Text>
          </TouchableOpacity>
        </View>

        {recentBooks.length > 0 ? (
          recentBooks.map(book => (
            <MaterialCard 
              key={book.id} 
              item={book} 
              onPress={(b) => router.push(`/book/${b.id}`)} 
            />
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>Пока нет учебных материалов</Text>
          </Card>
        )}

        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <Text variant="titleLarge" style={styles.sectionTitle}>Рекомендовано вам</Text>
        </View>
        <Card style={styles.promoCard}>
          <Card.Content style={styles.promoRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.promoTitle}>Подготовка к сессии</Text>
              <Text style={styles.promoDesc}>Подборка методических указаний для подготовки к экзаменам.</Text>
            </View>
            <Icon source="school-outline" size={40} color={THEME.colors.primary} />
          </Card.Content>
        </Card>
      </View>
      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  welcomeSection: {
    backgroundColor: THEME.colors.primary,
    padding: 24,
    paddingTop: 60,
    borderBottomLeftRadius: 32,
    borderBottomRightRadius: 32,
  },
  welcomeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  greeting: { color: 'rgba(255,255,255,0.7)' },
  userName: { color: '#fff', fontWeight: 'bold' },
  userInfo: { color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  quickStats: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 16,
  },
  statBox: { flex: 1, alignItems: 'center' },
  statNum: { color: '#fff', fontSize: 18, fontWeight: 'bold' },
  statLabel: { color: 'rgba(255,255,255,0.6)', fontSize: 10, textTransform: 'uppercase', marginTop: 2 },
  content: { padding: 20 },
  actionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
    marginTop: -40,
  },
  actionCard: {
    width: '23%',
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 12,
    alignItems: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 6,
  },
  actionText: { fontSize: 10, fontWeight: '600', color: THEME.colors.text },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: { fontWeight: 'bold', color: THEME.colors.text },
  seeAll: { color: THEME.colors.primary, fontWeight: '600' },
  emptyCard: { padding: 30, alignItems: 'center', backgroundColor: '#fff' },
  emptyText: { color: '#999' },
  promoCard: { backgroundColor: '#fff', borderRadius: 16 },
  promoRow: { flexDirection: 'row', alignItems: 'center' },
  promoTitle: { fontWeight: 'bold', fontSize: 16, marginBottom: 4 },
  promoDesc: { fontSize: 12, color: THEME.colors.textSecondary },
});

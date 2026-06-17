import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity, RefreshControl } from 'react-native';
import { Text, Card, Icon, IconButton, Avatar } from 'react-native-paper';
import { Image } from 'expo-image';
import { useAuth } from '../../contexts/AuthContext';
import { THEME } from '../../constants/theme';
import { getAllBooks, Book } from '../../services/bookService';
import { useRouter } from 'expo-router';
import MaterialCard from '../../components/MaterialCard';
import { getAllCoursesWithDisciplines, getAllDisciplines } from '../../services/disciplineService';
import { useLanguage } from '../../contexts/LanguageContext';
import { getFavoriteBookIds, getRecentBookIds } from '../../services/libraryUxService';
import { getProgress } from '../../services/readerService';
import PwaInstallButton from '../../components/PwaInstallButton';

const COLLEGE_LOGO = require('../../assets/polytech-logo.png');

export default function Dashboard() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const router = useRouter();
  const [recentBooks, setRecentBooks] = useState<Book[]>([]);
  const [offlineBooks, setOfflineBooks] = useState<Book[]>([]);
  const [recommendedBooks, setRecommendedBooks] = useState<Book[]>([]);
  const [continueBooks, setContinueBooks] = useState<Book[]>([]);
  const [favoriteBooks, setFavoriteBooks] = useState<Book[]>([]);
  const [stats, setStats] = useState({ total: 0, offline: 0, disciplines: 0 });
  const [refreshing, setRefreshing] = useState(false);

  const loadData = async () => {
    const [all, courses, disciplines, favoriteIds, recentIds] = await Promise.all([
      getAllBooks(),
      getAllCoursesWithDisciplines(),
      getAllDisciplines(),
      getFavoriteBookIds(),
      getRecentBookIds(),
    ]);
    setRecentBooks(all.slice(0, 5));
    const offline = all.filter(b => b.is_downloaded);
    setOfflineBooks(offline.slice(0, 5));
    setFavoriteBooks(all.filter(book => favoriteIds.includes(book.id)).slice(0, 4));

    const recentRank = new Map(recentIds.map((id, index) => [id, index]));
    const progressCandidates = (recentIds.length
      ? recentIds.map(id => all.find(book => book.id === id)).filter(Boolean)
      : all.slice(0, 30)) as Book[];
    const progressPairs = await Promise.all(
      progressCandidates.map(async book => ({ book, progress: await getProgress(`book:${book.id}`) }))
    );
    setContinueBooks(progressPairs
      .filter(item => item.progress.total_pages > 0)
      .sort((a, b) => {
        const aRecent = recentRank.get(a.book.id) ?? 9999;
        const bRecent = recentRank.get(b.book.id) ?? 9999;
        return aRecent - bRecent || b.progress.page - a.progress.page;
      })
      .map(item => item.book)
      .slice(0, 4));

    const userCourse = user?.course_id ? courses.find(course => course.id === user.course_id) : null;
    const exactCourseMatches = user?.course_id ? all.filter(book => book.course_id === user.course_id) : [];
    const disciplineMatches = userCourse?.discipline_id
      ? all.filter(book => book.course_id !== user?.course_id && book.discipline_id === userCourse.discipline_id)
      : [];
    const fallback = all.filter(book => !exactCourseMatches.includes(book) && !disciplineMatches.includes(book));
    setRecommendedBooks([...exactCourseMatches, ...disciplineMatches, ...fallback].slice(0, 5));

    setStats({
      total: all.length,
      offline: offline.length,
      disciplines: disciplines.length
    });
  };

  useEffect(() => {
    loadData();
  }, [user?.course_id]);

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
        <View style={styles.brandRow}>
          <View style={styles.brandLogoBox}>
            <Image source={COLLEGE_LOGO} style={styles.brandLogo} contentFit="contain" />
          </View>
          <View style={styles.brandTextBox}>
            <Text style={styles.brandTitle}>Polytech College Almaty</Text>
            <Text style={styles.brandSub}>{t('login_subtitle')}</Text>
          </View>
        </View>
        <View style={styles.welcomeRow}>
          <View>
            <Text variant="bodyLarge" style={styles.greeting}>{t('welcome_back')}</Text>
            <Text variant="headlineSmall" style={styles.userName}>{user.full_name}</Text>
            <Text variant="bodySmall" style={styles.userInfo}>
              {user.group_name ? `${user.group_name} | ` : ''}
              {user.role === 'student' ? t('student') : user.role === 'teacher' ? t('teacher') : t('admin')}
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
            <Text style={styles.statLabel}>{t('materials')}</Text>
          </View>
          <View style={[styles.statBox, { borderLeftWidth: 1, borderRightWidth: 1, borderColor: 'rgba(255,255,255,0.2)' }]}>
            <Text style={styles.statNum}>{stats.offline}</Text>
            <Text style={styles.statLabel}>{t('offline')}</Text>
          </View>
          <View style={styles.statBox}>
            <Text style={styles.statNum}>{stats.disciplines}</Text>
            <Text style={styles.statLabel}>{t('disciplines')}</Text>
          </View>
        </View>
        <PwaInstallButton />
      </View>

      <View style={styles.content}>
        <View style={styles.actionGrid}>
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/library')}>
            <View style={[styles.iconCircle, { backgroundColor: '#E8EAF6' }]}>
              <Icon source="bookshelf" size={24} color={THEME.colors.primary} />
            </View>
            <Text style={styles.actionText}>{t('library')}</Text>
          </TouchableOpacity>
          
          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/library?offline=true')}>
            <View style={[styles.iconCircle, { backgroundColor: '#E8F5E9' }]}>
              <Icon source="download-circle" size={24} color={THEME.colors.success} />
            </View>
            <Text style={styles.actionText}>{t('offline')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/library?available=true')}>
            <View style={[styles.iconCircle, { backgroundColor: '#E3F2FD' }]}>
              <Icon source="web" size={24} color={THEME.colors.info} />
            </View>
            <Text style={styles.actionText}>{t('available_online')}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/library?favorites=true')}>
            <View style={[styles.iconCircle, { backgroundColor: '#FFF3E0' }]}>
              <Icon source="heart" size={24} color={THEME.colors.warning} />
            </View>
            <Text style={styles.actionText}>{t('favorite_books')}</Text>
          </TouchableOpacity>

          {(user.role === 'admin' || user.role === 'teacher') && (
            <>
              <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/add')}>
                <View style={[styles.iconCircle, { backgroundColor: '#FCE4EC' }]}>
                  <Icon source="plus-box" size={24} color="#C2185B" />
                </View>
                <Text style={styles.actionText}>{t('add')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.actionCard} onPress={() => router.push('/gutendex')}>
                <View style={[styles.iconCircle, { backgroundColor: '#F3E5F5' }]}>
                  <Icon source="book-search" size={24} color="#7B1FA2" />
                </View>
                <Text style={styles.actionText}>{t('gutendex')}</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {continueBooks.length > 0 ? (
          <>
            <View style={styles.sectionHeader}>
              <Text variant="titleLarge" style={styles.sectionTitle}>{t('continue_reading')}</Text>
              <TouchableOpacity onPress={() => router.push('/library?available=true')}>
                <Text style={styles.seeAll}>{t('all')}</Text>
              </TouchableOpacity>
            </View>
            {continueBooks.map(book => (
              <MaterialCard
                key={`continue-${book.id}`}
                item={book}
                onPress={(b) => router.push(`/book/${b.id}`)}
              />
            ))}
          </>
        ) : null}

        {favoriteBooks.length > 0 ? (
          <>
            <View style={[styles.sectionHeader, { marginTop: 20 }]}>
              <Text variant="titleLarge" style={styles.sectionTitle}>{t('favorite_books')}</Text>
              <TouchableOpacity onPress={() => router.push('/library?favorites=true')}>
                <Text style={styles.seeAll}>{t('all')}</Text>
              </TouchableOpacity>
            </View>
            {favoriteBooks.map(book => (
              <MaterialCard
                key={`favorite-${book.id}`}
                item={book}
                onPress={(b) => router.push(`/book/${b.id}`)}
              />
            ))}
          </>
        ) : null}

        <View style={styles.sectionHeader}>
          <Text variant="titleLarge" style={styles.sectionTitle}>{t('latest_added')}</Text>
          <TouchableOpacity onPress={() => router.push('/library')}>
            <Text style={styles.seeAll}>{t('all')}</Text>
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
            <Text style={styles.emptyText}>{t('no_materials')}</Text>
          </Card>
        )}

        <View style={[styles.sectionHeader, { marginTop: 20 }]}>
          <Text variant="titleLarge" style={styles.sectionTitle}>{t('for_your_group')}</Text>
        </View>
        {recommendedBooks.length > 0 ? (
          recommendedBooks.map(book => (
            <MaterialCard
              key={`recommended-${book.id}`}
              item={book}
              onPress={(b) => router.push(`/book/${b.id}`)}
            />
          ))
        ) : (
          <Card style={styles.emptyCard}>
            <Text style={styles.emptyText}>
              {user.group_name ? t('no_group_materials') : t('choose_group_hint')}
            </Text>
          </Card>
        )}
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
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
  },
  brandLogoBox: {
    width: 74,
    height: 54,
    backgroundColor: '#fff',
    borderRadius: 8,
    padding: 5,
    marginRight: 12,
  },
  brandLogo: {
    width: '100%',
    height: '100%',
  },
  brandTextBox: {
    flex: 1,
  },
  brandTitle: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
  },
  brandSub: {
    color: 'rgba(255,255,255,0.68)',
    fontSize: 12,
    marginTop: 2,
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

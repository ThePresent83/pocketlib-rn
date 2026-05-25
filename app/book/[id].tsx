import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Alert, TouchableOpacity } from 'react-native';
import { Text, IconButton, Button, Menu, Snackbar, Card, Icon, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';
import { Book, getBookById, deleteBook, updateBook, assignDiscipline } from '../../services/bookService';
import { getBookDescription } from '../../services/api';
import { Discipline, getAllDisciplines } from '../../services/disciplineService';
import { getProgress } from '../../services/readerService';
import { THEME } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import Badge from '../../components/Badge';

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  
  const [book, setBook] = useState<Book | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [discMenuVisible, setDiscMenuVisible] = useState(false);
  const [progressInfo, setProgressInfo] = useState<{ text: string, percent: number } | null>(null);
  
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  const loadData = async () => {
    if (!id) return;
    const b = await getBookById(Number(id));
    if (b) {
      setBook(b);
      
      const d = await getAllDisciplines();
      setDisciplines(d);

      const bookKey = b.file_path ? `file:${b.file_path}` : `ol:${b.ol_key}`;
      const prog = await getProgress(bookKey);
      if (prog.total_pages > 0) {
        const cur = prog.page + 1;
        const total = prog.total_pages;
        const pct = Math.floor((cur / total) * 100);
        setProgressInfo({
          text: `Прочитано: стр. ${cur} из ${total}`,
          percent: pct
        });
      }

      if (!b.description && b.ol_key && b.source === 'gutendex') {
        fetchDesc(b);
      }
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const fetchDesc = async (b: Book) => {
    const desc = await getBookDescription(b.ol_key!);
    if (desc) {
      await updateBook(b.id, { description: desc });
      setBook({ ...b, description: desc });
    }
  };

  const handleAssignDiscipline = async (discId: number, discName: string) => {
    if (!book) return;
    await assignDiscipline(book.id, discId);
    setBook({ ...book, discipline_id: discId });
    setDiscMenuVisible(false);
    setSnackbarMsg(`✅ Назначена дисциплина «${discName}»`);
    setSnackbarVisible(true);
  };

  const confirmDelete = () => {
    Alert.alert('Удалить?', `«${book?.title}» будет удалена из библиотеки.`, [
      { text: 'Отмена', style: 'cancel' },
      { text: 'Удалить', style: 'destructive', onPress: async () => {
        if (book) {
          await deleteBook(book.id);
          router.replace('/(tabs)/library');
        }
      }}
    ]);
  };

  if (!book) return null;

  const canRead = !book.access_level || 
                 book.access_level === 'public' || 
                 user?.role === 'admin' || 
                 (book.access_level === 'teachers' && user?.role === 'teacher') ||
                 (book.access_level === 'students' && (user?.role === 'student' || user?.role === 'teacher'));

  const currentDisc = disciplines.find(d => d.id === book.discipline_id);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <IconButton icon="arrow-left" iconColor="#fff" onPress={() => router.back()} />
        <Text variant="titleLarge" style={styles.topbarTitle} numberOfLines={1}>
          {book.title}
        </Text>
        {user?.role !== 'student' && (
          <IconButton icon="delete-outline" iconColor="#fff" onPress={confirmDelete} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.infoCard}>
          <View style={styles.row}>
            <View style={styles.coverWrap}>
              {book.cover_url ? (
                <Icon source="image" size={40} color="#ccc" />
              ) : (
                <Icon source="book-education" size={60} color={THEME.colors.primary} />
              )}
            </View>
            <View style={styles.mainInfo}>
              <Text variant="headlineSmall" style={styles.title}>{book.title}</Text>
              <Text variant="titleMedium" style={styles.author}>{book.author || 'Автор неизвестен'}</Text>
              <View style={styles.badgeRow}>
                {book.material_type && <Badge label={book.material_type} type="type" />}
                {book.language && <Badge label={book.language.toUpperCase()} type="lang" />}
                {book.is_downloaded && <Badge label="Офлайн" type="offline" />}
              </View>
            </View>
          </View>
        </Card>

        <View style={styles.detailsBox}>
          <View style={styles.detailItem}>
            <Icon source="book-open-outline" size={20} color={THEME.colors.textSecondary} />
            <Text style={styles.detailText}>Дисциплина: <Text style={styles.bold}>{currentDisc?.name || 'не указана'}</Text></Text>
          </View>
          <View style={styles.detailItem}>
            <Icon source="calendar" size={20} color={THEME.colors.textSecondary} />
            <Text style={styles.detailText}>Семестр: <Text style={styles.bold}>{book.semester || '—'}</Text></Text>
          </View>
          {book.teacher && (
            <View style={styles.detailItem}>
              <Icon source="account-tie" size={20} color={THEME.colors.textSecondary} />
              <Text style={styles.detailText}>Преподаватель: <Text style={styles.bold}>{book.teacher}</Text></Text>
            </View>
          )}
          {book.version && (
            <View style={styles.detailItem}>
              <Icon source="source-version" size={20} color={THEME.colors.textSecondary} />
              <Text style={styles.detailText}>Версия: <Text style={styles.bold}>{book.version}</Text></Text>
            </View>
          )}
        </View>

        <Divider style={{ marginVertical: 16 }} />

        <Text variant="titleMedium" style={styles.descTitle}>Описание</Text>
        <Text style={styles.description}>{book.description || 'Описание отсутствует.'}</Text>

        {progressInfo && (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>{progressInfo.text}</Text>
              <Text style={styles.progressPct}>{progressInfo.percent}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressInfo.percent}%` }]} />
            </View>
          </View>
        )}

        <View style={styles.btnCol}>
          {!canRead ? (
            <Button mode="contained" disabled buttonColor={THEME.colors.border} style={styles.actionBtn}>
              Доступ ограничен
            </Button>
          ) : (
            <Button
              mode="contained"
              icon="book-open-page-variant"
              buttonColor={THEME.colors.primary}
              onPress={() => router.push(`/reader/${book.id}`)}
              style={styles.actionBtn}
            >
              Открыть материал
            </Button>
          )}

          {user?.role !== 'student' && (
            <Menu
              visible={discMenuVisible}
              onDismiss={() => setDiscMenuVisible(false)}
              anchor={
                <Button
                  mode="outlined"
                  icon="bookmark-outline"
                  onPress={() => setDiscMenuVisible(true)}
                  style={styles.actionBtn}
                >
                  Назначить дисциплину
                </Button>
              }
            >
              {disciplines.map(d => (
                <Menu.Item key={d.id} onPress={() => handleAssignDiscipline(d.id, d.name)} title={d.name} />
              ))}
            </Menu>
          )}
        </View>
      </ScrollView>

      <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={3000}>
        {snackbarMsg}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  topbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.primary, height: 56, paddingHorizontal: 4 },
  topbarTitle: { color: '#fff', fontWeight: 'bold', flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  infoCard: { padding: 16, backgroundColor: '#fff', borderRadius: 16, elevation: 4, marginBottom: 20 },
  row: { flexDirection: 'row' },
  coverWrap: { width: 90, height: 130, borderRadius: 8, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center' },
  mainInfo: { flex: 1, marginLeft: 16 },
  title: { fontWeight: 'bold', marginBottom: 4, color: THEME.colors.text },
  author: { color: THEME.colors.textSecondary, marginBottom: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap' },
  detailsBox: { backgroundColor: '#fff', padding: 16, borderRadius: 12 },
  detailItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  detailText: { marginLeft: 10, color: THEME.colors.text, fontSize: 14 },
  bold: { fontWeight: 'bold' },
  descTitle: { fontWeight: 'bold', marginBottom: 8 },
  description: { fontSize: 14, lineHeight: 22, color: THEME.colors.textSecondary },
  btnCol: { marginTop: 24, gap: 12 },
  actionBtn: { borderRadius: 24, paddingVertical: 4 },
  progressContainer: { marginTop: 20 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: THEME.colors.textSecondary },
  progressPct: { fontSize: 12, fontWeight: 'bold', color: THEME.colors.primary },
  progressBar: { height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: THEME.colors.primary }
});

import { useCallback, useState } from 'react';
import { Alert, Linking, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Divider, Icon, IconButton, Menu, Snackbar, Text } from 'react-native-paper';
import Badge from '../../components/Badge';
import { THEME } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { getBookDescription } from '../../services/api';
import { assignDiscipline, Book, deleteBook, getBookById, updateBook } from '../../services/bookService';
import { Discipline, getAllDisciplines } from '../../services/disciplineService';
import { getProgress } from '../../services/readerService';

function getBookKey(book: Book): string {
  if (book.file_path) return `file:${book.file_path}`;
  if (book.external_url) return `url:${book.external_url}`;
  return `ol:${book.ol_key}`;
}

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const [book, setBook] = useState<Book | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [disciplineMenuVisible, setDisciplineMenuVisible] = useState(false);
  const [progressInfo, setProgressInfo] = useState<{ text: string; percent: number } | null>(null);
  const [message, setMessage] = useState('');

  const loadData = async () => {
    if (!id) return;
    const loadedBook = await getBookById(Number(id));
    if (!loadedBook) return;

    setBook(loadedBook);
    setDisciplines(await getAllDisciplines());

    const progress = await getProgress(getBookKey(loadedBook));
    if (progress.total_pages > 0) {
      const current = progress.page + 1;
      setProgressInfo({
        text: `Прочитано: стр. ${current} из ${progress.total_pages}`,
        percent: Math.floor((current / progress.total_pages) * 100),
      });
    } else {
      setProgressInfo(null);
    }

    if (!loadedBook.description && loadedBook.ol_key && loadedBook.source === 'gutenberg') {
      const description = await getBookDescription();
      await updateBook(loadedBook.id, { description });
      setBook({ ...loadedBook, description });
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id])
  );

  const assignBookDiscipline = async (discipline: Discipline) => {
    if (!book) return;
    await assignDiscipline(book.id, discipline.id);
    setBook({ ...book, discipline_id: discipline.id });
    setDisciplineMenuVisible(false);
    setMessage(`Назначена дисциплина «${discipline.name}»`);
  };

  const confirmDelete = () => {
    if (!book) return;
    Alert.alert('Удалить книгу?', `«${book.title}» будет удалена из библиотеки.`, [
      { text: 'Отмена', style: 'cancel' },
      {
        text: 'Удалить',
        style: 'destructive',
        onPress: async () => {
          await deleteBook(book.id);
          router.replace('/(tabs)/library');
        },
      },
    ]);
  };

  const openBook = async () => {
    if (!book) return;
    if (book.file_path || book.ol_key) {
      router.push(`/reader/${book.id}`);
      return;
    }
    if (book.external_url && await Linking.canOpenURL(book.external_url)) {
      await Linking.openURL(book.external_url);
      return;
    }
    setMessage('Для этой книги пока нет доступного файла или ссылки');
  };

  if (!book) return null;

  const canRead = !book.access_level
    || book.access_level === 'public'
    || user?.role === 'admin'
    || (book.access_level === 'teachers' && user?.role === 'teacher')
    || (book.access_level === 'students' && (user?.role === 'student' || user?.role === 'teacher'));
  const currentDiscipline = disciplines.find((discipline) => discipline.id === book.discipline_id);
  const internalReaderAvailable = Boolean(book.file_path || book.ol_key);

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <IconButton icon="arrow-left" iconColor="#fff" onPress={() => router.back()} />
        <Text variant="titleLarge" style={styles.topbarTitle} numberOfLines={1}>{book.title}</Text>
        {user?.role !== 'student' && (
          <IconButton icon="delete-outline" iconColor="#fff" onPress={confirmDelete} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.infoCard}>
          <View style={styles.row}>
            <View style={styles.coverWrap}>
              {book.cover_url ? (
                <Image source={book.cover_url} style={styles.cover} contentFit="cover" />
              ) : (
                <Icon source="book-education" size={56} color={THEME.colors.primary} />
              )}
            </View>
            <View style={styles.mainInfo}>
              <Text variant="headlineSmall" style={styles.title}>{book.title}</Text>
              <Text variant="titleMedium" style={styles.author}>{book.author || 'Автор неизвестен'}</Text>
              <View style={styles.badgeRow}>
                {book.material_type ? <Badge label={book.material_type} type="type" /> : null}
                {book.language ? <Badge label={book.language.toUpperCase()} type="lang" /> : null}
                {book.is_downloaded ? <Badge label="Офлайн" type="offline" /> : null}
              </View>
            </View>
          </View>
        </Card>

        <View style={styles.detailsBox}>
          <View style={styles.detailItem}>
            <Icon source="book-open-outline" size={20} color={THEME.colors.textSecondary} />
            <Text style={styles.detailText}>{`Дисциплина: ${currentDiscipline?.name || 'не указана'}`}</Text>
          </View>
          <View style={styles.detailItem}>
            <Icon source="database-outline" size={20} color={THEME.colors.textSecondary} />
            <Text style={styles.detailText}>{`Источник: ${book.source === 'gutenberg' ? 'Project Gutenberg' : book.source}`}</Text>
          </View>
          <View style={styles.detailItem}>
            <Icon source={internalReaderAvailable ? 'book-check-outline' : 'open-in-new'} size={20} color={THEME.colors.textSecondary} />
            <Text style={styles.detailText}>
              {internalReaderAvailable ? 'Доступно чтение внутри приложения' : 'Доступна внешняя ссылка'}
            </Text>
          </View>
        </View>

        <Divider style={styles.divider} />
        <Text variant="titleMedium" style={styles.descriptionTitle}>Описание</Text>
        <Text style={styles.description}>{book.description || 'Описание отсутствует.'}</Text>

        {progressInfo ? (
          <View style={styles.progressContainer}>
            <View style={styles.progressHeader}>
              <Text style={styles.progressText}>{progressInfo.text}</Text>
              <Text style={styles.progressPercent}>{progressInfo.percent}%</Text>
            </View>
            <View style={styles.progressBar}>
              <View style={[styles.progressFill, { width: `${progressInfo.percent}%` }]} />
            </View>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Button
            mode="contained"
            icon={internalReaderAvailable ? 'book-open-page-variant' : 'open-in-new'}
            disabled={!canRead}
            buttonColor={THEME.colors.primary}
            onPress={openBook}
          >
            {canRead ? (internalReaderAvailable ? 'Читать в приложении' : 'Открыть ссылку') : 'Доступ ограничен'}
          </Button>

          {user?.role !== 'student' ? (
            <Menu
              visible={disciplineMenuVisible}
              onDismiss={() => setDisciplineMenuVisible(false)}
              anchor={
                <Button mode="outlined" icon="bookmark-outline" onPress={() => setDisciplineMenuVisible(true)}>
                  Назначить дисциплину
                </Button>
              }
            >
              {disciplines.map((discipline) => (
                <Menu.Item
                  key={discipline.id}
                  title={discipline.name}
                  onPress={() => assignBookDiscipline(discipline)}
                />
              ))}
            </Menu>
          ) : null}
        </View>
      </ScrollView>

      <Snackbar visible={Boolean(message)} onDismiss={() => setMessage('')} duration={3000}>
        {message}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  topbar: { flexDirection: 'row', alignItems: 'center', backgroundColor: THEME.colors.primary, height: 56, paddingHorizontal: 4 },
  topbarTitle: { color: '#fff', fontWeight: 'bold', flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  infoCard: { padding: 16, backgroundColor: '#fff', borderRadius: 8, elevation: 3, marginBottom: 16 },
  row: { flexDirection: 'row' },
  coverWrap: { width: 96, height: 144, borderRadius: 6, backgroundColor: '#f0f0f0', justifyContent: 'center', alignItems: 'center', overflow: 'hidden' },
  cover: { width: '100%', height: '100%' },
  mainInfo: { flex: 1, marginLeft: 16 },
  title: { fontWeight: 'bold', marginBottom: 4, color: THEME.colors.text },
  author: { color: THEME.colors.textSecondary, marginBottom: 12 },
  badgeRow: { flexDirection: 'row', flexWrap: 'wrap' },
  detailsBox: { backgroundColor: '#fff', padding: 16, borderRadius: 8 },
  detailItem: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  detailText: { marginLeft: 10, color: THEME.colors.text, fontSize: 14, flex: 1 },
  divider: { marginVertical: 16 },
  descriptionTitle: { fontWeight: 'bold', marginBottom: 8 },
  description: { fontSize: 14, lineHeight: 22, color: THEME.colors.textSecondary },
  progressContainer: { marginTop: 20 },
  progressHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 },
  progressText: { fontSize: 12, color: THEME.colors.textSecondary },
  progressPercent: { fontSize: 12, fontWeight: 'bold', color: THEME.colors.primary },
  progressBar: { height: 6, backgroundColor: '#e0e0e0', borderRadius: 3, overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: THEME.colors.primary },
  actions: { marginTop: 24, gap: 12 },
});

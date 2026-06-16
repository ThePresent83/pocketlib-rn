import { useCallback, useState } from 'react';
import { Alert, Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { useFocusEffect } from '@react-navigation/native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Card, Divider, Icon, IconButton, Menu, Snackbar, Text } from 'react-native-paper';
import Badge from '../../components/Badge';
import { THEME } from '../../constants/theme';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { assignDiscipline, Book, deleteBook, downloadBookFile, getBookById, uploadBookFile } from '../../services/bookService';
import { CourseWithDiscipline, Discipline, getAllCoursesWithDisciplines, getAllDisciplines } from '../../services/disciplineService';
import { getProgress } from '../../services/readerService';
import { getLocalizedCourseName, getLocalizedDisciplineName } from '../../utils/localizedCatalog';
import { isFavoriteBook, rememberRecentBook, toggleFavoriteBook } from '../../services/libraryUxService';

function getBookKey(book: Book): string {
  return `book:${book.id}`;
}

function getFileExtension(path?: string): string {
  return path?.split('?')[0].split('.').pop()?.toLowerCase() || '';
}

function isMediaExtension(ext: string): boolean {
  return ['pdf', 'djvu'].includes(ext);
}

function isSupportedDocument(fileName: string): boolean {
  return ['pdf', 'txt', 'epub'].includes(getFileExtension(fileName));
}

function mimeForExtension(ext: string): string {
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'epub') return 'application/epub+zip';
  if (ext === 'djvu') return 'image/vnd.djvu';
  return '*/*';
}

export default function BookDetailScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const [book, setBook] = useState<Book | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [courses, setCourses] = useState<CourseWithDiscipline[]>([]);
  const [disciplineMenuVisible, setDisciplineMenuVisible] = useState(false);
  const [progressInfo, setProgressInfo] = useState<{ text: string; percent: number } | null>(null);
  const [message, setMessage] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [uploadingFile, setUploadingFile] = useState(false);
  const [isFavorite, setIsFavorite] = useState(false);

  const loadData = async () => {
    if (!id) return;
    const loadedBook = await getBookById(String(id));
    if (!loadedBook) return;

    setBook(loadedBook);
    setIsFavorite(await isFavoriteBook(loadedBook.id));
    const [nextDisciplines, nextCourses] = await Promise.all([
      getAllDisciplines(),
      getAllCoursesWithDisciplines(),
    ]);
    setDisciplines(nextDisciplines);
    setCourses(nextCourses);

    const progress = await getProgress(getBookKey(loadedBook));
    if (progress.total_pages > 0) {
      const current = progress.page + 1;
      setProgressInfo({
        text: `${t('read_pages_prefix')} ${current} ${t('of')} ${progress.total_pages}`,
        percent: Math.floor((current / progress.total_pages) * 100),
      });
    } else {
      setProgressInfo(null);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [id, language])
  );

  const assignBookDiscipline = async (discipline: Discipline) => {
    if (!book) return;
    await assignDiscipline(book.id, discipline.id);
    setBook({ ...book, discipline_id: discipline.id });
    setDisciplineMenuVisible(false);
    setMessage(`${t('assigned_discipline')}: ${getLocalizedDisciplineName(discipline, language)}`);
  };

  const confirmDelete = () => {
    if (!book) return;
    Alert.alert(t('delete_book_title'), `«${book.title}» ${t('delete_book_message')}`, [
      { text: t('cancel'), style: 'cancel' },
      {
        text: t('delete'),
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteBook(book.id);
            router.replace('/(tabs)/library');
          } catch (error: any) {
            setMessage(error?.message || t('save_failed'));
          }
        },
      },
    ]);
  };

  const openBook = async () => {
    if (!book) return;
    const ext = getFileExtension(book.file_name || book.file_path || book.external_url);
    if (book.file_path) {
      if (isMediaExtension(ext)) {
        try {
          if (Platform.OS === 'android') {
            const getContentUriAsync = (FileSystem as any).getContentUriAsync as undefined | ((uri: string) => Promise<string>);
            const uri = getContentUriAsync ? await getContentUriAsync(book.file_path) : book.file_path;
            await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
              data: uri,
              flags: 1,
              type: mimeForExtension(ext),
            });
            return;
          }

          await Linking.openURL(book.file_path);
        } catch {
          setMessage(t('open_original_failed'));
        }
        return;
      }
      await rememberRecentBook(book.id);
      router.push(`/reader/${book.id}`);
      return;
    }
    if (book.has_file && !isMediaExtension(ext)) {
      await rememberRecentBook(book.id);
      router.push(`/reader/${book.id}`);
      return;
    }
    if (book.gutenberg_id && book.has_fulltext) {
      await rememberRecentBook(book.id);
      router.push(`/reader/${book.id}`);
      return;
    }
    if (book.external_url && await Linking.canOpenURL(book.external_url)) {
      await Linking.openURL(book.external_url);
      return;
    }
    setMessage(book.has_file ? t('download_first') : t('no_available_file'));
  };

  const toggleFavorite = async () => {
    if (!book) return;
    setIsFavorite(await toggleFavoriteBook(book.id));
  };

  const downloadBook = async () => {
    if (!book || downloading) return;
    setDownloading(true);
    try {
      const downloadedBook = await downloadBookFile(book);
      setBook(downloadedBook);
      setMessage(t('file_ready'));
    } catch (error: any) {
      setMessage(error?.message === 'missing_server_file' ? t('missing_server_file') : error?.message || t('download_failed'));
    } finally {
      setDownloading(false);
    }
  };

  const pickAndUploadFile = async () => {
    if (!book || uploadingFile) return;

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'application/epub+zip', 'application/epub'],
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;

      const file = result.assets[0];
      if (!isSupportedDocument(file.name)) {
        setMessage(t('choose_supported_file'));
        return;
      }

      setUploadingFile(true);
      const uploadedBook = await uploadBookFile(book.id, {
        uri: file.uri,
        name: file.name,
        mimeType: file.mimeType,
        webFile: (file as any).file,
      });
      if (!uploadedBook?.has_file) throw new Error('Book file was not uploaded');

      setBook(uploadedBook);
      setMessage(t('file_ready'));
    } catch (error: any) {
      setMessage(error?.message || t('save_failed'));
    } finally {
      setUploadingFile(false);
    }
  };

  if (!book) return null;

  const canRead = !book.access_level
    || book.access_level === 'public'
    || user?.role === 'admin'
    || (book.access_level === 'teachers' && user?.role === 'teacher')
    || (book.access_level === 'students' && (user?.role === 'student' || user?.role === 'teacher'));
  const currentDiscipline = disciplines.find((discipline) => discipline.id === book.discipline_id);
  const currentCourse = courses.find((course) => course.id === book.course_id);
  const fileExt = getFileExtension(book.file_name || book.file_path || book.external_url);
  const isMediaDocument = isMediaExtension(fileExt);
  const gutenbergReaderAvailable = Boolean(book.gutenberg_id && book.has_fulltext);
  const internalReaderAvailable = gutenbergReaderAvailable || Boolean((book.file_path || book.has_file) && !isMediaDocument);
  const documentAvailable = Boolean(book.file_path || book.external_url || book.has_file || gutenbergReaderAvailable);
  const shouldDownloadBeforeOpen = Boolean(!book.is_downloaded && book.has_file && isMediaDocument);
  const typeLabels: Record<string, string> = {
    textbook: t('textbook'),
    lecture: t('lecture'),
    manual: t('manual'),
    practice: t('practice'),
    book: t('books'),
  };

  return (
    <View style={styles.container}>
      <View style={styles.topbar}>
        <IconButton icon="arrow-left" iconColor="#fff" onPress={() => router.back()} />
        <Text variant="titleLarge" style={styles.topbarTitle} numberOfLines={1}>{book.title}</Text>
        <IconButton icon={isFavorite ? 'heart' : 'heart-outline'} iconColor="#fff" onPress={toggleFavorite} />
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
              <Text variant="titleMedium" style={styles.author}>{book.author || t('unknown_author')}</Text>
              <View style={styles.badgeRow}>
                {book.material_type ? <Badge label={typeLabels[book.material_type] || book.material_type} type="type" /> : null}
                {book.language ? <Badge label={book.language.toUpperCase()} type="lang" /> : null}
                {book.is_downloaded ? <Badge label={t('offline')} type="offline" /> : book.has_file ? <Badge label={t('on_server')} /> : null}
              </View>
            </View>
          </View>
        </Card>

        <View style={styles.detailsBox}>
          <View style={styles.detailItem}>
            <Icon source="book-open-outline" size={20} color={THEME.colors.textSecondary} />
            <Text style={styles.detailText}>{`${t('discipline')}: ${currentDiscipline ? getLocalizedDisciplineName(currentDiscipline, language) : t('not_specified')}`}</Text>
          </View>
          <View style={styles.detailItem}>
            <Icon source="school-outline" size={20} color={THEME.colors.textSecondary} />
            <Text style={styles.detailText}>{`${t('course')}: ${currentCourse ? `${currentCourse.year} ${t('course')} · ${getLocalizedCourseName(currentCourse, language)}` : t('not_specified')}`}</Text>
          </View>
          <View style={styles.detailItem}>
            <Icon source="database-outline" size={20} color={THEME.colors.textSecondary} />
            <Text style={styles.detailText}>{`${t('source')}: ${book.source === 'gutenberg' ? 'Project Gutenberg' : book.source || t('not_specified')}`}</Text>
          </View>
          <View style={styles.detailItem}>
            <Icon source={internalReaderAvailable ? 'book-check-outline' : isMediaDocument ? 'file-document-outline' : 'open-in-new'} size={20} color={THEME.colors.textSecondary} />
            <Text style={styles.detailText}>
              {book.is_downloaded
                ? (internalReaderAvailable ? t('available_in_app') : t('downloaded_document'))
                : book.has_file ? t('server_file_hint') : t('external_link_available')}
            </Text>
          </View>
        </View>

        <Divider style={styles.divider} />
        <Text variant="titleMedium" style={styles.descriptionTitle}>{t('description')}</Text>
        <Text style={styles.description}>{book.description || t('description_missing')}</Text>

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
          {shouldDownloadBeforeOpen ? (
            <Button
              mode="contained"
              icon="download"
              disabled={!canRead || downloading}
              loading={downloading}
              buttonColor={THEME.colors.primary}
              onPress={downloadBook}
            >
              {canRead ? t('download_book') : t('access_restricted')}
            </Button>
          ) : (
            <Button
              mode="contained"
              icon={internalReaderAvailable ? 'book-open-page-variant' : isMediaDocument ? 'file-document-outline' : 'open-in-new'}
              disabled={!canRead || !documentAvailable}
              buttonColor={THEME.colors.primary}
              onPress={openBook}
            >
              {canRead ? (internalReaderAvailable ? t('read') : documentAvailable ? t('open_document') : t('no_file')) : t('access_restricted')}
            </Button>
          )}

          {!shouldDownloadBeforeOpen && !book.is_downloaded && book.has_file ? (
            <Button
              mode="outlined"
              icon="download"
              disabled={!canRead || downloading}
              loading={downloading}
              onPress={downloadBook}
            >
              {canRead ? t('download_book') : t('access_restricted')}
            </Button>
          ) : null}

          {user?.role !== 'student' ? (
            <>
              {!book.has_file ? (
                <Button
                  mode="outlined"
                  icon="file-upload"
                  loading={uploadingFile}
                  disabled={uploadingFile}
                  onPress={pickAndUploadFile}
                >
                  {t('choose_file')}
                </Button>
              ) : null}

            <Menu
              visible={disciplineMenuVisible}
              onDismiss={() => setDisciplineMenuVisible(false)}
              anchor={
                <Button mode="outlined" icon="bookmark-outline" onPress={() => setDisciplineMenuVisible(true)}>
                  {t('assign_discipline')}
                </Button>
              }
            >
              {disciplines.map((discipline) => (
                <Menu.Item
                  key={discipline.id}
                  title={getLocalizedDisciplineName(discipline, language)}
                  onPress={() => assignBookDiscipline(discipline)}
                />
              ))}
            </Menu>
            </>
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

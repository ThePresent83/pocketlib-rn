import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView, Linking } from 'react-native';
import { Text, IconButton, Dialog, Portal, Button, List, Snackbar } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { getBookById, Book } from '../../services/bookService';
import { getBookText } from '../../services/api';
import { getProgress, saveProgress, toggleBookmark, getBookmarks } from '../../services/readerService';
import { THEME } from '../../constants/theme';

const CHARS_PER_PAGE = 1200;

function splitIntoPages(text: string, chars: number = CHARS_PER_PAGE): string[] {
  const paragraphs = text.split(/\n{2,}/).map(p => p.trim()).filter(Boolean);
  const pages: string[] = [];
  let current: string[] = [];
  let currentLen = 0;

  for (const para of paragraphs) {
    if (currentLen + para.length + 2 > chars && current.length > 0) {
      pages.push(current.join('\n\n'));
      current = [para];
      currentLen = para.length;
    } else {
      current.push(para);
      currentLen += para.length + 2;
    }
  }
  if (current.length > 0) pages.push(current.join('\n\n'));
  return pages.length ? pages : [text];
}

function cleanText(raw: string): string {
  const lines = raw.split('\n');
  const cleaned = [];
  for (let line of lines) {
    if (line.length > 5) {
      const alnum = (line.match(/[a-zA-Z\u0430-\u044f\u0410-\u042f\u0451\u04010-9]/g) || []).length;
      if (alnum / line.length < 0.35) continue;
    }
    line = line.replace(/[\u00ab\u00bb<>^&#*%\u00a3$|[\]{}~@]/g, '').replace(/ {2,}/g, ' ').trim();
    if (line) cleaned.push(line);
  }
  return cleaned.join('\n\n');
}

export default function ReaderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  
  const [book, setBook] = useState<Book | null>(null);
  const [pages, setPages] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(0);
  const [fontSize, setFontSize] = useState(16);
  const [themeIdx, setThemeIdx] = useState(0);
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  
  const [loadingMsg, setLoadingMsg] = useState('Загрузка...');
  const [bookmarkDialogVisible, setBookmarkDialogVisible] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  const themes = ['light', 'sepia', 'dark'] as const;
  const currentTheme = THEME.readerThemes[themes[themeIdx]];
  const bookKey = book
    ? (book.file_path ? `file:${book.file_path}` : book.external_url ? `url:${book.external_url}` : `ol:${book.ol_key}`)
    : '';

  useEffect(() => {
    if (id) loadBook(Number(id));
  }, [id]);

  const loadBook = async (bookId: number) => {
    const b = await getBookById(bookId);
    if (!b) return;
    setBook(b);
    
    if (b.external_url) {
      setPages([
        `${b.title}\n\nДля этой книги доступна официальная электронная версия. Нажмите кнопку ниже, чтобы открыть чтение на сайте издательства.`
      ]);
      setCurrentPage(0);
      setLoadingMsg('');
    } else if (b.file_path) {
      if (b.file_path.toLowerCase().endsWith('.pdf')) {
        showPdfStub(b.file_path, b.title);
      } else {
        try {
          const raw = await FileSystem.readAsStringAsync(b.file_path, { encoding: FileSystem.EncodingType.UTF8 });
          initReader(raw, b);
        } catch (e: any) {
          setLoadingMsg(`Не удалось прочитать файл:\n${e.message}`);
        }
      }
    } else if (b.ol_key) {
      setLoadingMsg('⏳ Загрузка текста книги...\nЭто может занять несколько секунд.');
      const text = await getBookText(b.ol_key);
      initReader(text || 'Текст недоступен', b);
    }
  };

  const openOnlineReader = async () => {
    if (!book?.external_url) return;
    const supported = await Linking.canOpenURL(book.external_url);
    if (supported) await Linking.openURL(book.external_url);
    else {
      setSnackbarMsg('Не удалось открыть официальную ссылку');
      setSnackbarVisible(true);
    }
  };

  const initReader = async (rawText: string, b: Book) => {
    const clean = cleanText(rawText);
    const pgs = splitIntoPages(clean, CHARS_PER_PAGE);
    setPages(pgs);

    const bKey = b.file_path ? `file:${b.file_path}` : `ol:${b.ol_key}`;
    const prog = await getProgress(bKey);
    setFontSize(prog.font_size || 16);
    
    const bms = await getBookmarks(bKey);
    setBookmarks(bms);

    const savedPage = prog.page || 0;
    setCurrentPage(Math.min(savedPage, Math.max(0, pgs.length - 1)));
    setLoadingMsg('');
  };

  const showPdfStub = (filePath: string, title: string) => {
    setPages([
      `📄 ${title}\n\nЭто PDF-файл. Встроенный ридер поддерживает только текстовые файлы.\n\nНажмите кнопку ниже, чтобы открыть PDF в системном просмотрщике.`
    ]);
    setCurrentPage(0);
    setLoadingMsg('');
  };

  const openSystemPdf = async () => {
    if (book?.file_path) {
      try {
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: book.file_path,
          flags: 1,
          type: 'application/pdf',
        });
      } catch (e) {
        setSnackbarMsg('Не удалось открыть системный просмотрщик');
        setSnackbarVisible(true);
      }
    }
  };

  const changePage = (delta: number) => {
    const newPage = currentPage + delta;
    if (newPage >= 0 && newPage < pages.length) {
      setCurrentPage(newPage);
      if (bookKey) saveProgress(bookKey, newPage, pages.length, fontSize);
    }
  };

  const changeFont = (delta: number) => {
    const newSize = fontSize + delta;
    if (newSize >= 12 && newSize <= 28) {
      setFontSize(newSize);
      if (bookKey) saveProgress(bookKey, currentPage, pages.length, newSize);
    }
  };

  const cycleTheme = () => {
    setThemeIdx((prev) => (prev + 1) % themes.length);
  };

  const handleToggleBookmark = async () => {
    if (!bookKey || pages.length === 0) return;
    const added = await toggleBookmark(bookKey, currentPage);
    if (added) {
      setBookmarks([...bookmarks, currentPage]);
      setSnackbarMsg(`🔖 Закладка добавлена на стр. ${currentPage + 1}`);
    } else {
      setBookmarks(bookmarks.filter(p => p !== currentPage));
      setSnackbarMsg('Закладка удалена');
    }
    setSnackbarVisible(true);
  };

  const handleBack = () => {
    if (bookKey && pages.length > 0) {
      saveProgress(bookKey, currentPage, pages.length, fontSize);
    }
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.bg }]}>
      {/* Topbar */}
      <View style={[styles.topbar, { backgroundColor: currentTheme.topbar }]}>
        <IconButton icon="arrow-left" iconColor="#fff" onPress={handleBack} />
        <Text style={styles.topbarTitle} numberOfLines={1}>{book?.title || 'Чтение'}</Text>
        <IconButton
          icon={bookmarks.includes(currentPage) ? 'bookmark' : 'bookmark-outline'}
          iconColor="#fff"
          onPress={handleToggleBookmark}
        />
        <IconButton icon="bookmark-multiple-outline" iconColor="#fff" onPress={() => setBookmarkDialogVisible(true)} />
        <IconButton icon="theme-light-dark" iconColor="#fff" onPress={cycleTheme} />
      </View>

      {/* Progress Bar (simplified) */}
      <View style={{ height: 4, backgroundColor: currentTheme.bottombar }}>
        <View style={{ height: 4, backgroundColor: THEME.colors.primary, width: pages.length ? `${((currentPage + 1) / pages.length) * 100}%` : '0%' }} />
      </View>

      {/* Text Area */}
      {loadingMsg ? (
        <View style={styles.loadingBox}>
          <Text style={{ color: currentTheme.text, textAlign: 'center' }}>{loadingMsg}</Text>
        </View>
      ) : (
        <ScrollView style={styles.scroll}>
          <Text style={[styles.text, { fontSize, color: currentTheme.text }]}>
            {pages[currentPage]}
          </Text>
          {!!book?.file_path?.toLowerCase().endsWith('.pdf') && (
            <Button mode="contained" onPress={openSystemPdf} style={{ margin: 20 }}>
              Открыть в системном просмотрщике
            </Button>
          )}
          {!!book?.external_url && (
            <Button mode="contained" icon="open-in-new" onPress={openOnlineReader} style={{ margin: 20 }}>
              Читать на сайте издательства
            </Button>
          )}
        </ScrollView>
      )}

      {/* Bottombar */}
      <View style={[styles.bottombar, { backgroundColor: currentTheme.bottombar }]}>
        <IconButton icon="format-font-size-decrease" iconColor={currentTheme.text} onPress={() => changeFont(-2)} />
        <IconButton icon="chevron-left" iconColor={currentTheme.text} onPress={() => changePage(-1)} />
        <Text style={[styles.pageLabel, { color: currentTheme.text }]}>
          {pages.length ? `${currentPage + 1} / ${pages.length}` : '0 / 0'}
        </Text>
        <IconButton icon="chevron-right" iconColor={currentTheme.text} onPress={() => changePage(1)} />
        <IconButton icon="format-font-size-increase" iconColor={currentTheme.text} onPress={() => changeFont(2)} />
      </View>

      <Portal>
        <Dialog visible={bookmarkDialogVisible} onDismiss={() => setBookmarkDialogVisible(false)}>
          <Dialog.Title>📌 Закладки</Dialog.Title>
          <Dialog.Content>
            {bookmarks.length === 0 ? (
              <Text>Закладок пока нет</Text>
            ) : (
              <ScrollView style={{ maxHeight: 240 }}>
                {bookmarks.sort((a, b) => a - b).map(p => (
                  <List.Item
                    key={p}
                    title={`Страница ${p + 1}`}
                    onPress={() => {
                      setCurrentPage(p);
                      setBookmarkDialogVisible(false);
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setBookmarkDialogVisible(false)}>Закрыть</Button>
          </Dialog.Actions>
        </Dialog>

        <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={2000}>
          {snackbarMsg}
        </Snackbar>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 52,
    paddingHorizontal: 4,
  },
  topbarTitle: {
    color: '#fff',
    fontWeight: 'bold',
    flex: 1,
    fontSize: 16,
  },
  loadingBox: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  scroll: {
    flex: 1,
  },
  text: {
    padding: 24,
    lineHeight: 30,
  },
  bottombar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 56,
    paddingHorizontal: 8,
  },
  pageLabel: {
    fontWeight: 'bold',
    fontSize: 14,
  },
});

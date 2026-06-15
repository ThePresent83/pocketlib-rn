import { createElement, useEffect, useMemo, useState } from 'react';
import { Linking, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { Button, Dialog, Divider, IconButton, List, Portal, Snackbar, Text } from 'react-native-paper';
import { WebView } from 'react-native-webview';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getBookById, Book, downloadBookFile } from '../../services/bookService';
import { EpubBook, loadEpub } from '../../services/epubService';
import {
  ReaderAppearance,
  getAppearance,
  getBookmarks,
  getProgress,
  saveAppearance,
  saveProgress,
  toggleBookmark,
} from '../../services/readerService';
import { THEME } from '../../constants/theme';
import { useLanguage } from '../../contexts/LanguageContext';
import { rememberRecentBook } from '../../services/libraryUxService';

const CHARS_PER_PAGE = 1250;

const READER_THEMES = {
  paper: {
    labelKey: 'theme_paper',
    bg: '#F5F0DF',
    page: '#FBF7EA',
    text: '#201B14',
    muted: '#756B5B',
    panel: '#EEE5D2',
    accent: '#8E6A2D',
  },
  white: {
    labelKey: 'theme_white',
    bg: '#F4F6F8',
    page: '#FFFFFF',
    text: '#1F2328',
    muted: '#667085',
    panel: '#EAEEF3',
    accent: '#3F51B5',
  },
  green: {
    labelKey: 'theme_green',
    bg: '#EAF1E8',
    page: '#F6FAF2',
    text: '#172016',
    muted: '#63715E',
    panel: '#DDE8D8',
    accent: '#477343',
  },
  dark: {
    labelKey: 'theme_dark',
    bg: '#111318',
    page: '#191C22',
    text: '#E8E2D6',
    muted: '#A7A093',
    panel: '#252932',
    accent: '#D8B46A',
  },
} as const;

const FONT_PRESETS = [
  { id: 'serif', labelKey: 'font_serif', family: Platform.select({ ios: 'Georgia', android: 'serif', default: 'Georgia' }) },
  { id: 'sans', labelKey: 'font_sans', family: Platform.select({ ios: 'Avenir', android: 'sans-serif', default: 'Arial' }) },
  { id: 'mono', labelKey: 'font_mono', family: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'Courier New' }) },
  { id: 'system', labelKey: 'font_system', family: undefined },
];

const PAGE_WIDTHS = [
  { value: 620, labelKey: 'width_narrow' },
  { value: 760, labelKey: 'width_medium' },
  { value: 920, labelKey: 'width_wide' },
];

type ReaderMode = 'text' | 'epub' | 'media';
type ThemeKey = keyof typeof READER_THEMES;
type ReaderTheme = (typeof READER_THEMES)[ThemeKey];

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
  const withoutBoilerplate = raw
    .replace(/^[\s\S]*?\*\*\* START OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*?\*\*\*/i, '')
    .replace(/\*\*\* END OF (?:THE|THIS) PROJECT GUTENBERG EBOOK[\s\S]*$/i, '');
  const lines = withoutBoilerplate.split('\n');
  const cleaned: string[] = [];

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

function buildEpubReaderText(epubBook: Awaited<ReturnType<typeof loadEpub>>): string {
  const parts: string[] = [];

  if (epubBook.title) parts.push(epubBook.title);
  if (epubBook.author) parts.push(epubBook.author);

  for (const chapter of epubBook.chapters) {
    const text = chapter.text.trim();
    if (!text) continue;

    const title = chapter.title.trim();
    if (title && title !== epubBook.title && !text.toLowerCase().startsWith(title.toLowerCase())) {
      parts.push(title);
    }
    parts.push(text);
  }

  return parts.join('\n\n');
}

function extensionFromPath(path?: string): string {
  return path?.split('?')[0].split('.').pop()?.toLowerCase() || '';
}

function isMediaDocument(book: Book): boolean {
  const ext = extensionFromPath(book.file_name || book.file_path || book.external_url);
  return ['pdf', 'djvu'].includes(ext);
}

function isEpubDocument(book: Book): boolean {
  return extensionFromPath(book.file_name || book.file_path || book.external_url) === 'epub';
}

function mimeForExtension(ext: string): string {
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'epub') return 'application/epub+zip';
  if (ext === 'djvu') return 'image/vnd.djvu';
  return '*/*';
}

function buildWebEpubHtml(html: string, theme: ReaderTheme, fontSize: number, pageWidth: number, fixedLayout: boolean): string {
  const textScale = Math.max(80, Math.min(170, Math.round((fontSize / 18) * 100)));
  const readerStyle = `
    <style>
      html {
        background: ${theme.bg};
        min-height: 100%;
      }
      body {
        background: ${fixedLayout ? theme.bg : theme.page};
        color: ${theme.text};
        box-sizing: border-box;
        max-width: ${fixedLayout ? 'none' : `${pageWidth}px`};
        margin: 0 auto;
        padding: ${fixedLayout ? '0' : '18px 18px 34px'};
        overflow-wrap: break-word;
        word-break: normal;
        font-size: ${textScale}%;
        line-height: 1.7;
      }
      *, *::before, *::after {
        box-sizing: border-box;
      }
      img, svg, video, canvas, object, iframe {
        max-width: 100% !important;
        height: auto !important;
      }
      table {
        max-width: 100% !important;
        width: auto !important;
        border-collapse: collapse;
      }
      pre, code {
        white-space: pre-wrap !important;
        overflow-wrap: anywhere !important;
      }
      a {
        color: ${theme.accent};
      }
    </style>
  `;

  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${readerStyle}`);
  }
  return `<!doctype html><html><head>${readerStyle}</head><body>${html}</body></html>`;
}

async function readTextDocument(uri: string): Promise<string> {
  if (Platform.OS === 'web' && /^(blob:|data:|https?:)/i.test(uri)) {
    const response = await fetch(uri);
    return response.text();
  }

  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.UTF8 });
}

export default function ReaderScreen() {
  const { id } = useLocalSearchParams();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useLanguage();

  const [book, setBook] = useState<Book | null>(null);
  const [mode, setMode] = useState<ReaderMode>('text');
  const [pages, setPages] = useState<string[]>([]);
  const [epubBook, setEpubBook] = useState<EpubBook | null>(null);
  const [epubChapter, setEpubChapter] = useState(0);
  const [epubLoadProgress, setEpubLoadProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [fontSize, setFontSize] = useState(18);
  const [appearance, setAppearance] = useState<ReaderAppearance>({
    font_family: 'serif',
    line_height: 1.7,
    page_width: 760,
    theme: 'paper',
  });
  const [bookmarks, setBookmarks] = useState<number[]>([]);
  const [loadingMsg, setLoadingMsg] = useState(t('reader_loading'));
  const [bookmarkDialogVisible, setBookmarkDialogVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  const bookKey = book ? `book:${book.id}` : '';
  const currentTheme = READER_THEMES[(appearance.theme as ThemeKey) || 'paper'] || READER_THEMES.paper;
  const fontPreset = FONT_PRESETS.find(font => font.id === appearance.font_family) || FONT_PRESETS[0];
  const pageWidth = appearance.page_width || 760;
  const progressPercent = mode === 'epub'
    ? epubBook?.chapters.length ? ((epubChapter + 1) / epubBook.chapters.length) * 100 : 0
    : pages.length ? ((currentPage + 1) / pages.length) * 100 : 0;

  useEffect(() => {
    if (id) loadBook(String(id));
  }, [id]);

  useEffect(() => {
    if (bookKey) saveAppearance(bookKey, appearance);
  }, [appearance, bookKey]);

  const pageTextStyle = useMemo(() => ({
    fontSize,
    lineHeight: Math.round(fontSize * appearance.line_height),
    color: currentTheme.text,
    fontFamily: fontPreset.family,
  }), [appearance.line_height, currentTheme.text, fontPreset.family, fontSize]);

  const loadBook = async (bookId: string) => {
    let loadedBook = await getBookById(bookId);
    if (!loadedBook) return;

    setBook(loadedBook);
    await rememberRecentBook(loadedBook.id);
    setLoadingMsg(t('reader_loading'));

    if (!loadedBook.file_path && loadedBook.has_file) {
      try {
        loadedBook = await downloadBookFile(loadedBook);
        setBook(loadedBook);
      } catch (error: any) {
        setMode('media');
        setPages([]);
        setCurrentPage(0);
        setLoadingMsg('');
        setSnackbarMsg(`${t('download_failed')}: ${error.message}`);
        return;
      }
    }

    if (isEpubDocument(loadedBook)) {
      try {
        await initEpubReader(loadedBook);
      } catch (error: any) {
        await initMediaReader(loadedBook);
        setSnackbarMsg(`${t('epub_text_failed')}: ${error.message}`);
      }
      return;
    }

    if (isMediaDocument(loadedBook)) {
      await initMediaReader(loadedBook);
      return;
    }

    if (loadedBook.external_url) {
      setMode('media');
      setPages([]);
      setCurrentPage(0);
      setLoadingMsg('');
      return;
    }

    if (loadedBook.file_path) {
      try {
        const raw = await readTextDocument(loadedBook.file_path);
        await initTextReader(raw, loadedBook);
      } catch (error: any) {
        setMode('media');
        setPages([]);
        setLoadingMsg('');
        setSnackbarMsg(`${t('file_original_hint')}: ${error.message}`);
      }
      return;
    }

    setMode('media');
    setPages([]);
    setLoadingMsg(t('no_available_file'));
  };

  const initTextReader = async (rawText: string, loadedBook: Book) => {
    const bKey = `book:${loadedBook.id}`;
    const [progress, savedBookmarks, savedAppearance] = await Promise.all([
      getProgress(bKey),
      getBookmarks(bKey),
      getAppearance(bKey),
    ]);

    const clean = cleanText(rawText);
    const nextPages = splitIntoPages(clean, CHARS_PER_PAGE);
    setMode('text');
    setEpubBook(null);
    setPages(nextPages);
    setFontSize(progress.font_size || 18);
    setAppearance({
      ...savedAppearance,
      page_width: savedAppearance.page_width || 760,
    });
    setBookmarks(savedBookmarks);
    setCurrentPage(Math.min(progress.page || 0, Math.max(0, nextPages.length - 1)));
    setLoadingMsg('');
  };

  const initMediaReader = async (loadedBook: Book) => {
    const bKey = `book:${loadedBook.id}`;
    const [savedBookmarks, savedAppearance] = await Promise.all([
      getBookmarks(bKey),
      getAppearance(bKey),
    ]);
    setMode('media');
    setEpubBook(null);
    setPages([]);
    setBookmarks(savedBookmarks);
    setAppearance({
      ...savedAppearance,
      page_width: savedAppearance.page_width || 760,
    });
    setCurrentPage(0);
    setLoadingMsg('');
  };

  const initEpubReader = async (loadedBook: Book) => {
    if (!loadedBook.file_path) {
      setMode('media');
      setLoadingMsg('');
      return;
    }

    const bKey = `book:${loadedBook.id}`;
    const [progress, savedBookmarks, savedAppearance, nextEpubBook] = await Promise.all([
      getProgress(bKey),
      getBookmarks(bKey),
      getAppearance(bKey),
      loadEpub(loadedBook.file_path, { includeText: Platform.OS === 'web' }),
    ]);

    const savedChapter = Math.min(progress.page || 0, Math.max(0, nextEpubBook.chapters.length - 1));
    setMode('epub');
    setPages([]);
    setEpubBook(nextEpubBook);
    setEpubChapter(savedChapter);
    setCurrentPage(savedChapter);
    setFontSize(progress.font_size || 18);
    setAppearance({
      ...savedAppearance,
      page_width: savedAppearance.page_width || 760,
    });
    setBookmarks(savedBookmarks);
    setEpubLoadProgress(0);
    setLoadingMsg('');
  };

  const switchEpubToTextMode = async () => {
    if (!book?.file_path) return;

    setSettingsVisible(false);
    setLoadingMsg(t('prepare_epub_text'));
    try {
      const nextEpubBook = await loadEpub(book.file_path, { includeText: true });
      const readerText = buildEpubReaderText(nextEpubBook);
      if (!readerText.trim()) throw new Error('readable text is empty');
      await initTextReader(readerText, book);
    } catch (error: any) {
      setLoadingMsg('');
      setSnackbarMsg(`${t('epub_text_open_failed')}: ${error.message}`);
    }
  };

  const openOriginalDocument = async () => {
    if (!book) return;

    try {
      if (book.external_url) {
        await Linking.openURL(book.external_url);
        return;
      }

      if (!book.file_path) return;

      const ext = extensionFromPath(book.file_name || book.file_path);
      const mime = mimeForExtension(ext);

      if (Platform.OS === 'android') {
        const getContentUriAsync = (FileSystem as any).getContentUriAsync as undefined | ((uri: string) => Promise<string>);
        const uri = getContentUriAsync ? await getContentUriAsync(book.file_path) : book.file_path;
        await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
          data: uri,
          flags: 1,
          type: mime,
        });
        return;
      }

      await Linking.openURL(book.file_path);
    } catch {
      setSnackbarMsg(t('open_original_failed'));
    }
  };

  const changePage = (delta: number) => {
    if (mode === 'epub' && epubBook) {
      const nextChapter = epubChapter + delta;
      if (nextChapter >= 0 && nextChapter < epubBook.chapters.length) {
        setEpubChapter(nextChapter);
        setCurrentPage(nextChapter);
        setEpubLoadProgress(0);
        if (bookKey) saveProgress(bookKey, nextChapter, epubBook.chapters.length, fontSize);
      }
      return;
    }

    const nextPage = currentPage + delta;
    if (nextPage >= 0 && nextPage < pages.length) {
      setCurrentPage(nextPage);
      if (bookKey) saveProgress(bookKey, nextPage, pages.length, fontSize);
    }
  };

  const changeFont = (delta: number) => {
    const nextSize = fontSize + delta;
    if (nextSize >= 13 && nextSize <= 30) {
      setFontSize(nextSize);
      if (bookKey) {
        const progressPage = mode === 'epub' ? epubChapter : currentPage;
        const totalPages = mode === 'epub' && epubBook ? epubBook.chapters.length : pages.length;
        saveProgress(bookKey, progressPage, totalPages, nextSize);
      }
    }
  };

  const updateAppearance = (updates: Partial<ReaderAppearance>) => {
    setAppearance(current => ({ ...current, ...updates }));
  };

  const handleToggleBookmark = async () => {
    if (!bookKey || (mode === 'text' && pages.length === 0) || (mode === 'epub' && !epubBook)) return;
    const bookmarkPage = mode === 'epub' ? epubChapter : currentPage;
    const added = await toggleBookmark(bookKey, bookmarkPage);
    if (added) {
      setBookmarks([...bookmarks, bookmarkPage]);
      setSnackbarMsg(mode === 'epub'
        ? `${t('bookmark_added_section')} ${bookmarkPage + 1}`
        : `${t('bookmark_added_page')} ${bookmarkPage + 1}`);
    } else {
      setBookmarks(bookmarks.filter(page => page !== bookmarkPage));
      setSnackbarMsg(t('bookmark_removed'));
    }
  };

  const handleBack = () => {
    if (bookKey && mode === 'text' && pages.length > 0) {
      saveProgress(bookKey, currentPage, pages.length, fontSize);
    }
    if (bookKey && mode === 'epub' && epubBook) {
      saveProgress(bookKey, epubChapter, epubBook.chapters.length, fontSize);
    }
    router.back();
  };

  return (
    <View style={[styles.container, { backgroundColor: currentTheme.bg }]}>
      <View style={[styles.topbar, { paddingTop: insets.top, backgroundColor: currentTheme.bg }]}>
        <IconButton icon="chevron-left" iconColor={currentTheme.text} size={30} onPress={handleBack} />
        <View style={styles.titleBlock}>
          <Text style={[styles.bookTitle, { color: currentTheme.text }]} numberOfLines={1}>{book?.title || t('reader')}</Text>
          <Text style={[styles.bookMeta, { color: currentTheme.muted }]} numberOfLines={1}>
            {mode === 'epub' && epubBook
              ? `${t('section')} ${epubChapter + 1} ${t('of')} ${epubBook.chapters.length}`
              : mode === 'text' && pages.length ? `${currentPage + 1} ${t('of')} ${pages.length}` : t('original_document')}
          </Text>
        </View>
        <IconButton
          icon={bookmarks.includes(mode === 'epub' ? epubChapter : currentPage) ? 'bookmark' : 'bookmark-outline'}
          iconColor={currentTheme.text}
          onPress={handleToggleBookmark}
        />
        <IconButton icon="cog-outline" iconColor={currentTheme.text} onPress={() => setSettingsVisible(true)} />
      </View>

      <View style={[styles.progressTrack, { backgroundColor: currentTheme.panel }]}>
        <View style={[styles.progressFill, { width: `${progressPercent}%`, backgroundColor: currentTheme.accent }]} />
      </View>

      {loadingMsg ? (
        <View style={styles.loadingBox}>
          <Text style={[styles.loadingText, { color: currentTheme.muted }]}>{loadingMsg}</Text>
        </View>
      ) : mode === 'media' ? (
        <MediaDocumentView book={book} theme={currentTheme} onOpen={openOriginalDocument} />
      ) : mode === 'epub' && epubBook ? (
        <EpubReaderView
          epubBook={epubBook}
          chapterIndex={epubChapter}
          theme={currentTheme}
          fontSize={fontSize}
          pageWidth={pageWidth}
          loadProgress={epubLoadProgress}
          onLoadProgress={setEpubLoadProgress}
          onOpenExternal={openOriginalDocument}
        />
      ) : (
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.pageContent, { paddingBottom: 42 + insets.bottom }]}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.pageSheet, { maxWidth: pageWidth, backgroundColor: currentTheme.page }]}>
            <Text style={[styles.pageText, pageTextStyle]}>
              {pages[currentPage]}
            </Text>
          </View>
        </ScrollView>
      )}

      {mode === 'text' || mode === 'epub' ? (
        <View style={[styles.bottombar, { paddingBottom: Math.max(insets.bottom, 10), backgroundColor: currentTheme.bg }]}>
          <IconButton icon="format-font-size-decrease" iconColor={currentTheme.text} onPress={() => changeFont(-1)} />
          <IconButton icon="chevron-left" iconColor={currentTheme.text} size={30} onPress={() => changePage(-1)} />
          <Button
            mode="contained-tonal"
            compact
            buttonColor={currentTheme.panel}
            textColor={currentTheme.text}
            onPress={() => setBookmarkDialogVisible(true)}
            style={styles.pageButton}
          >
            {mode === 'epub' && epubBook ? `${epubChapter + 1} / ${epubBook.chapters.length}` : `${currentPage + 1} / ${pages.length}`}
          </Button>
          <IconButton icon="chevron-right" iconColor={currentTheme.text} size={30} onPress={() => changePage(1)} />
          <IconButton icon="format-font-size-increase" iconColor={currentTheme.text} onPress={() => changeFont(1)} />
        </View>
      ) : null}

      <Portal>
        <ReaderSettingsDialog
          visible={settingsVisible}
          theme={currentTheme}
          fontSize={fontSize}
          appearance={appearance}
          onDismiss={() => setSettingsVisible(false)}
          onFontSizeChange={changeFont}
          onAppearanceChange={updateAppearance}
          showTextFallback={mode === 'epub'}
          onUseTextFallback={switchEpubToTextMode}
        />

        <Dialog visible={bookmarkDialogVisible} onDismiss={() => setBookmarkDialogVisible(false)}>
          <Dialog.Title>{t('bookmarks')}</Dialog.Title>
          <Dialog.Content>
            {bookmarks.length === 0 ? (
              <Text>{t('no_bookmarks')}</Text>
            ) : (
              <ScrollView style={{ maxHeight: 260 }}>
                {[...bookmarks].sort((a, b) => a - b).map(page => (
                  <List.Item
                    key={page}
                    title={mode === 'epub' ? `${t('section')} ${page + 1}` : `${t('page')} ${page + 1}`}
                    left={props => <List.Icon {...props} icon="bookmark" />}
                    onPress={() => {
                      if (mode === 'epub') {
                        setEpubChapter(page);
                        setCurrentPage(page);
                      } else {
                        setCurrentPage(page);
                      }
                      setBookmarkDialogVisible(false);
                    }}
                  />
                ))}
              </ScrollView>
            )}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setBookmarkDialogVisible(false)}>{t('close')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Snackbar visible={!!snackbarMsg} onDismiss={() => setSnackbarMsg('')} duration={2600}>
          {snackbarMsg}
        </Snackbar>
      </Portal>
    </View>
  );
}

function EpubReaderView({
  epubBook,
  chapterIndex,
  theme,
  fontSize,
  pageWidth,
  loadProgress,
  onLoadProgress,
  onOpenExternal,
}: {
  epubBook: EpubBook;
  chapterIndex: number;
  theme: ReaderTheme;
  fontSize: number;
  pageWidth: number;
  loadProgress: number;
  onLoadProgress: (progress: number) => void;
  onOpenExternal: () => void;
}) {
  const chapter = epubBook.chapters[chapterIndex];
  const textScale = Math.max(80, Math.min(170, Math.round((fontSize / 18) * 100)));
  const pageMaxWidth = epubBook.fixedLayout ? 'none' : `${pageWidth}px`;
  const pagePadding = epubBook.fixedLayout ? '0' : '14px 14px 28px';

  if (Platform.OS === 'web') {
    const webHtml = buildWebEpubHtml(chapter.html || chapter.text || '', theme, fontSize, pageWidth, epubBook.fixedLayout);
    return (
      <View style={[styles.epubWrap, { backgroundColor: theme.bg }]}>
        {createElement('iframe' as any, {
          title: chapter.title || epubBook.title || 'EPUB',
          srcDoc: webHtml,
          sandbox: 'allow-same-origin allow-scripts allow-popups allow-forms',
          style: {
            border: 0,
            width: '100%',
            height: '100%',
            background: theme.bg,
          },
        })}
      </View>
    );
  }

  const injectedJavaScriptBeforeContentLoaded = epubBook.fixedLayout ? `
    (function() {
      var style = document.createElement('style');
      style.setAttribute('data-pocketlib-reader-fixed', 'true');
      style.textContent = ${JSON.stringify(`
        html, body {
          background: ${theme.bg} !important;
          -webkit-text-size-adjust: 100% !important;
          text-size-adjust: 100% !important;
        }
        body {
          margin-left: auto !important;
          margin-right: auto !important;
          transform-origin: top left !important;
        }
      `)};
      document.head.appendChild(style);
    })();
    true;
  ` : `
    (function() {
      var meta = document.querySelector('meta[name="viewport"]');
      if (!meta) {
        meta = document.createElement('meta');
        meta.setAttribute('name', 'viewport');
        document.head.appendChild(meta);
      }
      meta.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=5, user-scalable=yes');

      var style = document.createElement('style');
      style.setAttribute('data-pocketlib-reader', 'true');
      style.textContent = ${JSON.stringify(`
        html {
          background: ${theme.bg} !important;
          min-height: 100%;
        }
        body {
          box-sizing: border-box !important;
          max-width: ${pageMaxWidth} !important;
          margin-left: auto !important;
          margin-right: auto !important;
          padding: ${pagePadding} !important;
          overflow-wrap: break-word !important;
          word-break: normal !important;
          -webkit-text-size-adjust: ${textScale}% !important;
        }
        *, *::before, *::after {
          box-sizing: border-box;
        }
        img, svg, video, canvas, object, iframe {
          max-width: 100% !important;
          height: auto !important;
        }
        table {
          max-width: 100% !important;
          width: auto !important;
          border-collapse: collapse;
        }
        pre, code {
          white-space: pre-wrap !important;
          overflow-wrap: anywhere !important;
        }
        math, .MathJax, .mjx-chtml, .mjx-container {
          max-width: 100% !important;
          overflow-x: auto !important;
          overflow-y: hidden !important;
        }
      `)};
      document.head.appendChild(style);
    })();
    true;
  `;

  return (
    <View style={[styles.epubWrap, { backgroundColor: theme.bg }]}>
      {loadProgress > 0 && loadProgress < 1 ? (
        <View style={[styles.webProgressTrack, { backgroundColor: theme.panel }]}>
          <View style={[styles.webProgressFill, { width: `${Math.round(loadProgress * 100)}%`, backgroundColor: theme.accent }]} />
        </View>
      ) : null}
      <WebView
        key={`${chapter.href}:${epubBook.fixedLayout ? 'fixed' : `${fontSize}:${pageWidth}:${theme.bg}`}`}
        originWhitelist={['*']}
        source={{ uri: chapter.uri }}
        style={[styles.epubWebView, { backgroundColor: theme.bg }]}
        containerStyle={{ backgroundColor: theme.bg }}
        showsVerticalScrollIndicator
        showsHorizontalScrollIndicator
        setSupportMultipleWindows={false}
        javaScriptEnabled
        domStorageEnabled
        scalesPageToFit={epubBook.fixedLayout}
        textZoom={epubBook.fixedLayout ? 100 : textScale}
        setBuiltInZoomControls
        setDisplayZoomControls={false}
        nestedScrollEnabled
        allowFileAccess
        allowFileAccessFromFileURLs
        allowUniversalAccessFromFileURLs={false}
        allowingReadAccessToURL={epubBook.rootUri}
        injectedJavaScriptBeforeContentLoaded={injectedJavaScriptBeforeContentLoaded}
        onLoadProgress={({ nativeEvent }) => onLoadProgress(nativeEvent.progress)}
        onLoadEnd={() => onLoadProgress(1)}
        onShouldStartLoadWithRequest={(request) => {
          const url = request.url || '';
          if (
            url === 'about:blank'
            || url.startsWith('data:')
            || url.startsWith('blob:')
            || url.startsWith('file:')
          ) {
            return true;
          }

          if (/^https?:\/\//i.test(url)) {
            Linking.openURL(url).catch(onOpenExternal);
            return false;
          }

          return true;
        }}
      />
    </View>
  );
}

function MediaDocumentView({
  book,
  theme,
  onOpen,
}: {
  book: Book | null;
  theme: ReaderTheme;
  onOpen: () => void;
}) {
  const { t } = useLanguage();
  const ext = extensionFromPath(book?.file_name || book?.file_path || book?.external_url).toUpperCase() || 'DOC';
  const isPdf = ext === 'PDF';

  return (
    <View style={styles.mediaWrap}>
      <View style={[styles.mediaCard, { backgroundColor: theme.page }]}>
        <View style={[styles.mediaIcon, { backgroundColor: theme.panel }]}>
          <Text style={[styles.mediaIconText, { color: theme.accent }]}>{ext}</Text>
        </View>
        <Text variant="headlineSmall" style={[styles.mediaTitle, { color: theme.text }]} numberOfLines={2}>
          {book?.title || t('document')}
        </Text>
        <Text style={[styles.mediaText, { color: theme.muted }]}>
          {isPdf
            ? t('pdf_original_hint')
            : t('original_format_hint')}
        </Text>
        <Button mode="contained" icon="open-in-new" onPress={onOpen} style={styles.mediaButton}>
          {t('open_document')}
        </Button>
      </View>
    </View>
  );
}

function ReaderSettingsDialog({
  visible,
  theme,
  fontSize,
  appearance,
  onDismiss,
  onFontSizeChange,
  onAppearanceChange,
  showTextFallback,
  onUseTextFallback,
}: {
  visible: boolean;
  theme: ReaderTheme;
  fontSize: number;
  appearance: ReaderAppearance;
  onDismiss: () => void;
  onFontSizeChange: (delta: number) => void;
  onAppearanceChange: (updates: Partial<ReaderAppearance>) => void;
  showTextFallback?: boolean;
  onUseTextFallback?: () => void;
}) {
  const { t } = useLanguage();

  return (
    <Dialog visible={visible} onDismiss={onDismiss} style={styles.settingsDialog}>
      <Dialog.Title>{t('reader_settings')}</Dialog.Title>
      <Dialog.Content>
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>{t('text_size')}</Text>
          <View style={styles.stepper}>
            <IconButton icon="minus" onPress={() => onFontSizeChange(-1)} />
            <Text style={styles.stepperValue}>{fontSize}</Text>
            <IconButton icon="plus" onPress={() => onFontSizeChange(1)} />
          </View>
        </View>

        <Divider style={styles.divider} />

        <Text style={styles.settingLabel}>{t('font')}</Text>
        <View style={styles.optionGrid}>
          {FONT_PRESETS.map(font => (
            <Button
              key={font.id}
              mode={appearance.font_family === font.id ? 'contained' : 'outlined'}
              onPress={() => onAppearanceChange({ font_family: font.id })}
              style={styles.optionButton}
              textColor={appearance.font_family === font.id ? '#fff' : THEME.colors.text}
            >
              {t(font.labelKey)}
            </Button>
          ))}
        </View>

        <Text style={styles.settingLabel}>{t('theme')}</Text>
        <View style={styles.optionGrid}>
          {(Object.keys(READER_THEMES) as ThemeKey[]).map(themeKey => (
            <Button
              key={themeKey}
              mode={appearance.theme === themeKey ? 'contained' : 'outlined'}
              onPress={() => onAppearanceChange({ theme: themeKey })}
              style={styles.optionButton}
            >
              {t(READER_THEMES[themeKey].labelKey)}
            </Button>
          ))}
        </View>

        <Text style={styles.settingLabel}>{t('line_spacing')}</Text>
        <View style={styles.optionGrid}>
          {[1.45, 1.7, 1.95].map(value => (
            <Button
              key={value}
              mode={Math.abs(appearance.line_height - value) < 0.01 ? 'contained' : 'outlined'}
              onPress={() => onAppearanceChange({ line_height: value })}
              style={styles.optionButton}
            >
              {value === 1.45 ? t('line_compact') : value === 1.7 ? t('line_normal') : t('line_relaxed')}
            </Button>
          ))}
        </View>

        <Text style={styles.settingLabel}>{t('page_width')}</Text>
        <View style={styles.optionGrid}>
          {PAGE_WIDTHS.map(width => (
            <Button
              key={width.value}
              mode={(appearance.page_width || 760) === width.value ? 'contained' : 'outlined'}
              onPress={() => onAppearanceChange({ page_width: width.value })}
              style={styles.optionButton}
            >
              {t(width.labelKey)}
            </Button>
          ))}
        </View>

        <View style={[styles.preview, { backgroundColor: theme.page }]}>
          <Text style={{ color: theme.text, fontSize: 16 }}>
            {t('preview_text')}
          </Text>
        </View>

        {showTextFallback && onUseTextFallback ? (
          <Button mode="outlined" icon="format-text" onPress={onUseTextFallback} style={styles.fallbackButton}>
            {t('text_mode')}
          </Button>
        ) : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onDismiss}>{t('done')}</Button>
      </Dialog.Actions>
    </Dialog>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topbar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 4,
    paddingBottom: 6,
  },
  titleBlock: { flex: 1, minWidth: 0 },
  bookTitle: { fontSize: 16, fontWeight: '700' },
  bookMeta: { fontSize: 12, marginTop: 1 },
  progressTrack: { height: 3 },
  progressFill: { height: 3 },
  loadingBox: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  loadingText: { textAlign: 'center', fontSize: 16 },
  scroll: { flex: 1 },
  pageContent: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 16,
  },
  pageSheet: {
    width: '100%',
    alignSelf: 'center',
    borderRadius: 8,
    paddingHorizontal: 22,
    paddingVertical: 26,
    minHeight: '100%',
  },
  pageText: {
    letterSpacing: 0,
  },
  bottombar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 10,
    paddingTop: 6,
  },
  pageButton: {
    minWidth: 96,
    borderRadius: 18,
  },
  mediaWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 22,
  },
  mediaCard: {
    width: '100%',
    maxWidth: 520,
    borderRadius: 8,
    padding: 24,
    alignItems: 'center',
  },
  mediaIcon: {
    width: 78,
    height: 92,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 18,
  },
  mediaIconText: {
    fontWeight: '800',
    fontSize: 18,
    letterSpacing: 0,
  },
  mediaTitle: {
    fontWeight: '800',
    textAlign: 'center',
  },
  mediaText: {
    textAlign: 'center',
    lineHeight: 22,
    marginTop: 10,
  },
  mediaButton: {
    marginTop: 20,
    borderRadius: 8,
  },
  epubWrap: {
    flex: 1,
  },
  epubWebView: {
    flex: 1,
  },
  webProgressTrack: {
    height: 3,
  },
  webProgressFill: {
    height: 3,
  },
  settingsDialog: {
    borderRadius: 8,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  settingLabel: {
    fontWeight: '700',
    color: THEME.colors.text,
    marginTop: 12,
    marginBottom: 8,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F2F4F7',
    borderRadius: 8,
  },
  stepperValue: {
    minWidth: 28,
    textAlign: 'center',
    fontWeight: '800',
  },
  divider: { marginTop: 10 },
  optionGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    borderRadius: 8,
    marginBottom: 2,
  },
  preview: {
    borderRadius: 8,
    padding: 16,
    marginTop: 14,
  },
  fallbackButton: {
    marginTop: 14,
    borderRadius: 8,
  },
});

import { useEffect, useState, useCallback } from 'react';
import { View, ScrollView, StyleSheet, RefreshControl, Linking } from 'react-native';
import { Text, Button, Card, Chip, Searchbar, SegmentedButtons, ActivityIndicator, Snackbar, IconButton } from 'react-native-paper';
import { THEME } from '../../constants/theme';
import {
  OfficialBook,
  OfficialStats,
  attachCandidate,
  classifyOfficialBooks,
  getOfficialBooks,
  getOfficialCandidates,
  getOfficialStats,
  rejectCandidate,
  runOfficialFilter,
} from '../../services/bkApiService';

const STATUS_LABELS: Record<string, string> = {
  not_checked: 'Не проверено',
  not_available_online: 'Недоступно онлайн',
  official_link_found: 'Официальная ссылка',
  online_reader_found: 'Онлайн-чтение',
  flipbook_found: 'Flipbook',
  downloadable_file_found: 'Файл доступен',
  downloaded_official_file: 'Файл скачан',
  manual_uploaded: 'Загружено вручную',
  candidate_found: 'Нужно подтвердить',
  restricted_access: 'Доступ ограничен',
  match_rejected: 'Отклонено',
};

export default function OfficialBooksScreen() {
  const [stats, setStats] = useState<OfficialStats | null>(null);
  const [books, setBooks] = useState<OfficialBook[]>([]);
  const [query, setQuery] = useState('');
  const [mode, setMode] = useState('official');
  const [language, setLanguage] = useState('');
  const [status, setStatus] = useState('');
  const [courseNumber, setCourseNumber] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    const nextStats = await getOfficialStats();
    const nextBooks = mode === 'candidates'
      ? await getOfficialCandidates()
      : await getOfficialBooks({ language, status, courseNumber });
    setStats(nextStats);
    setBooks(nextBooks);
    setLoading(false);
  };

  useEffect(() => {
    load().catch((error) => {
      setMessage(error.message);
      setLoading(false);
    });
  }, [mode, language, status, courseNumber]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await load().catch((error) => setMessage(error.message));
    setRefreshing(false);
  }, [mode, language, status, courseNumber]);

  const filtered = books.filter((book) => {
    if (!query.trim()) return true;
    const text = [book.title, book.author, book.publisher, book.discipline, book.topic].join(' ').toLowerCase();
    return text.includes(query.trim().toLowerCase());
  });

  const handleRunFilter = async () => {
    setLoading(true);
    try {
      const result = await runOfficialFilter();
      setMessage(`Проверено: ${result.checkedBooks}, официально: ${result.officiallyAvailable}`);
      await load();
    } catch (error: any) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClassify = async () => {
    try {
      const result = await classifyOfficialBooks();
      setMessage(`Распределено: ${result.classified}, не распределено: ${result.unassigned}`);
      await load();
    } catch (error: any) {
      setMessage(error.message);
    }
  };

  const openUrl = (url?: string) => {
    if (url) Linking.openURL(url);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>Официальные электронные книги</Text>
        <Text style={styles.headerSub}>Только источники gov.kz, data.egov.kz и официальные ссылки</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Card style={styles.statsCard}>
          <View style={styles.statsGrid}>
            <Stat label="Каталог" value={stats?.totalBooks ?? 0} />
            <Stat label="Проверено" value={stats?.checkedBooks ?? 0} />
            <Stat label="Официально" value={stats?.officiallyAvailable ?? 0} />
            <Stat label="Кандидаты" value={stats?.candidatesFound ?? 0} />
          </View>
          <View style={styles.actions}>
            <Button mode="contained" onPress={handleRunFilter} compact>Проверить 100 книг</Button>
            <Button mode="outlined" onPress={handleClassify} compact>Распределить</Button>
          </View>
        </Card>

        <Searchbar placeholder="Поиск по официальным книгам" value={query} onChangeText={setQuery} style={styles.search} />

        <SegmentedButtons
          value={mode}
          onValueChange={setMode}
          buttons={[
            { value: 'official', label: 'Официальные' },
            { value: 'candidates', label: 'Кандидаты' },
          ]}
          style={styles.segment}
        />

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filters}>
          {['', '1', '2', '3'].map((value) => (
            <Chip key={`course-${value || 'all'}`} selected={courseNumber === value} onPress={() => setCourseNumber(value)} style={styles.chip}>
              {value ? `${value} курс` : 'Все курсы'}
            </Chip>
          ))}
          {['', 'kk', 'ru'].map((value) => (
            <Chip key={`lang-${value || 'all'}`} selected={language === value} onPress={() => setLanguage(value)} style={styles.chip}>
              {value || 'Все языки'}
            </Chip>
          ))}
          {['', 'online_reader_found', 'downloadable_file_found'].map((value) => (
            <Chip key={`status-${value || 'all'}`} selected={status === value} onPress={() => setStatus(value)} style={styles.chip}>
              {value ? STATUS_LABELS[value] : 'Все статусы'}
            </Chip>
          ))}
        </ScrollView>

        {loading ? (
          <ActivityIndicator style={{ marginTop: 40 }} />
        ) : filtered.length ? (
          filtered.map((book) => (
            <OfficialBookCard
              key={book.key}
              book={book}
              onOpen={openUrl}
              onAttach={async (candidateId) => {
                await attachCandidate(book, candidateId);
                await load();
              }}
              onReject={async (candidateId) => {
                await rejectCandidate(book, candidateId);
                await load();
              }}
            />
          ))
        ) : (
          <View style={styles.empty}>
            <IconButton icon="book-search-outline" size={56} iconColor="#aaa" />
            <Text style={styles.emptyText}>Книги не найдены</Text>
          </View>
        )}
      </ScrollView>

      <Snackbar visible={!!message} onDismiss={() => setMessage('')} duration={3500}>
        {message}
      </Snackbar>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function OfficialBookCard({
  book,
  onOpen,
  onAttach,
  onReject,
}: {
  book: OfficialBook;
  onOpen: (url?: string) => void;
  onAttach: (candidateId: string) => void;
  onReject: (candidateId: string) => void;
}) {
  const firstLink = book.externalLinks?.[0];
  const downloadLink = book.externalLinks?.find((link) => link.canDownload);

  return (
    <Card style={styles.bookCard}>
      <Card.Content>
        <Text variant="titleMedium" style={styles.bookTitle}>{book.title}</Text>
        <Text style={styles.meta}>{book.author || 'Автор не указан'} · {book.publisher || 'Издательство не указано'} · {book.year || 'б/г'}</Text>
        <View style={styles.badges}>
          <Chip compact>{STATUS_LABELS[book.contentStatus] || book.contentStatus}</Chip>
          {!!book.courseNumber && <Chip compact>{book.courseNumber} курс</Chip>}
          {!!book.discipline && <Chip compact>{book.discipline}</Chip>}
          {!!book.language && <Chip compact>{book.language}</Chip>}
        </View>
        {!!book.topic && <Text style={styles.topic}>Тема: {book.topic}</Text>}
        {!!book.matchConfidence && <Text style={styles.confidence}>Совпадение: {Math.round(book.matchConfidence * 100)}%</Text>}

        <View style={styles.actions}>
          {!!firstLink && <Button mode="contained-tonal" onPress={() => onOpen(firstLink.url)}>Читать онлайн</Button>}
          {!!downloadLink && <Button mode="contained" onPress={() => onOpen(downloadLink.url)}>Скачать</Button>}
        </View>

        {!!book.candidateLinks?.length && (
          <View style={styles.candidates}>
            {book.candidateLinks.map((candidate) => (
              <View key={candidate.id} style={styles.candidateRow}>
                <Text style={styles.candidateTitle}>{candidate.title}</Text>
                <View style={styles.actions}>
                  <Button mode="contained-tonal" compact onPress={() => onOpen(candidate.url)}>Открыть</Button>
                  <Button mode="contained" compact onPress={() => onAttach(candidate.id)}>Подтвердить</Button>
                  <Button mode="outlined" compact onPress={() => onReject(candidate.id)}>Отклонить</Button>
                </View>
              </View>
            ))}
          </View>
        )}
      </Card.Content>
    </Card>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { backgroundColor: THEME.colors.primary, padding: 18, paddingTop: 50, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 },
  headerTitle: { color: '#fff', fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.82)', marginTop: 4 },
  content: { padding: 16, paddingBottom: 40 },
  statsCard: { padding: 12, borderRadius: 16, backgroundColor: '#fff' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  stat: { width: '50%', padding: 8 },
  statValue: { fontSize: 24, fontWeight: 'bold', color: THEME.colors.primary },
  statLabel: { color: THEME.colors.textSecondary },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
  search: { marginTop: 14, backgroundColor: '#fff' },
  segment: { marginTop: 12 },
  filters: { marginTop: 12, marginBottom: 8 },
  chip: { marginRight: 8 },
  bookCard: { marginTop: 10, borderRadius: 14, backgroundColor: '#fff' },
  bookTitle: { fontWeight: 'bold' },
  meta: { color: THEME.colors.textSecondary, marginTop: 4, lineHeight: 19 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  topic: { marginTop: 10, color: THEME.colors.text },
  confidence: { marginTop: 4, color: THEME.colors.textSecondary, fontSize: 12 },
  candidates: { marginTop: 12, gap: 10 },
  candidateRow: { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 10 },
  candidateTitle: { fontWeight: '600' },
  empty: { alignItems: 'center', marginTop: 80 },
  emptyText: { color: THEME.colors.textSecondary },
});

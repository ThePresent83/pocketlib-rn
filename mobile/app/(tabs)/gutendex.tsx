import { useState } from 'react';
import { View, StyleSheet, ScrollView, Keyboard } from 'react-native';
import { Text, TextInput, Button, ActivityIndicator, Snackbar, Icon } from 'react-native-paper';
import { searchBooks, SearchResult } from '../../services/api';
import { addBook } from '../../services/bookService';
import { THEME } from '../../constants/theme';
import SearchResultCard from '../../components/SearchResultCard';

export default function GutendexScreen() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  const doSearch = async () => {
    const q = query.trim();
    if (!q) return;

    Keyboard.dismiss();
    setLoading(true);
    setHasSearched(true);
    
    try {
      const res = await searchBooks(q);
      setResults(res);
    } catch (e) {
      console.error(e);
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleAddBook = async (item: SearchResult) => {
    const newBook = await addBook({
      title: item.title,
      author: item.author,
      year: item.year,
      isbn: item.isbn,
      cover_url: item.cover_url,
      ol_key: item.ol_key,
      ia_id: item.ia_id,
      gutenberg_id: item.gutenberg_id,
      has_fulltext: item.has_fulltext,
      source: 'gutendex',
      is_downloaded: false,
    });

    if (newBook) {
      setSnackbarMsg(`✅ «${item.title.substring(0, 30)}» добавлена в библиотеку`);
    } else {
      setSnackbarMsg('Ошибка при добавлении книги');
    }
    setSnackbarVisible(true);
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>📖 Открытая литература</Text>
        <Text style={styles.headerSubtitle}>Поиск по базе Project Gutenberg (классика)</Text>
        <View style={styles.searchRow}>
          <TextInput
            placeholder="Название или автор (на англ.)..."
            value={query}
            onChangeText={setQuery}
            onSubmitEditing={doSearch}
            mode="outlined"
            style={styles.input}
            outlineStyle={styles.inputOutline}
            activeOutlineColor={THEME.colors.primary}
            dense
          />
          <Button
            mode="contained"
            onPress={doSearch}
            style={styles.searchBtn}
            buttonColor={THEME.colors.accent}
          >
            Найти
          </Button>
        </View>
      </View>

      {loading ? (
        <View style={styles.statusBox}>
          <ActivityIndicator size="large" color={THEME.colors.primary} />
        </View>
      ) : !hasSearched ? (
        <View style={styles.statusBox}>
          <Icon source="book-search" size={48} color="#999" />
          <Text style={styles.statusText}>Найдите мировую классику для своей коллекции</Text>
        </View>
      ) : results.length === 0 ? (
        <View style={styles.statusBox}>
          <Icon source="flask-empty-outline" size={48} color="#999" />
          <Text style={styles.statusText}>Ничего не найдено</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.resultsLayout}>
          {results.map((item, idx) => (
            <SearchResultCard
              key={`${item.ol_key}-${idx}`}
              item={item}
              onAdd={handleAddBook}
            />
          ))}
        </ScrollView>
      )}

      <Snackbar
        visible={snackbarVisible}
        onDismiss={() => setSnackbarVisible(false)}
        duration={3000}
      >
        {snackbarMsg}
      </Snackbar>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    backgroundColor: THEME.colors.primary,
    padding: 20,
    paddingBottom: 20,
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 4,
  },
  headerSubtitle: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
    marginBottom: 12,
  },
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  input: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.9)',
    height: 44,
  },
  inputOutline: {
    borderRadius: 22,
    borderWidth: 0,
  },
  searchBtn: {
    marginLeft: 10,
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
  },
  statusBox: {
    paddingTop: 40,
    alignItems: 'center',
    paddingHorizontal: 20,
  },
  statusText: {
    color: '#999',
    marginTop: 10,
    textAlign: 'center',
  },
  resultsLayout: {
    padding: 10,
    paddingBottom: 20,
  },
});

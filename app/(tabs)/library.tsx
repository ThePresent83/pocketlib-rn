import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Searchbar, IconButton, Portal, Modal, Button, List, Chip, Divider, Menu } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { THEME } from '../../constants/theme';
import { getAllBooks, Book, BookFilters } from '../../services/bookService';
import { getAllDisciplines, Discipline, getAllCategories, Category, EntityId } from '../../services/disciplineService';
import MaterialCard from '../../components/MaterialCard';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLocalizedDisciplineName } from '../../utils/localizedCatalog';
import { getFavoriteBookIds, toggleFavoriteBook } from '../../services/libraryUxService';

type SortMode = 'newest' | 'title' | 'author' | 'offline';

function isAvailableOnline(book: Book): boolean {
  return Boolean(book.has_file || book.external_url || book.has_fulltext);
}

function sortBooks(books: Book[], mode: SortMode): Book[] {
  const next = [...books];
  if (mode === 'title') {
    return next.sort((a, b) => a.title.localeCompare(b.title));
  }
  if (mode === 'author') {
    return next.sort((a, b) => (a.author || '').localeCompare(b.author || '') || a.title.localeCompare(b.title));
  }
  if (mode === 'offline') {
    return next.sort((a, b) => Number(b.is_downloaded) - Number(a.is_downloaded) || a.title.localeCompare(b.title));
  }
  return next;
}

export default function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { language, t } = useLanguage();
  
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [filterVisible, setFilterVisible] = useState(false);
  const [isOfflineOnly, setIsOfflineOnly] = useState(params.offline === 'true');
  const [selectedDiscipline, setSelectedDiscipline] = useState<EntityId | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<EntityId | null>(null);
  const [materialType, setMaterialType] = useState<string | null>(null);
  const [favoritesOnly, setFavoritesOnly] = useState(params.favorites === 'true');
  const [availableOnly, setAvailableOnly] = useState(params.available === 'true');
  const [sortMode, setSortMode] = useState<SortMode>('newest');
  const [sortMenuVisible, setSortMenuVisible] = useState(false);
  const [favoriteIds, setFavoriteIds] = useState<EntityId[]>([]);
  
  // Lists for filters
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadData = async () => {
    const filters: BookFilters = {
      searchQuery: query,
      isDownloaded: isOfflineOnly || undefined,
      disciplineId: selectedDiscipline || undefined,
      categoryId: selectedCategory || undefined,
      materialType: materialType || undefined
    };

    const nextFavoriteIds = await getFavoriteBookIds();
    setFavoriteIds(nextFavoriteIds);

    let res = await getAllBooks(filters);
    if (favoritesOnly) {
      res = res.filter(book => nextFavoriteIds.includes(book.id));
    }
    if (availableOnly) {
      res = res.filter(isAvailableOnline);
    }

    setBooks(sortBooks(res, sortMode));
    setLoading(false);
  };

  const loadFilterData = async () => {
    const d = await getAllDisciplines();
    const c = await getAllCategories();
    setDisciplines(d);
    setCategories(c);
  };

  useEffect(() => {
    loadData();
    loadFilterData();
  }, [query, isOfflineOnly, selectedDiscipline, selectedCategory, materialType, favoritesOnly, availableOnly, sortMode]);

  useEffect(() => {
    setIsOfflineOnly(params.offline === 'true');
    setFavoritesOnly(params.favorites === 'true');
    setAvailableOnly(params.available === 'true');
  }, [params.offline, params.favorites, params.available]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [query, isOfflineOnly, selectedDiscipline, selectedCategory, materialType, favoritesOnly, availableOnly, sortMode]);

  const resetFilters = () => {
    setIsOfflineOnly(false);
    setSelectedDiscipline(null);
    setSelectedCategory(null);
    setMaterialType(null);
    setFavoritesOnly(false);
    setAvailableOnly(false);
    setSortMode('newest');
    setFilterVisible(false);
  };

  const toggleFavorite = async (book: Book) => {
    const added = await toggleFavoriteBook(book.id);
    setFavoriteIds(current => added ? [book.id, ...current] : current.filter(id => id !== book.id));
    if (favoritesOnly && !added) {
      setBooks(current => current.filter(item => item.id !== book.id));
    }
  };

  const activeFilterCount = [isOfflineOnly, selectedDiscipline, selectedCategory, materialType, favoritesOnly, availableOnly, sortMode !== 'newest'].filter(Boolean).length;
  const typeLabels: Record<string, string> = {
    textbook: t('textbook'),
    lecture: t('lecture'),
    manual: t('manual'),
    practice: t('practice'),
  };
  const sortLabels: Record<SortMode, string> = {
    newest: t('sort_newest'),
    title: t('sort_title'),
    author: t('sort_author'),
    offline: t('sort_offline'),
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <Searchbar
            placeholder={t('search_materials')}
            onChangeText={setQuery}
            value={query}
            style={styles.searchbar}
            inputStyle={styles.searchInput}
          />
          <View style={styles.filterBtnWrap}>
            <Menu
              visible={sortMenuVisible}
              onDismiss={() => setSortMenuVisible(false)}
              anchor={
                <IconButton
                  icon="sort"
                  iconColor="#fff"
                  onPress={() => setSortMenuVisible(true)}
                  containerColor="rgba(255,255,255,0.22)"
                />
              }
            >
              {(['newest', 'title', 'author', 'offline'] as SortMode[]).map(mode => (
                <Menu.Item
                  key={mode}
                  title={sortLabels[mode]}
                  leadingIcon={sortMode === mode ? 'check' : undefined}
                  onPress={() => {
                    setSortMode(mode);
                    setSortMenuVisible(false);
                  }}
                />
              ))}
            </Menu>
            <IconButton 
              icon="filter-variant" 
              iconColor="#fff" 
              onPress={() => setFilterVisible(true)} 
              containerColor={THEME.colors.accent}
            />
            {activeFilterCount > 0 && <View style={styles.badge}><Text style={styles.badgeText}>{activeFilterCount}</Text></View>}
          </View>
        </View>
        
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
          <Chip style={styles.chip} selected={availableOnly} onPress={() => setAvailableOnly(!availableOnly)}>{t('available_online')}</Chip>
          <Chip style={styles.chip} selected={favoritesOnly} onPress={() => setFavoritesOnly(!favoritesOnly)}>{t('favorite_books')}</Chip>
          {isOfflineOnly && <Chip style={styles.chip} onClose={() => setIsOfflineOnly(false)}>{t('offline_only')}</Chip>}
          {selectedDiscipline && <Chip style={styles.chip} onClose={() => setSelectedDiscipline(null)}>{t('discipline')}</Chip>}
          {selectedCategory && <Chip style={styles.chip} onClose={() => setSelectedCategory(null)}>{t('category')}</Chip>}
          {materialType && <Chip style={styles.chip} onClose={() => setMaterialType(null)}>{typeLabels[materialType] || materialType}</Chip>}
          {sortMode !== 'newest' && <Chip style={styles.chip} onClose={() => setSortMode('newest')}>{sortLabels[sortMode]}</Chip>}
        </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        <Text style={styles.resultCount}>{books.length} {t('materials').toLowerCase()}</Text>
        {books.length > 0 ? (
          books.map(book => (
            <MaterialCard 
              key={book.id} 
              item={book} 
              isFavorite={favoriteIds.includes(book.id)}
              onToggleFavorite={toggleFavorite}
              onPress={(b) => router.push(`/book/${b.id}`)} 
            />
          ))
        ) : (
          <View style={styles.empty}>
            <IconButton icon="book-off-outline" size={64} iconColor="#ccc" />
            <Text variant="titleMedium" style={{ color: '#999' }}>{t('materials_not_found')}</Text>
            {activeFilterCount > 0 && (
              <Button mode="text" onPress={resetFilters}>{t('reset_filters')}</Button>
            )}
          </View>
        )}
      </ScrollView>

      <Portal>
        <Modal 
          visible={filterVisible} 
          onDismiss={() => setFilterVisible(false)} 
          contentContainerStyle={styles.modal}
        >
          <Text variant="titleLarge" style={styles.modalTitle}>{t('filters')}</Text>
          <Divider style={{ marginBottom: 16 }} />
          
          <ScrollView style={{ maxHeight: 400 }}>
            <List.Item
              title={t('offline_only')}
              right={() => <IconButton icon={isOfflineOnly ? "checkbox-marked" : "checkbox-blank-outline"} onPress={() => setIsOfflineOnly(!isOfflineOnly)} />}
            />

            <List.Item
              title={t('available_online')}
              right={() => <IconButton icon={availableOnly ? "checkbox-marked" : "checkbox-blank-outline"} onPress={() => setAvailableOnly(!availableOnly)} />}
            />

            <List.Item
              title={t('favorite_books')}
              right={() => <IconButton icon={favoritesOnly ? "checkbox-marked" : "checkbox-blank-outline"} onPress={() => setFavoritesOnly(!favoritesOnly)} />}
            />
            
            <List.Accordion title={t('discipline')} left={props => <List.Icon {...props} icon="book-education" />}>
              <List.Item title={t('all_disciplines')} onPress={() => setSelectedDiscipline(null)} style={!selectedDiscipline ? styles.selected : null} />
              {disciplines.map(d => (
                <List.Item 
                  key={d.id} 
                  title={getLocalizedDisciplineName(d, language)} 
                  onPress={() => setSelectedDiscipline(d.id)}
                  style={selectedDiscipline === d.id ? styles.selected : null}
                />
              ))}
            </List.Accordion>

            <List.Accordion title={t('category')} left={props => <List.Icon {...props} icon="tag-outline" />}>
              <List.Item title={t('all_categories')} onPress={() => setSelectedCategory(null)} style={!selectedCategory ? styles.selected : null} />
              {categories.map(c => (
                <List.Item 
                  key={c.id} 
                  title={c.name} 
                  onPress={() => setSelectedCategory(c.id)}
                  style={selectedCategory === c.id ? styles.selected : null}
                />
              ))}
            </List.Accordion>

            <List.Accordion title={t('material_types')} left={props => <List.Icon {...props} icon="file-document-outline" />}>
              <List.Item title={t('all_types')} onPress={() => setMaterialType(null)} />
              {['textbook', 'lecture', 'manual', 'practice'].map(type => (
                <List.Item key={type} title={typeLabels[type] || type} onPress={() => setMaterialType(type)} style={materialType === type ? styles.selected : null} />
              ))}
            </List.Accordion>

            <List.Accordion title={t('sort')} left={props => <List.Icon {...props} icon="sort" />}>
              {(['newest', 'title', 'author', 'offline'] as SortMode[]).map(mode => (
                <List.Item
                  key={mode}
                  title={sortLabels[mode]}
                  onPress={() => setSortMode(mode)}
                  style={sortMode === mode ? styles.selected : null}
                />
              ))}
            </List.Accordion>
          </ScrollView>

          <View style={styles.modalActions}>
            <Button mode="text" onPress={resetFilters}>{t('reset')}</Button>
            <Button mode="contained" onPress={() => setFilterVisible(false)}>{t('apply')}</Button>
          </View>
        </Modal>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  header: { 
    backgroundColor: THEME.colors.primary, 
    padding: 16, 
    paddingTop: 50,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  searchRow: { flexDirection: 'row', alignItems: 'center' },
  searchbar: { flex: 1, borderRadius: 24, height: 48, backgroundColor: 'rgba(255,255,255,0.9)' },
  searchInput: { minHeight: 48 },
  filterBtnWrap: { marginLeft: 8, position: 'relative' },
  badge: { 
    position: 'absolute', 
    top: 0, 
    right: 0, 
    backgroundColor: '#fff', 
    width: 18, 
    height: 18, 
    borderRadius: 9, 
    justifyContent: 'center', 
    alignItems: 'center',
    elevation: 2
  },
  badgeText: { fontSize: 10, fontWeight: 'bold', color: THEME.colors.primary },
  chips: { flexDirection: 'row', marginTop: 12 },
  chip: { marginRight: 8, backgroundColor: 'rgba(255,255,255,0.2)' },
  list: { padding: 16, paddingBottom: 40 },
  resultCount: { color: THEME.colors.textSecondary, marginBottom: 10, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  modal: { backgroundColor: 'white', padding: 24, margin: 20, borderRadius: 16 },
  modalTitle: { fontWeight: 'bold', marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24, gap: 8 },
  selected: { backgroundColor: '#f0f0f0' }
});

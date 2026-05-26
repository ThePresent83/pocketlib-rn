import { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { Text, Searchbar, IconButton, Portal, Modal, Button, List, Chip, Divider } from 'react-native-paper';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { THEME } from '../../constants/theme';
import { getAllBooks, Book, BookFilters } from '../../services/bookService';
import { getAllDisciplines, Discipline, getAllCategories, Category } from '../../services/disciplineService';
import MaterialCard from '../../components/MaterialCard';

export default function LibraryScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  
  const [query, setQuery] = useState('');
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  
  // Filters
  const [filterVisible, setFilterVisible] = useState(false);
  const [isOfflineOnly, setIsOfflineOnly] = useState(params.offline === 'true');
  const [selectedDiscipline, setSelectedDiscipline] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [materialType, setMaterialType] = useState<string | null>(null);
  
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

    const res = await getAllBooks(filters);
    setBooks(res);
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
  }, [query, isOfflineOnly, selectedDiscipline, selectedCategory, materialType]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [query, isOfflineOnly, selectedDiscipline, selectedCategory, materialType]);

  const resetFilters = () => {
    setIsOfflineOnly(false);
    setSelectedDiscipline(null);
    setSelectedCategory(null);
    setMaterialType(null);
    setFilterVisible(false);
  };

  const activeFilterCount = [isOfflineOnly, selectedDiscipline, selectedCategory, materialType].filter(Boolean).length;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.searchRow}>
          <Searchbar
            placeholder="Поиск материалов..."
            onChangeText={setQuery}
            value={query}
            style={styles.searchbar}
            inputStyle={styles.searchInput}
          />
          <View style={styles.filterBtnWrap}>
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
          {isOfflineOnly && <Chip style={styles.chip} onClose={() => setIsOfflineOnly(false)}>Только офлайн</Chip>}
          {selectedDiscipline && <Chip style={styles.chip} onClose={() => setSelectedDiscipline(null)}>Дисциплина</Chip>}
          {materialType && <Chip style={styles.chip} onClose={() => setMaterialType(null)}>{materialType}</Chip>}
        </ScrollView>
      </View>

      <ScrollView 
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {books.length > 0 ? (
          books.map(book => (
            <MaterialCard 
              key={book.id} 
              item={book} 
              onPress={(b) => router.push(`/book/${b.id}`)} 
            />
          ))
        ) : (
          <View style={styles.empty}>
            <IconButton icon="book-off-outline" size={64} iconColor="#ccc" />
            <Text variant="titleMedium" style={{ color: '#999' }}>Материалы не найдены</Text>
            {activeFilterCount > 0 && (
              <Button mode="text" onPress={resetFilters}>Сбросить фильтры</Button>
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
          <Text variant="titleLarge" style={styles.modalTitle}>Фильтры</Text>
          <Divider style={{ marginBottom: 16 }} />
          
          <ScrollView style={{ maxHeight: 400 }}>
            <List.Item
              title="Только офлайн"
              right={() => <IconButton icon={isOfflineOnly ? "checkbox-marked" : "checkbox-blank-outline"} onPress={() => setIsOfflineOnly(!isOfflineOnly)} />}
            />
            
            <List.Accordion title="Дисциплина" left={props => <List.Icon {...props} icon="book-education" />}>
              <List.Item title="Все дисциплины" onPress={() => setSelectedDiscipline(null)} style={!selectedDiscipline ? styles.selected : null} />
              {disciplines.map(d => (
                <List.Item 
                  key={d.id} 
                  title={d.name} 
                  onPress={() => setSelectedDiscipline(d.id)}
                  style={selectedDiscipline === d.id ? styles.selected : null}
                />
              ))}
            </List.Accordion>

            <List.Accordion title="Категория" left={props => <List.Icon {...props} icon="tag-outline" />}>
              <List.Item title="Все категории" onPress={() => setSelectedCategory(null)} style={!selectedCategory ? styles.selected : null} />
              {categories.map(c => (
                <List.Item 
                  key={c.id} 
                  title={c.name} 
                  onPress={() => setSelectedCategory(c.id)}
                  style={selectedCategory === c.id ? styles.selected : null}
                />
              ))}
            </List.Accordion>

            <List.Accordion title="Тип материала" left={props => <List.Icon {...props} icon="file-document-outline" />}>
              <List.Item title="Все типы" onPress={() => setMaterialType(null)} />
              {['textbook', 'lecture', 'manual', 'practice'].map(t => (
                <List.Item key={t} title={t} onPress={() => setMaterialType(t)} style={materialType === t ? styles.selected : null} />
              ))}
            </List.Accordion>
          </ScrollView>

          <View style={styles.modalActions}>
            <Button mode="text" onPress={resetFilters}>Сбросить</Button>
            <Button mode="contained" onPress={() => setFilterVisible(false)}>Применить</Button>
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
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 100 },
  modal: { backgroundColor: 'white', padding: 24, margin: 20, borderRadius: 16 },
  modalTitle: { fontWeight: 'bold', marginBottom: 12 },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 24, gap: 8 },
  selected: { backgroundColor: '#f0f0f0' }
});

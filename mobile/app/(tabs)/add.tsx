import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Portal, Dialog, List, IconButton, SegmentedButtons } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system';
import { useRouter } from 'expo-router';
import { THEME } from '../../constants/theme';
import { addBook } from '../../services/bookService';
import { getAllDisciplines, Discipline, getAllCategories, Category } from '../../services/disciplineService';
import { useAuth } from '../../contexts/AuthContext';

export default function AddMaterialScreen() {
  const router = useRouter();
  const { user } = useAuth();
  
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [materialType, setMaterialType] = useState('textbook');
  const [language, setLanguage] = useState('ru');
  const [semester, setSemester] = useState('1');
  
  const [selectedFile, setSelectedFile] = useState<{ uri: string, name: string, size?: number } | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [selectedDiscipline, setSelectedDiscipline] = useState<Discipline | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  const [discDialogVisible, setDiscDialogVisible] = useState(false);
  const [catDialogVisible, setCatDialogVisible] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const d = await getAllDisciplines();
    const c = await getAllCategories();
    setDisciplines(d);
    setCategories(c);
  };

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'application/epub+zip'],
        copyToCacheDirectory: true
      });

      if (!result.canceled) {
        const file = result.assets[0];
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          size: file.size
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!title || !selectedFile) {
      Alert.alert('Ошибка', 'Введите название и выберите файл');
      return;
    }

    setLoading(true);
    try {
      // 1. Создаем папку если её нет
      const dir = `${FileSystem.documentDirectory}materials/`;
      const dirInfo = await FileSystem.getInfoAsync(dir);
      if (!dirInfo.exists) {
        await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
      }

      // 2. Копируем файл
      const fileName = `${Date.now()}_${selectedFile.name}`;
      const destination = `${dir}${fileName}`;
      await FileSystem.copyAsync({
        from: selectedFile.uri,
        to: destination
      });

      // 3. Сохраняем в БД
      await addBook({
        title,
        author: author || user?.full_name,
        description,
        material_type: materialType,
        language,
        semester: parseInt(semester),
        file_path: destination,
        is_downloaded: true,
        source: 'local',
        discipline_id: selectedDiscipline?.id,
        category_id: selectedCategory?.id,
        uploaded_by: user?.id,
        has_fulltext: true
      });

      Alert.alert('Успех', 'Материал успешно добавлен в библиотеку', [
        { text: 'OK', onPress: () => router.replace('/(tabs)/library') }
      ]);
    } catch (e) {
      console.error(e);
      Alert.alert('Ошибка', 'Не удалось сохранить материал');
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === 'student') {
    return (
      <View style={styles.center}>
        <Text>У вас нет прав для добавления материалов.</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.header}>Добавить учебный материал</Text>
      
      <TextInput
        label="Название *"
        value={title}
        onChangeText={setTitle}
        mode="outlined"
        style={styles.input}
      />
      
      <TextInput
        label="Автор / Преподаватель"
        value={author}
        onChangeText={setAuthor}
        mode="outlined"
        style={styles.input}
        placeholder={user?.full_name}
      />

      <TextInput
        label="Описание"
        value={description}
        onChangeText={setDescription}
        mode="outlined"
        multiline
        numberOfLines={3}
        style={styles.input}
      />

      <Text style={styles.label}>Тип материала</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segmentScroll}>
        <SegmentedButtons
          value={materialType}
          onValueChange={setMaterialType}
          buttons={[
            { value: 'textbook', label: 'Учебник' },
            { value: 'lecture', label: 'Лекция' },
            { value: 'manual', label: 'Методичка' },
            { value: 'practice', label: 'Практика' },
          ]}
        />
      </ScrollView>

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.label}>Язык</Text>
          <SegmentedButtons
            value={language}
            onValueChange={setLanguage}
            buttons={[
              { value: 'ru', label: 'RU' },
              { value: 'kk', label: 'KZ' },
              { value: 'en', label: 'EN' },
            ]}
          />
        </View>
        <View style={{ width: 100 }}>
          <Text style={styles.label}>Семестр</Text>
          <TextInput
            value={semester}
            onChangeText={setSemester}
            keyboardType="numeric"
            mode="outlined"
            dense
          />
        </View>
      </View>

      <List.Item
        title="Дисциплина"
        description={selectedDiscipline ? selectedDiscipline.name : 'Выберите дисциплину'}
        left={props => <List.Icon {...props} icon="book-education" />}
        onPress={() => setDiscDialogVisible(true)}
        style={styles.selector}
      />

      <List.Item
        title="Категория"
        description={selectedCategory ? selectedCategory.name : 'Выберите категорию'}
        left={props => <List.Icon {...props} icon="tag-outline" />}
        onPress={() => setCatDialogVisible(true)}
        style={styles.selector}
      />

      <View style={styles.fileBox}>
        {selectedFile ? (
          <View style={styles.fileInfo}>
            <Icon source="file-check" size={24} color={THEME.colors.success} />
            <Text style={styles.fileName} numberOfLines={1}>{selectedFile.name}</Text>
            <IconButton icon="close" size={20} onPress={() => setSelectedFile(null)} />
          </View>
        ) : (
          <Button mode="outlined" icon="file-upload" onPress={pickDocument}>
            Выбрать файл (PDF, TXT)
          </Button>
        )}
      </View>

      <Button 
        mode="contained" 
        onPress={handleSave} 
        loading={loading}
        disabled={loading}
        style={styles.saveBtn}
      >
        Сохранить в библиотеку
      </Button>

      {/* Dialogs */}
      <Portal>
        <Dialog visible={discDialogVisible} onDismiss={() => setDiscDialogVisible(false)}>
          <Dialog.Title>Выберите дисциплину</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 300 }}>
            <ScrollView>
              {disciplines.map(d => (
                <List.Item
                  key={d.id}
                  title={d.name}
                  onPress={() => {
                    setSelectedDiscipline(d);
                    setDiscDialogVisible(false);
                  }}
                />
              ))}
              {disciplines.length === 0 && <Text style={{ padding: 20 }}>Справочник пуст</Text>}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>

        <Dialog visible={catDialogVisible} onDismiss={() => setCatDialogVisible(false)}>
          <Dialog.Title>Выберите категорию</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 300 }}>
            <ScrollView>
              {categories.map(c => (
                <List.Item
                  key={c.id}
                  title={c.name}
                  onPress={() => {
                    setSelectedCategory(c);
                    setCatDialogVisible(false);
                  }}
                />
              ))}
              {categories.length === 0 && <Text style={{ padding: 20 }}>Справочник пуст</Text>}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>
      </Portal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  content: { padding: 20, paddingBottom: 40 },
  header: { marginBottom: 20, fontWeight: 'bold', color: THEME.colors.primary },
  input: { marginBottom: 16, backgroundColor: '#fff' },
  label: { fontSize: 12, color: THEME.colors.textSecondary, marginBottom: 8, marginTop: 4 },
  row: { flexDirection: 'row', marginBottom: 16, alignItems: 'flex-end' },
  segmentScroll: { marginBottom: 16 },
  selector: { backgroundColor: '#fff', borderRadius: 8, marginBottom: 12, elevation: 1 },
  fileBox: { marginVertical: 20, padding: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: '#ccc', borderRadius: 8, alignItems: 'center' },
  fileInfo: { flexDirection: 'row', alignItems: 'center', width: '100%' },
  fileName: { flex: 1, marginLeft: 8, fontSize: 14 },
  saveBtn: { paddingVertical: 6, borderRadius: 28 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' }
});

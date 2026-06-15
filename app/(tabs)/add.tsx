import { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Alert } from 'react-native';
import { Text, TextInput, Button, Portal, Dialog, List, Icon, IconButton, SegmentedButtons } from 'react-native-paper';
import * as DocumentPicker from 'expo-document-picker';
import { useRouter } from 'expo-router';
import { THEME } from '../../constants/theme';
import { addBook, deleteBook, uploadBookFile, Book } from '../../services/bookService';
import { getAllDisciplines, Discipline, getAllCategories, Category, Course, getCoursesForDiscipline } from '../../services/disciplineService';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { getLocalizedCourseName, getLocalizedDisciplineName } from '../../utils/localizedCatalog';

function getFileExtension(fileName: string): string {
  return fileName.split('?')[0].split('.').pop()?.toLowerCase() || '';
}

function isSupportedDocument(fileName: string): boolean {
  return ['pdf', 'txt', 'epub'].includes(getFileExtension(fileName));
}

function canReadInside(fileName: string): boolean {
  return ['txt', 'epub'].includes(getFileExtension(fileName));
}

export default function AddMaterialScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { language: appLanguage, t } = useLanguage();
  
  const [title, setTitle] = useState('');
  const [author, setAuthor] = useState('');
  const [description, setDescription] = useState('');
  const [materialType, setMaterialType] = useState('textbook');
  const [materialLanguage, setMaterialLanguage] = useState('ru');
  const [semester, setSemester] = useState('1');
  
  const [selectedFile, setSelectedFile] = useState<{ uri: string, name: string, size?: number, mimeType?: string, webFile?: any } | null>(null);
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  
  const [selectedDiscipline, setSelectedDiscipline] = useState<Discipline | null>(null);
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  
  const [discDialogVisible, setDiscDialogVisible] = useState(false);
  const [courseDialogVisible, setCourseDialogVisible] = useState(false);
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

  useEffect(() => {
    if (!selectedDiscipline) {
      setCourses([]);
      setSelectedCourse(null);
      return;
    }

    getCoursesForDiscipline(selectedDiscipline.id)
      .then((nextCourses) => {
        setCourses(nextCourses);
        setSelectedCourse((current) =>
          current && nextCourses.some(course => course.id === current.id) ? current : null
        );
      })
      .catch(() => setCourses([]));
  }, [selectedDiscipline]);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'text/plain', 'application/epub+zip', 'application/epub'],
        copyToCacheDirectory: true
      });

      if (!result.canceled) {
        const file = result.assets[0];
        if (!isSupportedDocument(file.name)) {
          Alert.alert(t('unsupported_format'), t('choose_supported_file'));
          return;
        }
        setSelectedFile({
          uri: file.uri,
          name: file.name,
          size: file.size,
          mimeType: file.mimeType,
          webFile: (file as any).file
        });
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSave = async () => {
    if (!title || !selectedFile) {
      Alert.alert(t('error'), t('fill_title_file'));
      return;
    }

    setLoading(true);
    let createdBook: Book | null = null;
    try {
      createdBook = await addBook({
        title,
        author: author || user?.full_name,
        description,
        material_type: materialType,
        language: materialLanguage,
        semester: parseInt(semester),
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        content_type: selectedFile.mimeType,
        is_downloaded: false,
        source: 'api',
        discipline_id: selectedDiscipline?.id,
        course_id: selectedCourse?.id,
        category_id: selectedCategory?.id,
        uploaded_by: user?.id,
        has_fulltext: canReadInside(selectedFile.name)
      });

      if (!createdBook) throw new Error('Book was not created');
      const uploadedBook = await uploadBookFile(createdBook.id, selectedFile);
      if (!uploadedBook?.has_file) throw new Error('Book file was not uploaded');

      Alert.alert(t('success'), t('saved_material'), [
        { text: 'OK', onPress: () => router.replace(`/book/${uploadedBook.id}`) }
      ]);
    } catch (e) {
      console.error(e);
      if (createdBook?.id) {
        try {
          await deleteBook(createdBook.id);
        } catch (cleanupError) {
          console.warn('Could not remove book after failed upload:', cleanupError);
        }
      }
      Alert.alert(t('error'), t('save_failed'));
    } finally {
      setLoading(false);
    }
  };

  if (user?.role === 'student') {
    return (
      <View style={styles.center}>
        <Text>{t('no_add_rights')}</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Text variant="headlineSmall" style={styles.header}>{t('add_material')}</Text>
      
      <TextInput
        label={t('title_required')}
        value={title}
        onChangeText={setTitle}
        mode="outlined"
        style={styles.input}
      />
      
      <TextInput
        label={t('author_teacher')}
        value={author}
        onChangeText={setAuthor}
        mode="outlined"
        style={styles.input}
        placeholder={user?.full_name}
      />

      <TextInput
        label={t('description')}
        value={description}
        onChangeText={setDescription}
        mode="outlined"
        multiline
        numberOfLines={3}
        style={styles.input}
      />

      <Text style={styles.label}>{t('material_type')}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.segmentScroll}>
        <SegmentedButtons
          value={materialType}
          onValueChange={setMaterialType}
          buttons={[
            { value: 'textbook', label: t('textbook') },
            { value: 'lecture', label: t('lecture') },
            { value: 'manual', label: t('manual') },
            { value: 'practice', label: t('practice') },
          ]}
        />
      </ScrollView>

      <View style={styles.row}>
        <View style={{ flex: 1, marginRight: 8 }}>
          <Text style={styles.label}>{t('language_short')}</Text>
          <SegmentedButtons
            value={materialLanguage}
            onValueChange={setMaterialLanguage}
            buttons={[
              { value: 'ru', label: 'RU' },
              { value: 'kk', label: 'KZ' },
              { value: 'en', label: 'EN' },
            ]}
          />
        </View>
        <View style={{ width: 100 }}>
          <Text style={styles.label}>{t('semester')}</Text>
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
        title={t('discipline')}
        description={selectedDiscipline ? getLocalizedDisciplineName(selectedDiscipline, appLanguage) : t('choose_discipline')}
        left={props => <List.Icon {...props} icon="book-education" />}
        onPress={() => setDiscDialogVisible(true)}
        style={styles.selector}
      />

      <List.Item
        title={t('course')}
        description={selectedCourse
          ? `${selectedCourse.year} ${t('course')} · ${getLocalizedCourseName(selectedCourse, appLanguage)}`
          : selectedDiscipline ? t('choose_course') : t('choose_discipline_first')}
        left={props => <List.Icon {...props} icon="school-outline" />}
        onPress={() => selectedDiscipline && setCourseDialogVisible(true)}
        style={styles.selector}
      />

      <List.Item
        title={t('category')}
        description={selectedCategory ? selectedCategory.name : t('choose_category')}
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
            {t('choose_file')}
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
        {t('save')}
      </Button>

      {/* Dialogs */}
      <Portal>
        <Dialog visible={discDialogVisible} onDismiss={() => setDiscDialogVisible(false)}>
          <Dialog.Title>{t('choose_discipline')}</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 300 }}>
            <ScrollView>
              {disciplines.map(d => (
                <List.Item
                  key={d.id}
                  title={getLocalizedDisciplineName(d, appLanguage)}
                  onPress={() => {
                    setSelectedDiscipline(d);
                    setSelectedCourse(null);
                    setDiscDialogVisible(false);
                  }}
                />
              ))}
              {disciplines.length === 0 && <Text style={{ padding: 20 }}>{t('empty_catalog')}</Text>}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>

        <Dialog visible={courseDialogVisible} onDismiss={() => setCourseDialogVisible(false)}>
          <Dialog.Title>{t('choose_course')}</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 300 }}>
            <ScrollView>
              {courses.map(course => (
                <List.Item
                  key={course.id}
                  title={`${course.year} ${t('course')} · ${getLocalizedCourseName(course, appLanguage)}`}
                  onPress={() => {
                    setSelectedCourse(course);
                    setCourseDialogVisible(false);
                  }}
                />
              ))}
              {courses.length === 0 && <Text style={{ padding: 20 }}>{t('no_courses_for_discipline')}</Text>}
            </ScrollView>
          </Dialog.ScrollArea>
        </Dialog>

        <Dialog visible={catDialogVisible} onDismiss={() => setCatDialogVisible(false)}>
          <Dialog.Title>{t('choose_category')}</Dialog.Title>
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
              {categories.length === 0 && <Text style={{ padding: 20 }}>{t('empty_catalog')}</Text>}
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

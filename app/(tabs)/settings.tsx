import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { Button, Card, Dialog, IconButton, List, Portal, SegmentedButtons, Snackbar, Text, TextInput } from 'react-native-paper';
import {
  Course,
  CourseWithDiscipline,
  Discipline,
  EntityId,
  StudentGroup,
  addCourse,
  addDiscipline,
  addGroup,
  deleteCourse,
  deleteDiscipline,
  deleteGroup,
  getAllCoursesWithDisciplines,
  getAllDisciplines,
  getAllGroups,
  getCoursesForDiscipline,
} from '../../services/disciplineService';
import { useAuth } from '../../contexts/AuthContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { THEME, PALETTE } from '../../constants/theme';
import {
  formatStudentGroupDescription,
  getLocalizedCourseName,
  getLocalizedDisciplineName,
} from '../../utils/localizedCatalog';

export default function SettingsScreen() {
  const { user } = useAuth();
  const { language, t } = useLanguage();
  const canManageCatalog = user?.role === 'admin' || user?.role === 'teacher';
  const canManageGroups = user?.role === 'admin';

  const [tab, setTab] = useState('disciplines');
  const [disciplines, setDisciplines] = useState<{ disc: Discipline; courses: Course[] }[]>([]);
  const [allCourses, setAllCourses] = useState<CourseWithDiscipline[]>([]);
  const [groups, setGroups] = useState<StudentGroup[]>([]);

  const [discDialogVisible, setDiscDialogVisible] = useState(false);
  const [newDiscName, setNewDiscName] = useState('');
  const [newDiscCode, setNewDiscCode] = useState('');
  const [newDiscNameKk, setNewDiscNameKk] = useState('');
  const [newDiscNameEn, setNewDiscNameEn] = useState('');

  const [courseDialogVisible, setCourseDialogVisible] = useState(false);
  const [targetDiscId, setTargetDiscId] = useState<EntityId | null>(null);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseCode, setNewCourseCode] = useState('');
  const [newCourseNameKk, setNewCourseNameKk] = useState('');
  const [newCourseNameEn, setNewCourseNameEn] = useState('');
  const [newCourseYear, setNewCourseYear] = useState('');

  const [groupDialogVisible, setGroupDialogVisible] = useState(false);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupAdmissionYear, setNewGroupAdmissionYear] = useState('');
  const [targetCourseId, setTargetCourseId] = useState<EntityId | null>(null);

  const [snackbarMsg, setSnackbarMsg] = useState('');

  const loadData = async () => {
    const dList = await getAllDisciplines();
    const nextDisciplines = [];
    for (const d of dList) {
      const courses = await getCoursesForDiscipline(d.id);
      nextDisciplines.push({ disc: d, courses });
    }
    setDisciplines(nextDisciplines);
    setAllCourses(await getAllCoursesWithDisciplines());
    setGroups(await getAllGroups());
  };

  useFocusEffect(
    useCallback(() => {
      if (canManageCatalog) loadData();
    }, [canManageCatalog])
  );

  if (!canManageCatalog) {
    return (
      <View style={styles.center}>
        <Text>{t('catalog_access_denied')}</Text>
      </View>
    );
  }

  const showMessage = (message: string) => setSnackbarMsg(message);

  const handleAddDiscipline = async () => {
    const name = newDiscName.trim();
    if (!name) return;

    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    await addDiscipline(name, color, {
      code: newDiscCode.trim() || undefined,
      name_kk: newDiscNameKk.trim() || undefined,
      name_en: newDiscNameEn.trim() || undefined,
    });
    setDiscDialogVisible(false);
    setNewDiscName('');
    setNewDiscCode('');
    setNewDiscNameKk('');
    setNewDiscNameEn('');
    showMessage(`${t('discipline_added')}: ${name}`);
    await loadData();
  };

  const handleAddCourse = async () => {
    const name = newCourseName.trim();
    const year = parseInt(newCourseYear.trim(), 10);

    if (!name || isNaN(year) || year < 1 || year > 6 || !targetDiscId) {
      showMessage(t('course_year_invalid'));
      return;
    }

    await addCourse(name, year, targetDiscId, {
      code: newCourseCode.trim() || undefined,
      name_kk: newCourseNameKk.trim() || undefined,
      name_en: newCourseNameEn.trim() || undefined,
    });
    setCourseDialogVisible(false);
    setNewCourseName('');
    setNewCourseCode('');
    setNewCourseNameKk('');
    setNewCourseNameEn('');
    setNewCourseYear('');
    showMessage(t('course_added'));
    await loadData();
  };

  const handleAddGroup = async () => {
    const name = newGroupName.trim();
    if (!name || !targetCourseId) {
      showMessage(t('group_required'));
      return;
    }

    try {
      const admissionYear = parseInt(newGroupAdmissionYear.trim(), 10);
      await addGroup(name, targetCourseId, Number.isFinite(admissionYear) ? admissionYear : undefined);
      setGroupDialogVisible(false);
      setNewGroupName('');
      setNewGroupAdmissionYear('');
      setTargetCourseId(null);
      showMessage(`${t('group_added')}: ${name}`);
      await loadData();
    } catch {
      showMessage(t('group_add_failed'));
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>{t('settings')}</Text>
        <Text style={styles.headerSub}>{t('catalog_subtitle')}</Text>
      </View>

      <View style={styles.tabWrap}>
        <SegmentedButtons
          value={tab}
          onValueChange={setTab}
          buttons={[
            { value: 'disciplines', label: t('disciplines') },
            { value: 'groups', label: t('group'), disabled: !canManageGroups },
          ]}
        />
      </View>

      {tab === 'disciplines' ? (
        <DisciplineSection
          disciplines={disciplines}
          language={language}
          t={t}
          onAddDiscipline={() => setDiscDialogVisible(true)}
          onAddCourse={(disciplineId) => {
            setTargetDiscId(disciplineId);
            setCourseDialogVisible(true);
          }}
          onDeleteDiscipline={async (id) => {
            await deleteDiscipline(id);
            await loadData();
          }}
          onDeleteCourse={async (id) => {
            await deleteCourse(id);
            await loadData();
          }}
        />
      ) : (
        <GroupSection
          groups={groups}
          language={language}
          t={t}
          onAddGroup={() => setGroupDialogVisible(true)}
          onDeleteGroup={async (id) => {
            await deleteGroup(id);
            await loadData();
          }}
        />
      )}

      <Portal>
        <Dialog visible={discDialogVisible} onDismiss={() => setDiscDialogVisible(false)}>
          <Dialog.Title>{t('new_discipline')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={t('discipline_name')}
              value={newDiscName}
              onChangeText={setNewDiscName}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label={t('code_optional')}
              value={newDiscCode}
              onChangeText={setNewDiscCode}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label={t('name_kk')}
              value={newDiscNameKk}
              onChangeText={setNewDiscNameKk}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label={t('name_en')}
              value={newDiscNameEn}
              onChangeText={setNewDiscNameEn}
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDiscDialogVisible(false)}>{t('cancel')}</Button>
            <Button onPress={handleAddDiscipline}>{t('add')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={courseDialogVisible} onDismiss={() => setCourseDialogVisible(false)}>
          <Dialog.Title>{t('add_course')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={t('course_name')}
              value={newCourseName}
              onChangeText={setNewCourseName}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label={t('code_optional')}
              value={newCourseCode}
              onChangeText={setNewCourseCode}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label={t('name_kk')}
              value={newCourseNameKk}
              onChangeText={setNewCourseNameKk}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label={t('name_en')}
              value={newCourseNameEn}
              onChangeText={setNewCourseNameEn}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label={t('course_year_1_6')}
              value={newCourseYear}
              onChangeText={setNewCourseYear}
              keyboardType="numeric"
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCourseDialogVisible(false)}>{t('cancel')}</Button>
            <Button onPress={handleAddCourse}>{t('add')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Dialog visible={groupDialogVisible} onDismiss={() => setGroupDialogVisible(false)}>
          <Dialog.Title>{t('new_group')}</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label={t('group_name')}
              value={newGroupName}
              onChangeText={setNewGroupName}
              mode="outlined"
              style={styles.dialogInput}
            />
            <TextInput
              label={t('admission_year')}
              value={newGroupAdmissionYear}
              onChangeText={setNewGroupAdmissionYear}
              keyboardType="numeric"
              mode="outlined"
              style={styles.dialogInput}
            />
            <Text style={styles.fieldLabel}>{t('group_course')}</Text>
            <ScrollView style={styles.coursePicker}>
              {allCourses.map(course => (
                <List.Item
                  key={course.id}
                  title={`${course.year} ${t('course')} · ${getLocalizedCourseName(course, language)}`}
                  description={getLocalizedDisciplineName(course, language) || t('discipline_not_specified')}
                  left={props => (
                    <List.Icon
                      {...props}
                      icon={targetCourseId === course.id ? 'radiobox-marked' : 'radiobox-blank'}
                    />
                  )}
                  onPress={() => setTargetCourseId(course.id)}
                />
              ))}
              {allCourses.length === 0 && (
                <Text style={styles.emptyText}>{t('create_discipline_course_first')}</Text>
              )}
            </ScrollView>
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setGroupDialogVisible(false)}>{t('cancel')}</Button>
            <Button onPress={handleAddGroup}>{t('add')}</Button>
          </Dialog.Actions>
        </Dialog>

        <Snackbar visible={!!snackbarMsg} onDismiss={() => setSnackbarMsg('')} duration={3000}>
          {snackbarMsg}
        </Snackbar>
      </Portal>
    </View>
  );
}

function DisciplineSection({
  disciplines,
  language,
  t,
  onAddDiscipline,
  onAddCourse,
  onDeleteDiscipline,
  onDeleteCourse,
}: {
  disciplines: { disc: Discipline; courses: Course[] }[];
  language: ReturnType<typeof useLanguage>['language'];
  t: ReturnType<typeof useLanguage>['t'];
  onAddDiscipline: () => void;
  onAddCourse: (disciplineId: EntityId) => void;
  onDeleteDiscipline: (id: EntityId) => void;
  onDeleteCourse: (id: EntityId) => void;
}) {
  return (
    <>
      <Button mode="contained" icon="book-education" onPress={onAddDiscipline} style={styles.addBtn}>
        {t('add_discipline')}
      </Button>
      <ScrollView contentContainerStyle={styles.list}>
        {disciplines.length === 0 ? (
          <Text style={styles.emptyText}>{t('create_first_discipline')}</Text>
        ) : (
          disciplines.map(item => (
            <Card key={item.disc.id} style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <View style={[styles.colorDot, { backgroundColor: item.disc.color }]} />
                  <Text variant="titleMedium" style={styles.cardTitle}>{getLocalizedDisciplineName(item.disc, language)}</Text>
                  <IconButton icon="delete-outline" iconColor={THEME.colors.error} onPress={() => onDeleteDiscipline(item.disc.id)} />
                </View>

                {item.courses.map(course => (
                  <View key={course.id} style={styles.courseRow}>
                    <Text style={styles.courseText}>{course.year} {t('course')} · {getLocalizedCourseName(course, language)}</Text>
                    <IconButton icon="close" size={20} iconColor={THEME.colors.error} onPress={() => onDeleteCourse(course.id)} />
                  </View>
                ))}

                <Button mode="text" icon="plus" onPress={() => onAddCourse(item.disc.id)} style={styles.addCourseBtn}>
                  {t('add_course')}
                </Button>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </>
  );
}

function GroupSection({
  groups,
  language,
  t,
  onAddGroup,
  onDeleteGroup,
}: {
  groups: StudentGroup[];
  language: ReturnType<typeof useLanguage>['language'];
  t: ReturnType<typeof useLanguage>['t'];
  onAddGroup: () => void;
  onDeleteGroup: (id: EntityId) => void;
}) {
  return (
    <>
      <Button mode="contained" icon="account-group" onPress={onAddGroup} style={styles.addBtn}>
        {t('add_group')}
      </Button>
      <ScrollView contentContainerStyle={styles.list}>
        {groups.length === 0 ? (
          <Text style={styles.emptyText}>{t('groups_empty')}</Text>
        ) : (
          groups.map(group => (
            <Card key={group.id} style={styles.card}>
              <Card.Content>
                <View style={styles.cardHeader}>
                  <View style={[styles.colorDot, { backgroundColor: group.discipline_color || THEME.colors.primary }]} />
                  <View style={styles.cardTitleWrap}>
                    <Text variant="titleMedium" style={styles.cardTitle}>{group.name}</Text>
                    <Text style={styles.meta}>
                      {formatStudentGroupDescription(group, language, t)}
                    </Text>
                  </View>
                  <IconButton icon="delete-outline" iconColor={THEME.colors.error} onPress={() => onDeleteGroup(group.id)} />
                </View>
              </Card.Content>
            </Card>
          ))
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  header: {
    backgroundColor: THEME.colors.primary,
    padding: 20,
    paddingTop: 52,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerTitle: { color: '#fff', fontWeight: 'bold' },
  headerSub: { color: 'rgba(255,255,255,0.78)', marginTop: 4 },
  tabWrap: { padding: 16, paddingBottom: 0 },
  addBtn: { margin: 16, marginBottom: 8, borderRadius: 10 },
  list: { padding: 16, paddingTop: 8, paddingBottom: 40 },
  card: { marginBottom: 12, backgroundColor: '#fff', borderRadius: 10 },
  cardHeader: { flexDirection: 'row', alignItems: 'center' },
  colorDot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  cardTitleWrap: { flex: 1 },
  cardTitle: { flex: 1, fontWeight: 'bold', color: THEME.colors.text },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 24,
    borderTopWidth: 1,
    borderTopColor: '#EEF0F4',
  },
  courseText: { flex: 1, color: THEME.colors.textSecondary },
  addCourseBtn: { alignSelf: 'flex-start', marginTop: 6 },
  dialogInput: { marginBottom: 12 },
  fieldLabel: { color: THEME.colors.textSecondary, marginBottom: 6, marginTop: 4 },
  coursePicker: { maxHeight: 260, borderRadius: 8, backgroundColor: '#F7F8FB' },
  emptyText: { textAlign: 'center', color: THEME.colors.textSecondary, padding: 20 },
  meta: { color: THEME.colors.textSecondary, marginTop: 2 },
});

import { useEffect, useState, useCallback } from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, IconButton, Card, TextInput, Dialog, Portal, Snackbar } from 'react-native-paper';
import { useFocusEffect } from '@react-navigation/native';
import {
  Discipline,
  Course,
  getAllDisciplines,
  getCoursesForDiscipline,
  addDiscipline,
  deleteDiscipline,
  addCourse,
  deleteCourse
} from '../../services/disciplineService';
import { THEME, PALETTE } from '../../constants/theme';

export default function SettingsScreen() {
  const [disciplines, setDisciplines] = useState<{ disc: Discipline, courses: Course[] }[]>([]);
  
  // Discipline Dialog
  const [discDialogVisible, setDiscDialogVisible] = useState(false);
  const [newDiscName, setNewDiscName] = useState('');

  // Course Dialog
  const [courseDialogVisible, setCourseDialogVisible] = useState(false);
  const [targetDiscId, setTargetDiscId] = useState<number | null>(null);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseYear, setNewCourseYear] = useState('');

  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMsg, setSnackbarMsg] = useState('');

  const loadData = async () => {
    const dList = await getAllDisciplines();
    const result = [];
    for (const d of dList) {
      const c = await getCoursesForDiscipline(d.id);
      result.push({ disc: d, courses: c });
    }
    setDisciplines(result);
  };

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [])
  );

  const handleAddDiscipline = async () => {
    const name = newDiscName.trim();
    if (!name) return;
    
    const color = PALETTE[Math.floor(Math.random() * PALETTE.length)];
    await addDiscipline(name, color);
    
    setDiscDialogVisible(false);
    setNewDiscName('');
    setSnackbarMsg(`✅ Дисциплина «${name}» добавлена`);
    setSnackbarVisible(true);
    loadData();
  };

  const handleDeleteDiscipline = async (id: number) => {
    await deleteDiscipline(id);
    loadData();
  };

  const handleAddCourse = async () => {
    const name = newCourseName.trim();
    const year = parseInt(newCourseYear.trim(), 10);
    
    if (!name || isNaN(year) || year < 1 || year > 6 || !targetDiscId) {
      setSnackbarMsg('Курс должен быть от 1 до 6');
      setSnackbarVisible(true);
      return;
    }
    
    await addCourse(name, year, targetDiscId);
    setCourseDialogVisible(false);
    setNewCourseName('');
    setNewCourseYear('');
    setSnackbarMsg('✅ Курс добавлен');
    setSnackbarVisible(true);
    loadData();
  };

  const handleDeleteCourse = async (id: number) => {
    await deleteCourse(id);
    loadData();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text variant="headlineSmall" style={styles.headerTitle}>⚙️ Настройки</Text>
      </View>

      <Button
        mode="contained"
        onPress={() => setDiscDialogVisible(true)}
        style={styles.addBtn}
      >
        + Добавить дисциплину
      </Button>

      <ScrollView contentContainerStyle={styles.list}>
        {disciplines.length === 0 ? (
          <Text style={styles.emptyText}>Нет дисциплин. Нажмите «+ Добавить дисциплину».</Text>
        ) : (
          disciplines.map(item => (
            <Card key={item.disc.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={{ color: item.disc.color, fontSize: 24, marginRight: 10 }}>●</Text>
                <Text variant="titleMedium" style={{ flex: 1, fontWeight: 'bold' }}>{item.disc.name}</Text>
                <IconButton
                  icon="delete"
                  iconColor="#D32F2F"
                  onPress={() => handleDeleteDiscipline(item.disc.id)}
                />
              </View>

              {item.courses.map(c => (
                <View key={c.id} style={styles.courseRow}>
                  <Text style={styles.courseText}>{c.year} курс — {c.name}</Text>
                  <IconButton
                    icon="close"
                    size={20}
                    iconColor="#D32F2F"
                    onPress={() => handleDeleteCourse(c.id)}
                  />
                </View>
              ))}

              <Button
                mode="text"
                onPress={() => {
                  setTargetDiscId(item.disc.id);
                  setCourseDialogVisible(true);
                }}
                style={styles.addCourseBtn}
              >
                + Добавить курс
              </Button>
            </Card>
          ))
        )}
      </ScrollView>

      <Portal>
        {/* Discipline Dialog */}
        <Dialog visible={discDialogVisible} onDismiss={() => setDiscDialogVisible(false)}>
          <Dialog.Title>Новая дисциплина</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Название дисциплины"
              value={newDiscName}
              onChangeText={setNewDiscName}
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDiscDialogVisible(false)}>Отмена</Button>
            <Button onPress={handleAddDiscipline}>Добавить</Button>
          </Dialog.Actions>
        </Dialog>

        {/* Course Dialog */}
        <Dialog visible={courseDialogVisible} onDismiss={() => setCourseDialogVisible(false)}>
          <Dialog.Title>Добавить курс</Dialog.Title>
          <Dialog.Content>
            <TextInput
              label="Название курса (напр. «Информатика»)"
              value={newCourseName}
              onChangeText={setNewCourseName}
              mode="outlined"
              style={{ marginBottom: 10 }}
            />
            <TextInput
              label="Номер курса (1–6)"
              value={newCourseYear}
              onChangeText={setNewCourseYear}
              keyboardType="numeric"
              mode="outlined"
            />
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setCourseDialogVisible(false)}>Отмена</Button>
            <Button onPress={handleAddCourse}>Добавить</Button>
          </Dialog.Actions>
        </Dialog>

        <Snackbar visible={snackbarVisible} onDismiss={() => setSnackbarVisible(false)} duration={3000}>
          {snackbarMsg}
        </Snackbar>
      </Portal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    backgroundColor: THEME.colors.primaryDark,
    padding: 16,
    paddingTop: 20,
    height: 70,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: 'bold',
  },
  addBtn: {
    margin: 16,
    backgroundColor: THEME.colors.primaryDark,
  },
  list: {
    padding: 12,
    paddingBottom: 20,
  },
  emptyText: {
    textAlign: 'center',
    color: THEME.colors.textSecondary,
    marginTop: 20,
  },
  card: {
    marginBottom: 12,
    backgroundColor: '#fff',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 16,
  },
  courseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 46,
    paddingRight: 8,
  },
  courseText: {
    flex: 1,
    color: THEME.colors.textSecondary,
  },
  addCourseBtn: {
    alignSelf: 'flex-start',
    marginLeft: 36,
    marginBottom: 8,
  },
});

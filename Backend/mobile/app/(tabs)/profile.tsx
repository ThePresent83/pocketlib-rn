import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Avatar, Button, List, Divider, Card } from 'react-native-paper';
import { useAuth } from '../../contexts/AuthContext';
import { THEME } from '../../constants/theme';
import { useEffect, useState } from 'react';
import { getAllBooks } from '../../services/bookService';
import { getAllDisciplines, getAllCategories } from '../../services/disciplineService';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [stats, setStats] = useState({
    totalBooks: 0,
    offlineBooks: 0,
    disciplines: 0,
    categories: 0
  });

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    const books = await getAllBooks();
    const discs = await getAllDisciplines();
    const cats = await getAllCategories();
    
    setStats({
      totalBooks: books.length,
      offlineBooks: books.filter(b => b.is_downloaded).length,
      disciplines: discs.length,
      categories: cats.length
    });
  };

  if (!user) return null;

  const roleLabels: Record<string, string> = {
    admin: 'Администратор',
    teacher: 'Преподаватель',
    student: 'Студент'
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <Avatar.Text 
          size={80} 
          label={user.full_name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase()} 
          style={styles.avatar}
        />
        <Text variant="headlineSmall" style={styles.name}>{user.full_name}</Text>
        <Text variant="bodyLarge" style={styles.role}>{roleLabels[user.role] || user.role}</Text>
        <Text variant="bodyMedium" style={styles.email}>{user.email}</Text>
      </View>

      <View style={styles.statsRow}>
        <Card style={styles.statCard}>
          <Text style={styles.statVal}>{stats.totalBooks}</Text>
          <Text style={styles.statLab}>Книг</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statVal}>{stats.offlineBooks}</Text>
          <Text style={styles.statLab}>Офлайн</Text>
        </Card>
        <Card style={styles.statCard}>
          <Text style={styles.statVal}>{stats.disciplines}</Text>
          <Text style={styles.statLab}>Дисциплин</Text>
        </Card>
      </View>

      <List.Section style={styles.section}>
        <List.Subheader>Информация</List.Subheader>
        {user.group_name && <List.Item title="Группа" description={user.group_name} left={props => <List.Icon {...props} icon="account-group" />} />}
        <List.Item 
          title="Специальность" 
          description="Информационные системы" // В идеале тянуть из справочника
          left={props => <List.Icon {...props} icon="school" />} 
        />
        <List.Item 
          title="Дата регистрации" 
          description={new Date(user.created_at).toLocaleDateString()} 
          left={props => <List.Icon {...props} icon="calendar" />} 
        />
      </List.Section>

      <Divider />

      <List.Section style={styles.section}>
        <List.Subheader>Настройки</List.Subheader>
        <List.Item title="Уведомления" left={props => <List.Icon {...props} icon="bell-outline" />} right={props => <List.Icon {...props} icon="chevron-right" />} />
        <List.Item title="Темная тема" left={props => <List.Icon {...props} icon="theme-light-dark" />} right={props => <List.Icon {...props} icon="chevron-right" />} />
      </List.Section>

      <Button 
        mode="outlined" 
        onPress={signOut} 
        style={styles.logoutBtn}
        textColor={THEME.colors.error}
      >
        Выйти из аккаунта
      </Button>
      
      <Text style={styles.version}>PocketLib v1.0.0 (Diploma Edition)</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: THEME.colors.background,
  },
  header: {
    alignItems: 'center',
    padding: 30,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    elevation: 2,
  },
  avatar: {
    backgroundColor: THEME.colors.primary,
    marginBottom: 16,
  },
  name: {
    fontWeight: 'bold',
    textAlign: 'center',
  },
  role: {
    color: THEME.colors.primary,
    fontWeight: '600',
    marginTop: 4,
  },
  email: {
    color: THEME.colors.textSecondary,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    padding: 16,
    marginTop: 8,
  },
  statCard: {
    padding: 12,
    alignItems: 'center',
    width: '30%',
    backgroundColor: '#fff',
  },
  statVal: {
    fontSize: 18,
    fontWeight: 'bold',
    color: THEME.colors.primary,
  },
  statLab: {
    fontSize: 10,
    color: THEME.colors.textSecondary,
    textTransform: 'uppercase',
  },
  section: {
    backgroundColor: '#fff',
    marginTop: 12,
  },
  logoutBtn: {
    margin: 24,
    borderColor: THEME.colors.error,
  },
  version: {
    textAlign: 'center',
    color: '#ccc',
    fontSize: 10,
    marginBottom: 40,
  }
});

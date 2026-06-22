import { useEffect, useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, Snackbar, List, Portal, Dialog } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { register } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { THEME } from '../../constants/theme';
import { getAllGroups, StudentGroup } from '../../services/disciplineService';
import { useLanguage } from '../../contexts/LanguageContext';
import { formatStudentGroupDescription } from '../../utils/localizedCatalog';
import { useAppTheme } from '../../contexts/ThemeContext';

export default function RegisterScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  const { language, t } = useLanguage();
  const { colors } = useAppTheme();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [groups, setGroups] = useState<StudentGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<StudentGroup | null>(null);
  const [groupDialogVisible, setGroupDialogVisible] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    getAllGroups().then(setGroups).catch(() => setGroups([]));
  }, []);

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      setErrorMsg(t('fill_all_fields'));
      return;
    }

    setLoading(true);
    const user = await register({
      full_name: fullName.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'student',
      group_id: selectedGroup?.id
    });
    setLoading(false);

    if (user) {
      await signIn(user);
    } else {
      setErrorMsg(t('error'));
    }
  };

  return (
    <KeyboardAvoidingView 
      style={[styles.container, { backgroundColor: colors.background }]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={[styles.title, { color: colors.text }]}>{t('register')}</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label={`${t('full_name')} *`}
            value={fullName}
            onChangeText={setFullName}
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.surface }]}
          />
          <TextInput
            label="Email *"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.surface }]}
          />
          <TextInput
            label={`${t('password')} *`}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            style={[styles.input, { backgroundColor: colors.surface }]}
          />

          <List.Item
            title={t('group')}
            description={selectedGroup
              ? `${selectedGroup.name} · ${formatStudentGroupDescription(selectedGroup, language, t)}`
              : groups.length ? t('choose_group') : t('groups_not_created')}
            left={props => <List.Icon {...props} icon="account-group" />}
            right={props => <List.Icon {...props} icon="chevron-down" />}
            onPress={groups.length ? () => setGroupDialogVisible(true) : undefined}
            style={[styles.selector, { backgroundColor: colors.surface }]}
          />

          <Button 
            mode="contained" 
            onPress={handleRegister} 
            loading={loading}
            style={styles.button}
          >
            {t('register')}
          </Button>
          
          <Button 
            mode="text" 
            onPress={() => router.back()}
            style={styles.textButton}
          >
            {t('already_have_account')}
          </Button>
        </View>
      </ScrollView>

      <Snackbar visible={!!errorMsg} onDismiss={() => setErrorMsg('')} duration={3000}>
        {errorMsg}
      </Snackbar>

      <Portal>
        <Dialog visible={groupDialogVisible} onDismiss={() => setGroupDialogVisible(false)}>
          <Dialog.Title>{t('choose_group_title')}</Dialog.Title>
          <Dialog.ScrollArea style={{ maxHeight: 360 }}>
            <ScrollView>
              {groups.map(group => (
                <List.Item
                  key={group.id}
                  title={group.name}
                  description={formatStudentGroupDescription(group, language, t)}
                  onPress={() => {
                    setSelectedGroup(group);
                    setGroupDialogVisible(false);
                  }}
                />
              ))}
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setGroupDialogVisible(false)}>{t('close')}</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 30 },
  title: { fontWeight: 'bold', color: THEME.colors.text },
  form: { gap: 16 },
  input: { backgroundColor: '#fff' },
  selector: { backgroundColor: '#fff', borderRadius: 8 },
  button: { marginTop: 8, paddingVertical: 6 },
  textButton: { marginTop: 8 },
});

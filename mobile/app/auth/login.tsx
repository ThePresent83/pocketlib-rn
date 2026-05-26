import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { login } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { THEME } from '../../constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleLogin = async () => {
    if (!email || !password) {
      setErrorMsg('Пожалуйста, заполните все поля');
      return;
    }

    setLoading(true);
    const user = await login(email.toLowerCase().trim(), password);
    setLoading(false);

    if (user) {
      await signIn(user);
    } else {
      setErrorMsg('Неверный email или пароль');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text variant="displaySmall" style={styles.title}>PocketLib</Text>
          <Text variant="titleMedium" style={styles.subtitle}>Библиотека учебных материалов</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Пароль"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            style={styles.input}
          />

          <Button 
            mode="contained" 
            onPress={handleLogin} 
            loading={loading}
            style={styles.button}
          >
            Войти
          </Button>
          
          <Button 
            mode="text" 
            onPress={() => router.push('/auth/register')}
            style={styles.textButton}
          >
            Нет аккаунта? Зарегистрироваться
          </Button>
        </View>
      </ScrollView>

      <Snackbar visible={!!errorMsg} onDismiss={() => setErrorMsg('')} duration={3000}>
        {errorMsg}
      </Snackbar>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: THEME.colors.background },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  title: { fontWeight: 'bold', color: THEME.colors.primary },
  subtitle: { color: THEME.colors.textSecondary, marginTop: 8 },
  form: { gap: 16 },
  input: { backgroundColor: '#fff' },
  button: { marginTop: 8, paddingVertical: 6 },
  textButton: { marginTop: 8 },
});

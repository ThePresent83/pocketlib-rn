import { useState } from 'react';
import { View, StyleSheet, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Text, TextInput, Button, Snackbar } from 'react-native-paper';
import { useRouter } from 'expo-router';
import { register } from '../../services/userService';
import { useAuth } from '../../contexts/AuthContext';
import { THEME } from '../../constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const { signIn } = useAuth();
  
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async () => {
    if (!fullName || !email || !password) {
      setErrorMsg('Пожалуйста, заполните все обязательные поля');
      return;
    }

    setLoading(true);
    const user = await register({
      full_name: fullName.trim(),
      email: email.toLowerCase().trim(),
      password,
      role: 'student'
    });
    setLoading(false);

    if (user) {
      await signIn(user);
    } else {
      setErrorMsg('Ошибка регистрации. Возможно, email уже занят.');
    }
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container} 
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Text variant="headlineMedium" style={styles.title}>Регистрация</Text>
        </View>

        <View style={styles.form}>
          <TextInput
            label="ФИО *"
            value={fullName}
            onChangeText={setFullName}
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Email *"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            mode="outlined"
            style={styles.input}
          />
          <TextInput
            label="Пароль *"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            mode="outlined"
            style={styles.input}
          />

          <Button 
            mode="contained" 
            onPress={handleRegister} 
            loading={loading}
            style={styles.button}
          >
            Зарегистрироваться
          </Button>
          
          <Button 
            mode="text" 
            onPress={() => router.back()}
            style={styles.textButton}
          >
            Уже есть аккаунт? Войти
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
  header: { alignItems: 'center', marginBottom: 30 },
  title: { fontWeight: 'bold', color: THEME.colors.text },
  form: { gap: 16 },
  input: { backgroundColor: '#fff' },
  button: { marginTop: 8, paddingVertical: 6 },
  textButton: { marginTop: 8 },
});

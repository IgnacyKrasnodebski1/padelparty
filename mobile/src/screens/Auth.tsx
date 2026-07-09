import React, { useState } from 'react';
import { View, Text, TextInput, ScrollView, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, G } from '../theme';
import { EMOJIS, COLORS } from '../logic';
import { Btn, Segmented, toast } from '../components';
import { useStore } from '../store';

export default function Auth() {
  const { register, login } = useStore();
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [emoji, setEmoji] = useState('🎾');
  const [color, setColor] = useState('#6C5CE7');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const submit = async () => {
    if (loading) return;
    const u = username.trim();
    if (u.length < 2) return toast('Wpisz login (min. 2 znaki)');
    if (password.length < 3) return toast('Hasło min. 3 znaki');
    setLoading(true);
    try {
      if (mode === 'register') await register(u, password, u, emoji, color);
      else await login(u, password);
    } catch (e: any) {
      const m = e?.message || '';
      if (/network|fetch|failed|timeout|abort/i.test(m)) toast('Serwer się budzi lub brak sieci — kliknij jeszcze raz za chwilę');
      else toast(m || 'Nie udało się');
    }
    setLoading(false);
  };

  return (
    <ScrollView keyboardShouldPersistTaps="handled" style={{ flex: 1, backgroundColor: C.bg }}>
      <LinearGradient colors={G.g1} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
        <Text style={st.kick}>🎾 PADEL Z EKIPĄ</Text>
        <Text style={st.h1}>PadelParty</Text>
        <Text style={st.sub}>{mode === 'register' ? 'Załóż konto — bez maili, sam login i hasło.' : 'Zaloguj się i graj dalej.'}</Text>
      </LinearGradient>

      <View style={{ padding: 16 }}>
        <View style={{ marginBottom: 14 }}>
          <Segmented options={[{ k: 'register', label: '✨ Rejestracja' }, { k: 'login', label: '🔑 Logowanie' }]} value={mode} onChange={k => setMode(k as any)} />
        </View>

        <View style={st.card}>
          <Text style={st.label}>Login</Text>
          <TextInput value={username} onChangeText={setUsername} placeholder="np. kuba" autoCapitalize="none" autoCorrect={false} returnKeyType="next" placeholderTextColor={C.muted} style={st.input} />
          <Text style={st.label}>Hasło</Text>
          <View style={{ justifyContent: 'center' }}>
            <TextInput value={password} onChangeText={setPassword} placeholder="min. 3 znaki" secureTextEntry={!showPass} autoCapitalize="none" autoCorrect={false} returnKeyType="go" onSubmitEditing={submit} placeholderTextColor={C.muted} style={[st.input, { paddingRight: 50 }]} />
            <Pressable onPress={() => setShowPass(s => !s)} hitSlop={10} style={{ position: 'absolute', right: 12, padding: 6 }}>
              <Text style={{ fontSize: 18 }}>{showPass ? '🙈' : '👁️'}</Text>
            </Pressable>
          </View>

          {mode === 'register' && (
            <>
              <Text style={st.label}>Wybierz avatar</Text>
              <View style={st.grid}>
                {EMOJIS.map(e => (
                  <Pressable key={e} onPress={() => setEmoji(e)} style={[st.emoji, emoji === e && { borderColor: C.purple, backgroundColor: '#F1EFFE' }]}>
                    <Text style={{ fontSize: 22 }}>{e}</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={st.label}>Kolor</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {COLORS.map(c => (
                  <Pressable key={c} onPress={() => setColor(c)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c, borderWidth: 3, borderColor: '#fff', ...(color === c ? { transform: [{ scale: 1.12 }] } : {}) }} />
                ))}
              </View>
            </>
          )}

          <View style={{ height: 16 }} />
          <Btn title={loading ? '⏳ Łączę z serwerem…' : (mode === 'register' ? 'Zakładam konto 🎾' : 'Wchodzę 🎾')} grad="g1" onPress={submit} />
          {loading && <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', textAlign: 'center', marginTop: 10 }}>Pierwsze wejście po przerwie budzi serwer — chwilkę…</Text>}
        </View>
        <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', textAlign: 'center', marginTop: 10 }}>
          Konto = wspólne rankingi z ekipą. Logujesz się z każdego urządzenia.
        </Text>
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  hero: { paddingTop: 60, paddingBottom: 24, paddingHorizontal: 16, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kick: { color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '800', letterSpacing: 1.5 },
  h1: { color: '#fff', fontSize: 28, fontWeight: '900', marginTop: 4, letterSpacing: -0.5 },
  sub: { color: '#fff', opacity: 0.92, fontSize: 14, fontWeight: '600', marginTop: 6 },
  card: { backgroundColor: '#fff', borderRadius: 20, padding: 16 },
  label: { fontWeight: '800', fontSize: 13, marginBottom: 7, marginTop: 12, color: C.ink },
  input: { borderWidth: 2, borderColor: C.line, backgroundColor: '#FBFBFD', borderRadius: 14, padding: 14, fontSize: 16, color: C.ink },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  emoji: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F6F6FA', borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
});

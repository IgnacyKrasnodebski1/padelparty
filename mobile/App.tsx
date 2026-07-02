import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Pressable, ActivityIndicator, StyleSheet, Animated, Platform } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { C } from './src/theme';
import { StoreProvider, useStore } from './src/store';
import { registerToast } from './src/components';
import Auth from './src/screens/Auth';
import Home from './src/screens/Home';
import Play from './src/screens/Play';
import Rankings from './src/screens/Rankings';
import Tournaments from './src/screens/Tournaments';
import Profile from './src/screens/Profile';

const TABS = [
  { k: 'home', icon: '🏠', label: 'Party' },
  { k: 'play', icon: '🎾', label: 'Gramy' },
  { k: 'rankings', icon: '📊', label: 'Rankingi' },
  { k: 'tournaments', icon: '🏆', label: 'Turnieje' },
  { k: 'profile', icon: '👤', label: 'Ja' },
];

function ToastHost() {
  const [msg, setMsg] = useState('');
  const op = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    registerToast((m: string) => {
      setMsg(m);
      Animated.sequence([
        Animated.timing(op, { toValue: 1, duration: 180, useNativeDriver: true }),
        Animated.delay(1800),
        Animated.timing(op, { toValue: 0, duration: 250, useNativeDriver: true }),
      ]).start();
    });
  }, []);
  return (
    <Animated.View pointerEvents="none" style={[st.toast, { opacity: op }]}>
      <Text style={{ color: '#fff', fontWeight: '800', fontSize: 14 }}>{msg}</Text>
    </Animated.View>
  );
}

function Main() {
  const { booted, token } = useStore();
  const [tab, setTab] = useState('home');
  const [playInit, setPlayInit] = useState<{ mode: string; partyId: string | null } | undefined>(undefined);

  if (!booted) return <View style={[st.center, { backgroundColor: C.purple }]}><ActivityIndicator color="#fff" size="large" /></View>;
  if (!token) return <><Auth /><ToastHost /><StatusBar style="light" /></>;

  const goPlay = (mode: string, partyId: string) => { setPlayInit({ mode, partyId }); setTab('play'); };

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={{ flex: 1 }}>
        {tab === 'home' && <Home onGoPlay={goPlay} />}
        {tab === 'play' && <Play init={playInit} />}
        {tab === 'rankings' && <Rankings />}
        {tab === 'tournaments' && <Tournaments />}
        {tab === 'profile' && <Profile />}
      </View>
      <View style={st.nav}>
        {TABS.map(t => {
          const on = tab === t.k;
          return (
            <Pressable key={t.k} style={st.navBtn} onPress={() => setTab(t.k)}>
              <Text style={{ fontSize: 22, opacity: on ? 1 : 0.5 }}>{t.icon}</Text>
              <Text style={{ fontSize: 10.5, fontWeight: '800', color: on ? C.purple : C.muted, marginTop: 2 }}>{t.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <ToastHost />
      <StatusBar style={tab === 'home' || tab === 'play' || tab === 'rankings' || tab === 'tournaments' ? 'light' : 'light'} />
    </View>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Main />
    </StoreProvider>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  nav: {
    flexDirection: 'row', backgroundColor: '#fff', borderTopWidth: 1, borderTopColor: C.line,
    paddingTop: 8, paddingBottom: Platform.OS === 'ios' ? 28 : 12,
  },
  navBtn: { flex: 1, alignItems: 'center' },
  toast: { position: 'absolute', bottom: 96, alignSelf: 'center', backgroundColor: C.ink, paddingVertical: 12, paddingHorizontal: 20, borderRadius: 14 },
});

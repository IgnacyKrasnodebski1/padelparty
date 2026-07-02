import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, Alert } from 'react-native';
import { C } from '../theme';
import { computeStats, EMOJIS, COLORS } from '../logic';
import { Avatar, Card, Btn, RowLabel, Tile, Sheet, toast } from '../components';
import { useStore } from '../store';

export default function Profile() {
  const { data, meId, mutate, logout } = useStore();
  const me = data.players.find(p => p.id === meId);
  const stats = computeStats(data);
  const mine = (meId && stats[meId]) || ({ elo: 1000, played: 0, wr: 0, wins: 0, losses: 0, best: 0 } as any);
  const others = data.players.filter(p => p.id !== meId);

  const [addOpen, setAddOpen] = useState(false);
  const [nm, setNm] = useState('');
  const [emoji, setEmoji] = useState('🔥');
  const [color, setColor] = useState('#FF9F1A');

  const addPlayer = async () => {
    if (!nm.trim()) return toast('Wpisz ksywę');
    setAddOpen(false); toast(nm.trim() + ' w ekipie! 👊');
    await mutate('addPlayer', { name: nm.trim(), emoji, color });
    setNm('');
  };
  const confirmReset = () => Alert.alert('Wyczyścić?', 'Skasujemy gierki, party i turnieje (konta zostają).', [
    { text: 'Anuluj', style: 'cancel' },
    { text: 'Wyczyść', style: 'destructive', onPress: async () => { await mutate('reset'); toast('Wyczyszczono'); } },
  ]);
  const confirmLogout = () => Alert.alert('Wylogować?', '', [{ text: 'Anuluj', style: 'cancel' }, { text: 'Wyloguj', style: 'destructive', onPress: logout }]);

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={st.hero}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View><Text style={st.kick}>TWÓJ PROFIL</Text><Text style={st.h1}>{me?.name}</Text></View>
          <Avatar p={me} size={64} />
        </View>
      </View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 10 }}>
          <Tile n={String(mine.elo)} l="ELO" />
          <Tile n={String(mine.played)} l="Gier" />
          <Tile n={mine.wr + '%'} l="Skuteczność" />
        </View>
        <View style={{ flexDirection: 'row', gap: 10 }}>
          <Tile n={String(mine.wins)} l="Wygrane" color={C.teal} />
          <Tile n={String(mine.losses)} l="Porażki" color={C.coral} />
          <Tile n={mine.best + '🔥'} l="Rekord passy" color={C.amber} />
        </View>

        <RowLabel title={`👥 Gracze (${data.players.length})`} right={<Pressable onPress={() => setAddOpen(true)}><Text style={{ color: C.purple, fontWeight: '800' }}>+ dodaj</Text></Pressable>} />
        <Card style={{ paddingVertical: 6 }}>
          <View style={st.prow}><Avatar p={me} size={40} /><Text style={{ fontWeight: '800', marginLeft: 12, color: C.ink }}>{me?.name}  ·  ty</Text></View>
          {others.map(p => (
            <View key={p.id} style={[st.prow, { borderTopWidth: 1, borderTopColor: C.line }]}>
              <Avatar p={p} size={40} />
              <Text style={{ flex: 1, fontWeight: '800', marginLeft: 12, color: C.ink }}>{p.name}</Text>
              <Btn title="🗑️" ghost small onPress={() => mutate('delPlayer', { id: p.id }).catch(e => toast(e.message))} />
            </View>
          ))}
        </Card>

        <RowLabel title="⚙️ Ustawienia" />
        <Card>
          <Btn title="✨ Wygeneruj dane demo (ekipa + gierki)" ghost style={{ marginBottom: 10 }} onPress={async () => { toast('Generuję demo ✨'); await mutate('seedDemo'); }} />
          <Btn title="🔑 Wyloguj się" ghost style={{ marginBottom: 10 }} onPress={confirmLogout} />
          <Btn title="🧹 Wyczyść gierki, party i turnieje" ghost textStyle={{ color: C.coral }} onPress={confirmReset} />
        </Card>
        <Text style={{ color: C.muted, textAlign: 'center', fontSize: 12, fontWeight: '600', marginTop: 14 }}>PadelParty · konto na serwerze, wspólne rankingi z ekipą 🎾</Text>
      </ScrollView>

      <Sheet visible={addOpen} onClose={() => setAddOpen(false)} title="👤 Nowy gracz" sub="Dodaj kumpla do ekipy (bez konta, od ręki).">
        <Text style={st.lbl}>Ksywa</Text>
        <TextInput value={nm} onChangeText={setNm} placeholder="np. Franek" placeholderTextColor={C.muted} style={st.input} />
        <Text style={st.lbl}>Avatar</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {EMOJIS.map(e => <Pressable key={e} onPress={() => setEmoji(e)} style={[st.emoji, emoji === e && { borderColor: C.purple, backgroundColor: '#F1EFFE' }]}><Text style={{ fontSize: 22 }}>{e}</Text></Pressable>)}
        </View>
        <Text style={st.lbl}>Kolor</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {COLORS.map(c => <Pressable key={c} onPress={() => setColor(c)} style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: c, borderWidth: 3, borderColor: '#fff', ...(color === c ? { transform: [{ scale: 1.12 }] } : {}) }} />)}
        </View>
        <View style={{ height: 16 }} />
        <Btn title="Dodaj gracza" grad="g1" onPress={addPlayer} />
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16, backgroundColor: C.amber, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kick: { color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  h1: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 3 },
  prow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  lbl: { fontWeight: '800', fontSize: 13, marginBottom: 7, marginTop: 14, color: C.ink },
  input: { borderWidth: 2, borderColor: C.line, backgroundColor: '#FBFBFD', borderRadius: 14, padding: 14, fontSize: 16, color: C.ink },
  emoji: { width: 44, height: 44, borderRadius: 14, backgroundColor: '#F6F6FA', borderWidth: 2, borderColor: 'transparent', alignItems: 'center', justifyContent: 'center' },
});

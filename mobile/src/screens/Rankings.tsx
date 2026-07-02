import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, G } from '../theme';
import { computeStats, RANKS, pget } from '../logic';
import { Avatar, Card, Segmented, Empty } from '../components';
import { useStore } from '../store';

export default function Rankings() {
  const { data, meId } = useStore();
  const [tab, setTab] = useState('elo');
  const r = RANKS[tab];
  const stats = computeStats(data);
  const rows = Object.values(stats).filter(s => s.played > 0 || tab === 'elo').sort((a, b) => r.key(b) - r.key(a) || b.elo - a.elo);
  const podium = rows.slice(0, 3);
  const order = [1, 0, 2].filter(i => podium[i]);
  const h = [90, 68, 54], medal = ['🥇', '🥈', '🥉'];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={st.hero}><Text style={st.kick}>{r.emoji} {r.desc.toUpperCase()}</Text><Text style={st.h1}>{r.name}</Text></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={{ marginBottom: 14 }}>
          <Segmented scroll options={Object.entries(RANKS).map(([k, v]) => ({ k, label: `${v.emoji} ${v.name}` }))} value={tab} onChange={setTab} />
        </View>

        {rows.length === 0 ? <Empty emoji="📊" text="Brak danych. Rozegraj gierki, żeby zbudować ranking!" /> : <>
          <LinearGradient colors={G.g4} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.podium}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 12 }}>
              {order.map(i => {
                const s = podium[i]; const p = pget(data, s.id);
                return (
                  <View key={s.id} style={{ flex: 1, alignItems: 'center' }}>
                    <Avatar p={p} size={54} />
                    <Text numberOfLines={1} style={{ color: '#fff', fontWeight: '900', fontSize: 14, marginTop: 6 }}>{p?.name}</Text>
                    <Text style={{ color: '#fff', opacity: 0.9, fontSize: 12, fontWeight: '800' }}>{r.fmt(s)}</Text>
                    <View style={{ backgroundColor: 'rgba(255,255,255,0.25)', borderTopLeftRadius: 12, borderTopRightRadius: 12, height: h[i], width: '100%', alignItems: 'center', paddingTop: 6, marginTop: 6 }}>
                      <Text style={{ fontSize: 22 }}>{medal[i]}</Text>
                    </View>
                  </View>
                );
              })}
            </View>
          </LinearGradient>

          <Card style={{ paddingVertical: 6 }}>
            {rows.map((s, i) => {
              const p = pget(data, s.id);
              return (
                <View key={s.id} style={[st.row, i < rows.length - 1 && st.rowBorder]}>
                  <Text style={{ width: 30, textAlign: 'center', fontWeight: '900', fontSize: 16, color: i < 3 ? [C.gold, '#9AA7B5', '#C98A4B'][i] : C.muted }}>{i < 3 ? medal[i] : i + 1}</Text>
                  <Avatar p={p} size={40} />
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={{ fontWeight: '800', color: C.ink }}>{p?.name}{s.id === meId ? '  ·  ty' : ''}</Text>
                    <Text style={{ fontSize: 12, color: C.muted, fontWeight: '700' }}>{r.sub(s)}</Text>
                  </View>
                  <Text style={{ fontWeight: '900', fontSize: 16, color: i === 0 ? C.gold : C.ink }}>{r.fmt(s)}</Text>
                </View>
              );
            })}
          </Card>
        </>}
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16, backgroundColor: C.pink, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kick: { color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  h1: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 3 },
  podium: { borderRadius: 20, padding: 16, marginBottom: 12 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: C.line },
});

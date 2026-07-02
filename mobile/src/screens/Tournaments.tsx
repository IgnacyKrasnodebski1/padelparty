import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, G } from '../theme';
import { genSchedule, tourStandings, names, pget, Tournament } from '../logic';
import { Avatar, AvStack, Card, Btn, Chip, Badge, Segmented, Sheet, Empty, toast } from '../components';
import { useStore } from '../store';

export default function Tournaments() {
  const { data, meId, mutate } = useStore();
  const list = [...data.tournaments].sort((a, b) => b.createdAt - a.createdAt);

  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const cur = data.tournaments.find(t => t.id === openId) || null;

  // new-tournament form
  const [name, setName] = useState('');
  const [format, setFormat] = useState<'1v1' | '2v2'>('2v2');
  const [weekly, setWeekly] = useState(true);
  const [rounds, setRounds] = useState(4);
  const [players, setPlayers] = useState<string[]>(meId ? [meId] : []);
  // score inputs buffer
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});

  const toggle = (id: string) => setPlayers(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id]));

  const create = async () => {
    const min = format === '2v2' ? 4 : 2;
    if (players.length < min) return toast('Potrzeba min. ' + min + ' graczy');
    const matches = genSchedule(players, format, rounds);
    if (!matches.length) return toast('Za mało graczy na ten format');
    setNewOpen(false); toast('Turniej gotowy! 🎲 ' + matches.length + ' meczów');
    await mutate('addTournament', { name: name.trim() || 'Turniej Americano', format, weekly, rounds, playerIds: players, matches });
    setName(''); setPlayers(meId ? [meId] : []);
  };

  const openTour = (t: Tournament) => {
    const buf: Record<string, { a: string; b: string }> = {};
    t.matches.forEach(m => (buf[m.id] = { a: String(m.aScore), b: String(m.bScore) }));
    setScores(buf); setOpenId(t.id);
  };
  const saveScores = async () => {
    if (!cur) return;
    const matches = cur.matches.map(m => {
      const s = scores[m.id] || { a: '0', b: '0' };
      const a = parseInt(s.a) || 0, b = parseInt(s.b) || 0;
      return { ...m, aScore: a, bScore: b, done: a + b > 0 };
    });
    await mutate('updateTournament', { id: cur.id, matches });
    toast('Wyniki zapisane 💾');
  };
  const finish = async () => { if (cur) { await mutate('updateTournament', { id: cur.id, status: 'done' }); setOpenId(null); toast('🏁 Turniej zakończony!'); } };

  const rounds_ = cur ? [...new Set(cur.matches.map(m => m.round))].sort((a, b) => a - b) : [];
  const standings = cur ? tourStandings(cur) : [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={st.hero}><Text style={st.kick}>RYWALIZACJA</Text><Text style={st.h1}>Turnieje 🏆</Text></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Btn title="➕ Nowy turniej" grad="g2" onPress={() => { setPlayers(meId ? [meId] : []); setNewOpen(true); }} />
        <View style={{ height: 12 }} />
        {list.length ? list.map(t => {
          const scored = t.matches.filter(m => m.done).length;
          const win = t.status === 'done' ? tourStandings(t)[0] : null;
          return (
            <Pressable key={t.id} onPress={() => openTour(t)}>
              <Card style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>{t.name}</Text>
                    <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 2 }}>{t.weekly ? '🔁 co tydzień · ' : ''}{t.format === '1v1' ? 'Singiel' : 'Debel'} Americano</Text>
                  </View>
                  <Badge label={t.status === 'done' ? 'ZAKOŃCZONY' : 'TRWA'} tone={t.status === 'done' ? 'done' : 'live'} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <AvStack data={data} ids={t.playerIds} />
                  <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800' }}>{win ? `🥇 ${pget(data, win.id)?.name}` : `${scored}/${t.matches.length} meczów`}</Text>
                </View>
              </Card>
            </Pressable>
          );
        }) : <Empty emoji="🏆" text={'Brak turniejów.\nOdpal cotygodniowe Americano dla ekipy!'} />}
      </ScrollView>

      {/* NEW TOURNAMENT */}
      <Sheet visible={newOpen} onClose={() => setNewOpen(false)} title="🏆 Nowy turniej" sub="Americano — partnerzy się rotują, liczą się punkty.">
        <Text style={st.lbl}>Nazwa</Text>
        <TextInput value={name} onChangeText={setName} placeholder="np. Liga Środowa #4" placeholderTextColor={C.muted} style={st.input} />
        <Text style={st.lbl}>Format</Text>
        <Segmented options={[{ k: '2v2', label: '👥 Debel 2v2' }, { k: '1v1', label: '🧍 Singiel 1v1' }]} value={format} onChange={f => setFormat(f as any)} />
        <Text style={st.lbl}>Liczba rund: {rounds}</Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Pressable onPress={() => setRounds(r => Math.max(2, r - 1))} style={st.step}><Text style={st.stepT}>−</Text></Pressable>
          <Text style={{ fontWeight: '900', fontSize: 18, width: 30, textAlign: 'center' }}>{rounds}</Text>
          <Pressable onPress={() => setRounds(r => Math.min(10, r + 1))} style={st.step}><Text style={st.stepT}>＋</Text></Pressable>
        </View>
        <Text style={st.lbl}>🔁 Cotygodniowy</Text>
        <Segmented options={[{ k: '1', label: 'Tak, co tydzień' }, { k: '0', label: 'Jednorazowy' }]} value={weekly ? '1' : '0'} onChange={v => setWeekly(v === '1')} />
        <Text style={st.lbl}>Uczestnicy ({players.length})</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {data.players.map(p => <Chip key={p.id} p={p} label={p.name} active={players.includes(p.id)} onPress={() => toggle(p.id)} />)}
        </View>
        <View style={{ height: 16 }} />
        <Btn title="Wygeneruj drabinkę 🎲" grad="g2" onPress={create} />
      </Sheet>

      {/* TOURNAMENT DETAIL */}
      <Sheet visible={!!cur} onClose={() => setOpenId(null)} title={cur ? `🏆 ${cur.name}` : ''} sub={cur ? `${cur.format === '1v1' ? 'Singiel' : 'Debel'} Americano · ${cur.playerIds.length} graczy` : ''}>
        {cur && <>
          <Text style={st.section}>📊 KLASYFIKACJA</Text>
          <Card style={{ paddingVertical: 6, marginBottom: 8 }}>
            {standings.map((s, i) => (
              <View key={s.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ width: 28, textAlign: 'center', fontWeight: '900', color: i < 3 ? [C.gold, '#9AA7B5', '#C98A4B'][i] : C.muted }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</Text>
                <Avatar p={pget(data, s.id)} size={30} />
                <Text style={{ flex: 1, marginLeft: 10, fontWeight: '800', color: C.ink }}>{pget(data, s.id)?.name}</Text>
                <Text style={{ fontWeight: '900', color: C.ink }}>{s.pts} pkt</Text>
              </View>
            ))}
          </Card>

          {cur.status === 'done' ? (
            <LinearGradient colors={G.g5} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 16, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ fontSize: 34 }}>🥇</Text>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{pget(data, standings[0]?.id)?.name || '—'}</Text>
              <Text style={{ color: '#fff', opacity: 0.9, fontWeight: '700' }}>Zwycięzca · {standings[0]?.pts || 0} pkt</Text>
            </LinearGradient>
          ) : <>
            <Text style={st.section}>🎾 MECZE — WPISZ WYNIKI</Text>
            {rounds_.map(rd => (
              <View key={rd}>
                <Text style={{ fontSize: 12, fontWeight: '900', color: C.muted, marginTop: 12, marginBottom: 6 }}>RUNDA {rd}</Text>
                {cur.matches.filter(m => m.round === rd).map(m => (
                  <Card key={m.id} style={{ marginBottom: 10, paddingVertical: 12 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                      <Text style={{ flex: 1, fontWeight: '800', fontSize: 13, color: C.ink }}>{names(data, m.aIds)}</Text>
                      <TextInput value={scores[m.id]?.a ?? '0'} onChangeText={v => setScores(s => ({ ...s, [m.id]: { a: v, b: s[m.id]?.b ?? '0' } }))} keyboardType="number-pad" style={st.scoreInput} />
                      <Text style={{ fontWeight: '900', color: C.muted }}>:</Text>
                      <TextInput value={scores[m.id]?.b ?? '0'} onChangeText={v => setScores(s => ({ ...s, [m.id]: { a: s[m.id]?.a ?? '0', b: v } }))} keyboardType="number-pad" style={st.scoreInput} />
                      <Text style={{ flex: 1, textAlign: 'right', fontWeight: '800', fontSize: 13, color: C.ink }}>{names(data, m.bIds)}</Text>
                    </View>
                  </Card>
                ))}
              </View>
            ))}
            <View style={{ height: 8 }} />
            <Btn title="💾 Zapisz wyniki" grad="g3" onPress={saveScores} />
            <View style={{ height: 10 }} />
            <Btn title="🏁 Zakończ turniej" ghost onPress={finish} />
          </>}
        </>}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16, backgroundColor: C.amber, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kick: { color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  h1: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 3 },
  lbl: { fontWeight: '800', fontSize: 13, marginBottom: 7, marginTop: 14, color: C.ink },
  section: { fontSize: 14, fontWeight: '900', color: C.ink, marginTop: 8, marginBottom: 8 },
  input: { borderWidth: 2, borderColor: C.line, backgroundColor: '#FBFBFD', borderRadius: 14, padding: 14, fontSize: 16, color: C.ink },
  scoreInput: { width: 46, textAlign: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 2, borderColor: C.line, fontWeight: '900', fontSize: 17, color: C.ink },
  step: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0F1F5', alignItems: 'center', justifyContent: 'center' },
  stepT: { fontSize: 22, fontWeight: '900', color: C.ink },
});

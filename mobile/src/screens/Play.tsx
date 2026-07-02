import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { C } from '../theme';
import { names } from '../logic';
import { Avatar, Card, Btn, Chip, Segmented, toast } from '../components';
import { useStore } from '../store';

export default function Play({ init }: { init?: { mode: string; partyId: string | null } }) {
  const { data, mutate } = useStore();
  const [mode, setMode] = useState('americano');
  const [format, setFormat] = useState('2v2');
  const [selA, setSelA] = useState<string[]>([]);
  const [selB, setSelB] = useState<string[]>([]);
  const [scA, setScA] = useState(0);
  const [scB, setScB] = useState(0);
  const [partyId, setPartyId] = useState<string | null>(null);

  useEffect(() => { if (init) { setMode(init.mode); setPartyId(init.partyId); setSelA([]); setSelB([]); setScA(0); setScB(0); } }, [init]);

  const cap = format === '2v2' ? 2 : 1;
  const pick = (team: 'a' | 'b', id: string) => {
    const mine = team === 'a' ? selA : selB, setMine = team === 'a' ? setSelA : setSelB;
    const other = team === 'a' ? selB : selA, setOther = team === 'a' ? setSelB : setSelA;
    if (other.includes(id)) setOther(other.filter(x => x !== id));
    if (mine.includes(id)) setMine(mine.filter(x => x !== id));
    else { const nm = [...mine]; if (nm.length >= cap) nm.shift(); setMine([...nm, id]); }
  };

  const save = async () => {
    if (selA.length !== cap || selB.length !== cap) return toast('Wybierz graczy dla obu drużyn');
    if (scA === scB) return toast('Wynik nie może być remisem 🤝');
    const w = scA > scB ? names(data, selA) : names(data, selB);
    await mutate('addGame', { mode, partyId, aIds: selA, bIds: selB, aScore: scA, bScore: scB });
    setScA(0); setScB(0); setSelA([]); setSelB([]);
    toast('Zapisane! 🏆 ' + w);
  };

  const ScoreSide = ({ team, sel, sc, setSc, col }: any) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontWeight: '800', fontSize: 13, color: col, marginBottom: 6, minHeight: 32, textAlign: 'center' }}>{sel.length ? names(data, sel) : team}</Text>
      <Text style={{ fontSize: 44, fontWeight: '900', color: sc > 0 ? C.ink : C.ink }}>{sc}</Text>
      <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
        <Pressable onPress={() => setSc(Math.max(0, sc - 1))} style={st.step}><Text style={st.stepT}>−</Text></Pressable>
        <Pressable onPress={() => setSc(sc + 1)} style={st.step}><Text style={st.stepT}>＋</Text></Pressable>
      </View>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={st.hero}><Text style={st.kick}>ROZEGRAJ GIERKĘ</Text><Text style={st.h1}>Zapisz wynik 🎾</Text></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <View style={{ marginBottom: 12 }}>
          <Segmented options={[{ k: 'americano', label: '🎯 Americano' }, { k: 'klasyk', label: '🎾 Klasyk' }]} value={mode} onChange={setMode} />
        </View>
        <View style={{ marginBottom: 12 }}>
          <Segmented options={[{ k: '2v2', label: '👥 Debel 2v2' }, { k: '1v1', label: '🧍 Singiel 1v1' }]} value={format} onChange={f => { setFormat(f); setSelA(a => a.slice(0, f === '2v2' ? 2 : 1)); setSelB(b => b.slice(0, f === '2v2' ? 2 : 1)); }} />
        </View>

        <Card style={{ marginBottom: 12 }}>
          <Text style={[st.hint, { color: C.blue }]}>DRUŻYNA A {selA.length}/{cap}</Text>
          <View style={st.chips}>{data.players.map(p => <Chip key={p.id} p={p} label={p.name} tone="a" active={selA.includes(p.id)} onPress={() => pick('a', p.id)} />)}</View>
          <View style={{ height: 14 }} />
          <Text style={[st.hint, { color: C.coral }]}>DRUŻYNA B {selB.length}/{cap}</Text>
          <View style={st.chips}>{data.players.map(p => <Chip key={p.id} p={p} label={p.name} tone="b" active={selB.includes(p.id)} onPress={() => pick('b', p.id)} />)}</View>
        </Card>

        <Card style={{ marginBottom: 12 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <ScoreSide team="Drużyna A" sel={selA} sc={scA} setSc={setScA} col={C.blue} />
            <Text style={{ fontWeight: '900', color: C.muted }}>VS</Text>
            <ScoreSide team="Drużyna B" sel={selB} sc={scB} setSc={setScB} col={C.coral} />
          </View>
          <Text style={{ color: C.muted, textAlign: 'center', fontSize: 12, fontWeight: '700', marginTop: 12 }}>
            {mode === 'americano' ? '🎯 Gramy do 21 pkt włącznie' : '🎾 Wpisz zdobyte gemy/sety'}
          </Text>
        </Card>

        <Btn title="💾 Zapisz gierkę" grad="g3" onPress={save} />
      </ScrollView>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16, backgroundColor: C.teal, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kick: { color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  h1: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 3 },
  hint: { fontSize: 12, fontWeight: '800', marginBottom: 8 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  step: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0F1F5', alignItems: 'center', justifyContent: 'center' },
  stepT: { fontSize: 22, fontWeight: '900', color: C.ink },
});

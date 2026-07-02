import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet, Share } from 'react-native';
import { C } from '../theme';
import { computeStats, names, timeAgo, Party } from '../logic';
import { Avatar, AvStack, Card, Btn, Chip, Badge, Segmented, Sheet, RowLabel, Empty, toast } from '../components';
import { useStore } from '../store';

export default function Home({ onGoPlay }: { onGoPlay: (mode: string, partyId: string) => void }) {
  const { data, meId, mutate } = useStore();
  const me = data.players.find(p => p.id === meId);
  const stats = computeStats(data);
  const mine = (meId && stats[meId]) || ({ elo: 1000, wins: 0, cur: 0 } as any);
  const active = data.parties.filter(p => p.status !== 'done').sort((a, b) => b.createdAt - a.createdAt);
  const recent = [...data.games].sort((a, b) => b.ts - a.ts).slice(0, 4);

  const [newOpen, setNewOpen] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [cfgParty, setCfgParty] = useState<Party | null>(null);
  const [npName, setNpName] = useState('');
  const [npMode, setNpMode] = useState('americano');
  const [npMembers, setNpMembers] = useState<string[]>(meId ? [meId] : []);
  const [code, setCode] = useState('');

  const toggle = (arr: string[], id: string) => (arr.includes(id) ? arr.filter(x => x !== id) : [...arr, id]);

  const createParty = async () => {
    if (!npMembers.length) return toast('Wybierz graczy');
    setNewOpen(false); toast('Party stworzone! 🎉');
    await mutate('addParty', { name: npName.trim() || 'Party', mode: npMode, memberIds: npMembers });
    setNpName('');
  };
  const doJoin = async () => {
    const c = code.trim().toUpperCase();
    if (!c) return toast('Wpisz kod');
    try { await mutate('joinParty', { code: c }); setJoinOpen(false); setCode(''); toast('Dołączono! 🎉'); }
    catch (e: any) { toast(e.message || 'Nie znaleziono kodu'); }
  };
  const invite = (p: Party) => Share.share({ message: `Dołącz do mojego padlowego party „${p.name}" w PadelParty! Kod: ${p.code}` });

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 100 }}>
        <View style={st.hero}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
            <View style={{ flex: 1 }}>
              <Text style={st.kick}>CZEŚĆ {me?.name?.toUpperCase()} 👋</Text>
              <Text style={st.h1}>Gramy dziś?</Text>
            </View>
            <Avatar p={me} size={64} />
          </View>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            {[['ELO', mine.elo], ['Wygrane', mine.wins], ['Passa', mine.cur + '🔥']].map(([l, v]) => (
              <View key={l as string} style={st.stat}><Text style={st.statN}>{v}</Text><Text style={st.statL}>{l}</Text></View>
            ))}
          </View>
        </View>

        <View style={{ paddingHorizontal: 16 }}>
          <View style={{ flexDirection: 'row', gap: 10, marginTop: 16 }}>
            <Btn title="➕ Nowe party" grad="g1" style={{ flex: 1 }} onPress={() => { setNpMembers(meId ? [meId] : []); setNewOpen(true); }} />
            <Btn title="🔗 Kod" ghost onPress={() => setJoinOpen(true)} />
          </View>

          <RowLabel title="🎉 Aktywne party" />
          {active.length ? active.map(p => (
            <Card key={p.id} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>{p.name}</Text>
                  <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 2 }}>kod: {p.code} · {p.memberIds.length} os.</Text>
                </View>
                <Badge label={p.status === 'playing' ? 'GRAMY' : 'OTWARTE'} tone={p.status === 'playing' ? 'live' : 'open'} />
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <AvStack data={data} ids={p.memberIds} />
                <Badge label={p.mode === 'americano' ? '🎯 Americano' : '🎾 Klasyk'} tone={p.mode === 'americano' ? 'amer' : 'klas'} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Btn title="🎾 Zagraj" grad="g3" small style={{ flex: 1 }} onPress={async () => { onGoPlay(p.mode, p.id); await mutate('updateParty', { id: p.id, status: 'playing' }); }} />
                <Btn title="⚙️" ghost small onPress={() => setCfgParty(p)} />
                <Btn title="🔗" ghost small onPress={() => invite(p)} />
              </View>
            </Card>
          )) : <Empty emoji="🍹" text={'Brak aktywnych party.\nStwórz jedno i zaproś ekipę!'} />}

          <RowLabel title="⏱️ Ostatnie gierki" />
          {recent.length ? recent.map(g => {
            const aw = g.aScore > g.bScore, bw = g.bScore > g.aScore;
            return (
              <Card key={g.id} style={{ marginBottom: 10, paddingVertical: 13 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Badge label={g.mode === 'americano' ? '🎯' : '🎾'} tone={g.mode === 'americano' ? 'amer' : 'klas'} />
                  <Text style={{ flex: 1, fontWeight: '800', fontSize: 13, color: aw ? C.teal : C.ink }}>{names(data, g.aIds)}</Text>
                  <Text style={{ fontWeight: '900', fontSize: 16, color: C.ink }}>{g.aScore} : {g.bScore}</Text>
                  <Text style={{ flex: 1, textAlign: 'right', fontWeight: '800', fontSize: 13, color: bw ? C.teal : C.ink }}>{names(data, g.bIds)}</Text>
                </View>
                <Text style={{ color: C.muted, fontSize: 11, fontWeight: '700', textAlign: 'center', marginTop: 6 }}>{timeAgo(g.ts)}{g.tournamentId ? ' · 🏆 turniej' : ''}</Text>
              </Card>
            );
          }) : <Empty emoji="🎾" text={'Jeszcze nikt nie grał.\nRozegraj pierwszą gierkę w „Gramy".'} />}
        </View>
      </ScrollView>

      {/* NEW PARTY */}
      <Sheet visible={newOpen} onClose={() => setNewOpen(false)} title="🎉 Nowe party" sub="Zbierz ekipę na dzisiejszą sesję.">
        <Text style={st.lbl}>Nazwa party</Text>
        <TextInput value={npName} onChangeText={setNpName} placeholder="np. Środowe Americano" placeholderTextColor={C.muted} style={st.input} />
        <Text style={st.lbl}>Domyślny tryb</Text>
        <Segmented options={[{ k: 'americano', label: '🎯 Americano' }, { k: 'klasyk', label: '🎾 Klasyk' }]} value={npMode} onChange={setNpMode} />
        <Text style={st.lbl}>Kto gra?</Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {data.players.map(p => <Chip key={p.id} p={p} label={p.name} active={npMembers.includes(p.id)} onPress={() => setNpMembers(m => toggle(m, p.id))} />)}
        </View>
        <View style={{ height: 16 }} />
        <Btn title="Stwórz party 🚀" grad="g1" onPress={createParty} />
      </Sheet>

      {/* JOIN */}
      <Sheet visible={joinOpen} onClose={() => setJoinOpen(false)} title="🔗 Dołącz do party" sub="Wpisz kod od kumpla.">
        <TextInput value={code} onChangeText={setCode} placeholder="np. K7XQ2" autoCapitalize="characters" maxLength={5} placeholderTextColor={C.muted} style={[st.input, { fontSize: 22, fontWeight: '900', textAlign: 'center', letterSpacing: 4 }]} />
        <View style={{ height: 14 }} />
        <Btn title="Dołącz" grad="g1" onPress={doJoin} />
      </Sheet>

      {/* PARTY CONFIG */}
      <Sheet visible={!!cfgParty} onClose={() => setCfgParty(null)} title={cfgParty ? `⚙️ ${cfgParty.name}` : ''} sub={cfgParty ? `${cfgParty.memberIds.length} graczy · kod ${cfgParty.code}` : ''}>
        {cfgParty && <>
          <Text style={st.lbl}>Gracze w party</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {data.players.map(p => (
              <Chip key={p.id} p={p} label={p.name} active={cfgParty.memberIds.includes(p.id)}
                onPress={async () => { const ids = toggle(cfgParty.memberIds, p.id); await mutate('updateParty', { id: cfgParty.id, memberIds: ids }); setCfgParty({ ...cfgParty, memberIds: ids }); }} />
            ))}
          </View>
          <View style={{ height: 16 }} />
          <Btn title="Zakończ party" ghost onPress={async () => { await mutate('updateParty', { id: cfgParty.id, status: 'done' }); setCfgParty(null); toast('Party zakończone'); }} textStyle={{ color: C.coral }} />
        </>}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  hero: { paddingTop: 56, paddingBottom: 20, paddingHorizontal: 16, backgroundColor: C.purple, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kick: { color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  h1: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 3 },
  stat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 16, paddingVertical: 10, paddingHorizontal: 12 },
  statN: { color: '#fff', fontSize: 22, fontWeight: '900' },
  statL: { color: '#fff', opacity: 0.9, fontSize: 11, fontWeight: '800' },
  lbl: { fontWeight: '800', fontSize: 13, marginBottom: 7, marginTop: 14, color: C.ink },
  input: { borderWidth: 2, borderColor: C.line, backgroundColor: '#FBFBFD', borderRadius: 14, padding: 14, fontSize: 16, color: C.ink },
});

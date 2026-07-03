import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, G } from '../theme';
import {
  genInitial, nextRound, roundComplete, tourStandings, teamStandings, names, pget,
  MODE_INFO, isPairs, isMexicano, POINT_TARGETS, EMOJIS, COLORS, Tournament, TourMode, Scoring,
} from '../logic';
import { Avatar, AvStack, Card, Btn, Chip, Badge, Segmented, Sheet, Empty, toast } from '../components';
import { useStore } from '../store';

const shuffle = <T,>(a: T[]): T[] => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const rand = <T,>(a: T[]) => a[Math.floor(Math.random() * a.length)];

export default function Tournaments() {
  const { data, meId, mutate } = useStore();
  const list = [...data.tournaments].sort((a, b) => b.createdAt - a.createdAt);

  const [newOpen, setNewOpen] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const cur = data.tournaments.find(t => t.id === openId) || null;

  // form
  const [name, setName] = useState('');
  const [mode, setMode] = useState<TourMode>('americano');
  const [scoring, setScoring] = useState<Scoring>('points');
  const [target, setTarget] = useState(24);
  const [rounds, setRounds] = useState(6);
  const [players, setPlayers] = useState<string[]>(meId ? [meId] : []);
  const [teams, setTeams] = useState<string[][]>([]);
  const [quick, setQuick] = useState('');
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});

  const info = MODE_INFO[mode];

  const resetForm = () => { setName(''); setPlayers(meId ? [meId] : []); setTeams([]); setQuick(''); };
  const openNew = () => { resetForm(); setNewOpen(true); };
  const togglePlayer = (id: string) => { setTeams([]); setPlayers(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id])); };
  const selectAll = () => { setTeams([]); setPlayers(data.players.map(p => p.id)); };
  const clearAll = () => { setTeams([]); setPlayers(meId ? [meId] : []); };

  const quickAdd = async () => {
    const nm = quick.trim(); if (!nm) return;
    setQuick('');
    const before = new Set(data.players.map(p => p.id));
    const fresh = await mutate('addPlayer', { name: nm, emoji: rand(EMOJIS), color: rand(COLORS) });
    const np = fresh.players.find(p => !before.has(p.id));
    if (np) { setTeams([]); setPlayers(p => [...p, np.id]); }
  };

  const makeTeams = () => {
    if (players.length < 2) return toast('Wybierz min. 4 graczy');
    if (players.length % 2) return toast('Parzysta liczba graczy do par (4, 6, 8…)');
    const sh = shuffle(players); const t: string[][] = [];
    for (let i = 0; i + 1 < sh.length; i += 2) t.push([sh[i], sh[i + 1]]);
    setTeams(t);
  };

  const create = async () => {
    let playerIds = players, tms: string[][] = [];
    if (info.pairs) {
      if (teams.length < 2) return toast('Ułóż min. 2 pary — kliknij „Ułóż pary losowo"');
      tms = teams; playerIds = teams.flat();
    } else {
      if (players.length < 4) return toast('Potrzeba min. 4 zawodników');
      if (players.length % 4 !== 0) return toast('Liczba zawodników = wielokrotność 4 (4, 8, 12…)');
    }
    const matches = genInitial({ mode, playerIds, teams: tms, rounds });
    if (!matches.length) return toast('Nie udało się ułożyć meczów');
    setNewOpen(false); toast('Turniej gotowy! 🎲');
    await mutate('addTournament', { name: name.trim() || info.name, mode, scoring, pointsTarget: target, weekly: false, rounds, playerIds, teams: tms, matches });
    resetForm();
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
  const genNext = async () => {
    if (!cur) return;
    // najpierw zapisz bieżące wyniki, potem dolicz kolejną rundę
    const saved = cur.matches.map(m => { const s = scores[m.id] || { a: '0', b: '0' }; const a = parseInt(s.a) || 0, b = parseInt(s.b) || 0; return { ...m, aScore: a, bScore: b, done: a + b > 0 }; });
    const nm = nextRound({ ...cur, matches: saved });
    if (!nm.length) return toast('Nie ma z czego ułożyć rundy');
    await mutate('updateTournament', { id: cur.id, matches: [...saved, ...nm] });
    toast('Nowa runda gotowa! 🎲');
  };
  const finish = async () => { if (cur) { await mutate('updateTournament', { id: cur.id, status: 'done' }); setOpenId(null); toast('🏁 Turniej zakończony!'); } };

  const rounds_ = cur ? [...new Set(cur.matches.map(m => m.round))].sort((a, b) => a - b) : [];
  const lastRound = rounds_.length ? rounds_[rounds_.length - 1] : 0;
  const standRows = cur ? (isPairs(cur.mode)
    ? teamStandings(cur).map(s => ({ label: names(data, cur.teams![s.idx]), ids: cur.teams![s.idx], pts: s.pts, wins: s.wins, played: s.played }))
    : tourStandings(cur).map(s => ({ label: pget(data, s.id)?.name || '?', ids: [s.id], pts: s.pts, wins: s.wins, played: s.played }))) : [];

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={st.hero}><Text style={st.kick}>RYWALIZACJA</Text><Text style={st.h1}>Turnieje 🏆</Text></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Btn title="➕ Nowy turniej" grad="g2" onPress={openNew} />
        <View style={{ height: 12 }} />
        {list.length ? list.map(t => {
          const mi = MODE_INFO[t.mode] || MODE_INFO.americano;
          const scored = t.matches.filter(m => m.done).length;
          const winRow = t.status === 'done' ? (isPairs(t.mode) ? teamStandings(t)[0] && names(data, t.teams![teamStandings(t)[0].idx]) : pget(data, tourStandings(t)[0]?.id)?.name) : null;
          return (
            <Pressable key={t.id} onPress={() => openTour(t)}>
              <Card style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>{t.name}</Text>
                    <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 2 }}>{mi.emoji} {mi.name} · {t.scoring === 'points' ? `do ${t.pointsTarget} pkt` : 'na sety'}</Text>
                  </View>
                  <Badge label={t.status === 'done' ? 'ZAKOŃCZONY' : 'TRWA'} tone={t.status === 'done' ? 'done' : 'live'} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <AvStack data={data} ids={t.playerIds.slice(0, 6)} />
                  <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800' }}>{winRow ? `🥇 ${winRow}` : `${scored}/${t.matches.length} meczów`}</Text>
                </View>
              </Card>
            </Pressable>
          );
        }) : <Empty emoji="🏆" text={'Brak turniejów.\nOdpal Americano albo Mexicano dla ekipy!'} />}
      </ScrollView>

      {/* ====== NOWY TURNIEJ ====== */}
      <Sheet visible={newOpen} onClose={() => setNewOpen(false)} title="🏆 Nowy turniej" sub="Wybierz tryb i skonfiguruj pod ekipę.">
        <Text style={st.lbl}>Nazwa</Text>
        <TextInput value={name} onChangeText={setName} placeholder="np. Liga Środowa #4" placeholderTextColor={C.muted} style={st.input} />

        <Text style={st.lbl}>Tryb turnieju</Text>
        {(Object.keys(MODE_INFO) as TourMode[]).map(m => {
          const mi = MODE_INFO[m]; const on = mode === m;
          return (
            <Pressable key={m} onPress={() => { setMode(m); setTeams([]); }} style={[st.modeCard, on && { borderColor: C.amber, backgroundColor: '#FFF6E9' }]}>
              <Text style={{ fontSize: 22, marginRight: 10 }}>{mi.emoji}</Text>
              <View style={{ flex: 1 }}>
                <Text style={{ fontWeight: '900', color: C.ink }}>{mi.name}</Text>
                <Text style={{ fontSize: 12, color: C.muted, fontWeight: '600' }}>{mi.desc}</Text>
              </View>
              {on && <Text style={{ color: C.amber, fontWeight: '900', fontSize: 18 }}>✓</Text>}
            </Pressable>
          );
        })}

        <Text style={st.lbl}>Punktacja meczu</Text>
        <Segmented options={[{ k: 'points', label: '🎯 Do punktów' }, { k: 'classic', label: '🎾 Na sety' }]} value={scoring} onChange={v => setScoring(v as Scoring)} />
        {scoring === 'points' && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {POINT_TARGETS.map(p => (
              <Pressable key={p} onPress={() => setTarget(p)} style={[st.pt, target === p && { borderColor: C.amber, backgroundColor: '#FFF6E9' }]}>
                <Text style={{ fontWeight: '900', color: target === p ? C.amber : C.ink }}>{p}</Text>
              </Pressable>
            ))}
          </View>
        )}

        {!isMexicano(mode) && (
          <>
            <Text style={st.lbl}>Liczba rund: {rounds}</Text>
            <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Pressable onPress={() => setRounds(r => Math.max(1, r - 1))} style={st.step}><Text style={st.stepT}>−</Text></Pressable>
              <Text style={{ fontWeight: '900', fontSize: 18, width: 30, textAlign: 'center' }}>{rounds}</Text>
              <Pressable onPress={() => setRounds(r => Math.min(15, r + 1))} style={st.step}><Text style={st.stepT}>＋</Text></Pressable>
            </View>
          </>
        )}
        {isMexicano(mode) && <Text style={[st.hintBox]}>🌶️ Mexicano: rundy dogrywasz na bieżąco — kolejne pary układają się wg rankingu po każdej rundzie.</Text>}

        <Text style={st.lbl}>Zawodnicy ({players.length})</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <TextInput value={quick} onChangeText={setQuick} onSubmitEditing={quickAdd} returnKeyType="done" placeholder="Dopisz ksywę…" placeholderTextColor={C.muted} style={[st.input, { flex: 1, marginBottom: 0 }]} />
          <Btn title="+ Dodaj" grad="g1" small onPress={quickAdd} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Btn title="Wszyscy" ghost small onPress={selectAll} />
          <Btn title="Wyczyść" ghost small onPress={clearAll} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {data.players.map(p => <Chip key={p.id} p={p} label={p.name} active={players.includes(p.id)} onPress={() => togglePlayer(p.id)} />)}
        </View>

        {info.pairs && (
          <>
            <Text style={st.lbl}>Pary ({teams.length})</Text>
            <Btn title="🎲 Ułóż pary losowo" ghost small onPress={makeTeams} style={{ marginBottom: 10 }} />
            {teams.map((tm, i) => (
              <View key={i} style={st.pairRow}>
                <Text style={{ fontWeight: '900', color: C.muted, width: 26 }}>{i + 1}.</Text>
                <Avatar p={pget(data, tm[0])} size={26} /><Text style={{ fontWeight: '800', marginHorizontal: 6, color: C.ink }}>{pget(data, tm[0])?.name}</Text>
                <Text style={{ color: C.muted, fontWeight: '900' }}>+</Text>
                <Avatar p={pget(data, tm[1])} size={26} /><Text style={{ fontWeight: '800', marginLeft: 6, color: C.ink }}>{pget(data, tm[1])?.name}</Text>
              </View>
            ))}
          </>
        )}

        <View style={{ height: 16 }} />
        <Btn title="Wygeneruj drabinkę 🎲" grad="g2" onPress={create} />
      </Sheet>

      {/* ====== SZCZEGÓŁY TURNIEJU ====== */}
      <Sheet visible={!!cur} onClose={() => setOpenId(null)} title={cur ? `${MODE_INFO[cur.mode].emoji} ${cur.name}` : ''} sub={cur ? `${MODE_INFO[cur.mode].name} · ${cur.scoring === 'points' ? `do ${cur.pointsTarget} pkt` : 'na sety'} · ${isPairs(cur.mode) ? `${cur.teams?.length} par` : `${cur.playerIds.length} graczy`}` : ''}>
        {cur && <>
          <Text style={st.section}>📊 KLASYFIKACJA</Text>
          <Card style={{ paddingVertical: 6, marginBottom: 8 }}>
            {standRows.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
                <Text style={{ width: 28, textAlign: 'center', fontWeight: '900', color: i < 3 ? [C.gold, '#9AA7B5', '#C98A4B'][i] : C.muted }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</Text>
                <AvStack data={data} ids={s.ids} size={28} />
                <Text style={{ flex: 1, marginLeft: 10, fontWeight: '800', color: C.ink }}>{s.label}</Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={{ fontWeight: '900', color: C.ink }}>{cur.scoring === 'points' ? `${s.pts} pkt` : `${s.wins} W`}</Text>
                  <Text style={{ fontSize: 11, color: C.muted, fontWeight: '700' }}>{cur.scoring === 'points' ? `${s.wins}W · ${s.played} gier` : `${s.pts} pkt`}</Text>
                </View>
              </View>
            ))}
          </Card>

          {cur.status === 'done' ? (
            <LinearGradient colors={G.g5} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 16, alignItems: 'center', marginTop: 8 }}>
              <Text style={{ fontSize: 34 }}>🥇</Text>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 18 }}>{standRows[0]?.label || '—'}</Text>
              <Text style={{ color: '#fff', opacity: 0.9, fontWeight: '700' }}>Zwycięzca · {cur.scoring === 'points' ? `${standRows[0]?.pts || 0} pkt` : `${standRows[0]?.wins || 0} W`}</Text>
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
            {isMexicano(cur.mode) && (
              roundComplete({ ...cur, matches: cur.matches.map(m => { const s = scores[m.id]; return s ? { ...m, aScore: parseInt(s.a) || 0, bScore: parseInt(s.b) || 0, done: (parseInt(s.a) || 0) + (parseInt(s.b) || 0) > 0 } : m; }) }, lastRound)
                ? <Btn title={`🎲 Wygeneruj rundę ${lastRound + 1}`} grad="g2" style={{ marginTop: 10 }} onPress={genNext} />
                : <Text style={st.hintBox}>Wpisz i zapisz wyniki rundy {lastRound}, żeby wygenerować kolejną (pary ułożą się wg rankingu).</Text>
            )}
            <Btn title="🏁 Zakończ turniej" ghost style={{ marginTop: 10 }} onPress={finish} />
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
  lbl: { fontWeight: '800', fontSize: 13, marginBottom: 7, marginTop: 16, color: C.ink },
  section: { fontSize: 14, fontWeight: '900', color: C.ink, marginTop: 8, marginBottom: 8 },
  input: { borderWidth: 2, borderColor: C.line, backgroundColor: '#FBFBFD', borderRadius: 14, padding: 14, fontSize: 16, color: C.ink },
  modeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 2, borderColor: C.line, borderRadius: 16, padding: 12, marginBottom: 8 },
  pt: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: C.line, backgroundColor: '#fff' },
  pairRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 8, marginBottom: 6, ...({}) },
  scoreInput: { width: 46, textAlign: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 2, borderColor: C.line, fontWeight: '900', fontSize: 17, color: C.ink },
  step: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0F1F5', alignItems: 'center', justifyContent: 'center' },
  stepT: { fontSize: 22, fontWeight: '900', color: C.ink },
  hintBox: { backgroundColor: '#FFF6E9', color: '#8A6D3B', fontSize: 12, fontWeight: '700', padding: 12, borderRadius: 12, marginTop: 10 },
});

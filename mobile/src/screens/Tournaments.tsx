import React, { useState } from 'react';
import { View, Text, ScrollView, TextInput, Pressable, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, G } from '../theme';
import {
  genInitial, nextRound, maxRound, roundComplete, sittingOut, tourStandings, teamStandings, names, pget,
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
  const [courts, setCourts] = useState(1);
  const [courtsAuto, setCourtsAuto] = useState(true);
  const [players, setPlayers] = useState<string[]>(meId ? [meId] : []);
  const [teams, setTeams] = useState<string[][]>([]);
  const [quick, setQuick] = useState('');
  const [scores, setScores] = useState<Record<string, { a: string; b: string }>>({});
  const [showHist, setShowHist] = useState(false);

  const info = MODE_INFO[mode];

  const setPlayersSmart = (upd: (p: string[]) => string[]) => {
    setPlayers(prev => { const next = upd(prev); if (courtsAuto) setCourts(Math.max(1, Math.floor((info.pairs ? teams.flat().length : next.length) / 4) || 1)); return next; });
  };
  const resetForm = () => { setName(''); setPlayers(meId ? [meId] : []); setTeams([]); setQuick(''); setCourts(1); setCourtsAuto(true); };
  const openNew = () => { resetForm(); setNewOpen(true); };
  const togglePlayer = (id: string) => { setTeams([]); setPlayersSmart(p => (p.includes(id) ? p.filter(x => x !== id) : [...p, id])); };
  const selectAll = () => { setTeams([]); setPlayersSmart(() => data.players.map(p => p.id)); };
  const clearAll = () => { setTeams([]); setPlayersSmart(() => (meId ? [meId] : [])); };

  const quickAdd = async () => {
    const nm = quick.trim(); if (!nm) return; setQuick('');
    const before = new Set(data.players.map(p => p.id));
    const fresh = await mutate('addPlayer', { name: nm, emoji: rand(EMOJIS), color: rand(COLORS) });
    const np = fresh.players.find(p => !before.has(p.id));
    if (np) { setTeams([]); setPlayersSmart(p => [...p, np.id]); }
  };
  const makeTeams = () => {
    if (players.length < 4 || players.length % 2) return toast('Parzysta liczba graczy do par (4, 6, 8…)');
    const sh = shuffle(players); const t: string[][] = [];
    for (let i = 0; i + 1 < sh.length; i += 2) t.push([sh[i], sh[i + 1]]);
    setTeams(t); if (courtsAuto) setCourts(Math.max(1, Math.floor(t.length / 2) || 1));
  };

  const create = async () => {
    let playerIds = players, tms: string[][] = [];
    if (info.pairs) { if (teams.length < 2) return toast('Ułóż min. 2 pary — „Ułóż pary losowo"'); tms = teams; playerIds = teams.flat(); }
    else if (players.length < 4) return toast('Potrzeba min. 4 zawodników');
    const base = { mode, scoring, playerIds, teams: tms, courts, matches: [] as any[] };
    const matches = genInitial(base);
    if (!matches.length) return toast('Za mało zawodników na ten tryb');
    setNewOpen(false); toast('Turniej ruszył! 🎲');
    await mutate('addTournament', { name: name.trim() || info.name, mode, scoring, pointsTarget: target, weekly: false, rounds: 0, courts, playerIds, teams: tms, matches });
    resetForm();
  };

  const openTour = (t: Tournament) => {
    const buf: Record<string, { a: string; b: string }> = {};
    t.matches.forEach(m => (buf[m.id] = { a: String(m.aScore), b: String(m.bScore) }));
    setScores(buf); setShowHist(false); setOpenId(t.id);
  };
  const applyScores = (t: Tournament) => t.matches.map(m => { const s = scores[m.id] || { a: '0', b: '0' }; const a = parseInt(s.a) || 0, b = parseInt(s.b) || 0; return { ...m, aScore: a, bScore: b, done: a + b > 0 }; });
  const saveScores = async () => { if (!cur) return; await mutate('updateTournament', { id: cur.id, matches: applyScores(cur) }); toast('Zapisane 💾'); };
  const genNext = async () => {
    if (!cur) return;
    const saved = applyScores(cur);
    const nm = nextRound({ ...cur, matches: saved });
    if (!nm.length) return toast('Nie ma z czego ułożyć rundy');
    await mutate('updateTournament', { id: cur.id, matches: [...saved, ...nm] });
    toast('Nowa runda! 🎲');
  };
  const finish = async () => { if (cur) { await mutate('updateTournament', { id: cur.id, status: 'done', matches: applyScores(cur) }); setOpenId(null); toast('🏁 Koniec turnieju!'); } };

  const mr = cur ? maxRound(cur) : 0;
  const roundDone = cur ? roundComplete({ ...cur, matches: applyScores(cur) }, mr) : false;
  const sitting = cur ? sittingOut(cur, mr) : [];
  const standRows = cur ? (isPairs(cur.mode)
    ? teamStandings(cur).map(s => ({ label: names(data, cur.teams![s.idx]), ids: cur.teams![s.idx], pts: s.pts, wins: s.wins, played: s.played }))
    : tourStandings(cur).map(s => ({ label: pget(data, s.id)?.name || '?', ids: [s.id], pts: s.pts, wins: s.wins, played: s.played }))) : [];
  const pastRounds = cur ? [...new Set(cur.matches.map(m => m.round))].filter(r => r < mr).sort((a, b) => b - a) : [];

  const MatchRow = ({ m, editable }: { m: any; editable: boolean }) => (
    <Card style={{ marginBottom: 10, paddingVertical: 12 }}>
      {m.court ? <Text style={{ fontSize: 11, fontWeight: '900', color: C.teal, marginBottom: 6 }}>🎾 KORT {m.court}</Text> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Text style={{ flex: 1, fontWeight: '800', fontSize: 13, color: C.ink }}>{names(data, m.aIds)}</Text>
        {editable ? <>
          <TextInput value={scores[m.id]?.a ?? '0'} onChangeText={v => setScores(s => ({ ...s, [m.id]: { a: v, b: s[m.id]?.b ?? '0' } }))} keyboardType="number-pad" style={st.scoreInput} />
          <Text style={{ fontWeight: '900', color: C.muted }}>:</Text>
          <TextInput value={scores[m.id]?.b ?? '0'} onChangeText={v => setScores(s => ({ ...s, [m.id]: { a: s[m.id]?.a ?? '0', b: v } }))} keyboardType="number-pad" style={st.scoreInput} />
        </> : <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>{m.aScore} : {m.bScore}</Text>}
        <Text style={{ flex: 1, textAlign: 'right', fontWeight: '800', fontSize: 13, color: C.ink }}>{names(data, m.bIds)}</Text>
      </View>
    </Card>
  );

  return (
    <View style={{ flex: 1, backgroundColor: C.bg }}>
      <View style={st.hero}><Text style={st.kick}>RYWALIZACJA</Text><Text style={st.h1}>Turnieje 🏆</Text></View>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
        <Btn title="➕ Nowy turniej" grad="g2" onPress={openNew} />
        <View style={{ height: 12 }} />
        {list.length ? list.map(t => {
          const mi = MODE_INFO[t.mode] || MODE_INFO.americano;
          const win = t.status === 'done' ? (isPairs(t.mode) ? teamStandings(t)[0] && names(data, t.teams![teamStandings(t)[0].idx]) : pget(data, tourStandings(t)[0]?.id)?.name) : null;
          return (
            <Pressable key={t.id} onPress={() => openTour(t)}>
              <Card style={{ marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 }}>
                  <View style={{ flex: 1, paddingRight: 8 }}>
                    <Text style={{ fontWeight: '900', fontSize: 17, color: C.ink }}>{t.name}</Text>
                    <Text style={{ color: C.muted, fontSize: 12, fontWeight: '700', marginTop: 2 }}>{mi.emoji} {mi.name} · {t.scoring === 'points' ? `do ${t.pointsTarget}` : 'sety'} · {t.courts || 1} kort{(t.courts || 1) > 1 ? 'y' : ''}</Text>
                  </View>
                  <Badge label={t.status === 'done' ? 'KONIEC' : `RUNDA ${maxRound(t)}`} tone={t.status === 'done' ? 'done' : 'live'} />
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <AvStack data={data} ids={t.playerIds.slice(0, 7)} />
                  <Text style={{ color: C.muted, fontSize: 12, fontWeight: '800' }}>{win ? `🥇 ${win}` : `${t.playerIds.length} graczy`}</Text>
                </View>
              </Card>
            </Pressable>
          );
        }) : <Empty emoji="🏆" text={'Brak turniejów.\nOdpal Americano albo Mexicano dla ekipy!'} />}
      </ScrollView>

      {/* ====== NOWY TURNIEJ ====== */}
      <Sheet visible={newOpen} onClose={() => setNewOpen(false)} title="🏆 Nowy turniej" sub="Rundy losują się na bieżąco — nic nie ustawiasz z góry.">
        <Text style={st.lbl}>Nazwa</Text>
        <TextInput value={name} onChangeText={setName} placeholder="np. Środowe Americano" placeholderTextColor={C.muted} style={st.input} />

        <Text style={st.lbl}>Tryb</Text>
        {(Object.keys(MODE_INFO) as TourMode[]).map(m => {
          const mi = MODE_INFO[m]; const on = mode === m;
          return (
            <Pressable key={m} onPress={() => { setMode(m); setTeams([]); }} style={[st.modeCard, on && { borderColor: C.amber, backgroundColor: '#FFF6E9' }]}>
              <Text style={{ fontSize: 22, marginRight: 10 }}>{mi.emoji}</Text>
              <View style={{ flex: 1 }}><Text style={{ fontWeight: '900', color: C.ink }}>{mi.name}</Text><Text style={{ fontSize: 12, color: C.muted, fontWeight: '600' }}>{mi.desc}</Text></View>
              {on && <Text style={{ color: C.amber, fontWeight: '900', fontSize: 18 }}>✓</Text>}
            </Pressable>
          );
        })}

        <Text style={st.lbl}>Punktacja meczu</Text>
        <Segmented options={[{ k: 'points', label: '🎯 Do punktów' }, { k: 'classic', label: '🎾 Na sety' }]} value={scoring} onChange={v => setScoring(v as Scoring)} />
        {scoring === 'points' && (
          <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
            {POINT_TARGETS.map(p => (<Pressable key={p} onPress={() => setTarget(p)} style={[st.pt, target === p && { borderColor: C.amber, backgroundColor: '#FFF6E9' }]}><Text style={{ fontWeight: '900', color: target === p ? C.amber : C.ink }}>{p}</Text></Pressable>))}
          </View>
        )}

        <Text style={st.lbl}>Liczba kortów: {courts} <Text style={{ color: C.muted, fontWeight: '600' }}>({courts * 4} graczy naraz)</Text></Text>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
          <Pressable onPress={() => { setCourtsAuto(false); setCourts(c => Math.max(1, c - 1)); }} style={st.step}><Text style={st.stepT}>−</Text></Pressable>
          <Text style={{ fontWeight: '900', fontSize: 18, width: 30, textAlign: 'center' }}>{courts}</Text>
          <Pressable onPress={() => { setCourtsAuto(false); setCourts(c => Math.min(8, c + 1)); }} style={st.step}><Text style={st.stepT}>＋</Text></Pressable>
          <Text style={{ color: C.muted, fontSize: 12, fontWeight: '600', flex: 1 }}>Reszta pauzuje rotacyjnie</Text>
        </View>

        <Text style={st.lbl}>Zawodnicy ({players.length})</Text>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <TextInput value={quick} onChangeText={setQuick} onSubmitEditing={quickAdd} returnKeyType="done" placeholder="Dopisz gracza…" placeholderTextColor={C.muted} style={[st.input, { flex: 1, marginBottom: 0 }]} />
          <Btn title="+ Dodaj" grad="g1" small onPress={quickAdd} />
        </View>
        <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
          <Btn title="Wszyscy" ghost small onPress={selectAll} />
          <Btn title="Wyczyść" ghost small onPress={clearAll} />
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {data.players.map(p => <Chip key={p.id} p={p} label={p.name} active={players.includes(p.id)} onPress={() => togglePlayer(p.id)} />)}
        </View>

        {info.pairs && (<>
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
        </>)}

        <View style={{ height: 16 }} />
        <Btn title="Start turnieju 🎲" grad="g2" onPress={create} />
      </Sheet>

      {/* ====== TURNIEJ NA ŻYWO ====== */}
      <Sheet visible={!!cur} onClose={() => setOpenId(null)} title={cur ? `${MODE_INFO[cur.mode].emoji} ${cur.name}` : ''} sub={cur ? `${MODE_INFO[cur.mode].name} · ${cur.scoring === 'points' ? `do ${cur.pointsTarget}` : 'sety'} · ${cur.courts || 1} kort${(cur.courts || 1) > 1 ? 'y' : ''}` : ''}>
        {cur && <>
          {/* ŻYWA TABELA */}
          <LinearGradient colors={G.g4} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 12, marginBottom: 14 }}>
            <Text style={{ color: '#fff', fontWeight: '900', fontSize: 13, marginBottom: 8, opacity: 0.9 }}>📊 TABELA NA ŻYWO</Text>
            {standRows.map((s, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 5 }}>
                <Text style={{ width: 26, textAlign: 'center', fontWeight: '900', color: '#fff' }}>{i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</Text>
                <AvStack data={data} ids={s.ids} size={24} />
                <Text style={{ flex: 1, marginLeft: 8, fontWeight: '800', color: '#fff' }} numberOfLines={1}>{s.label}</Text>
                <Text style={{ fontWeight: '900', color: '#fff' }}>{cur.scoring === 'points' ? `${s.pts}` : `${s.wins}W`}</Text>
              </View>
            ))}
          </LinearGradient>

          {cur.status === 'done' ? (
            <LinearGradient colors={G.g5} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, padding: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 40 }}>🏆</Text>
              <Text style={{ color: '#fff', fontWeight: '900', fontSize: 20 }}>{standRows[0]?.label || '—'}</Text>
              <Text style={{ color: '#fff', opacity: 0.9, fontWeight: '700' }}>Zwycięzca · {cur.scoring === 'points' ? `${standRows[0]?.pts || 0} pkt` : `${standRows[0]?.wins || 0} W`}</Text>
            </LinearGradient>
          ) : <>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ fontSize: 16, fontWeight: '900', color: C.ink }}>🎾 Runda {mr}</Text>
              {roundDone && <Badge label="RUNDA ZAKOŃCZONA" tone="open" />}
            </View>
            {sitting.length > 0 && <Text style={st.sitOut}>⏸️ Pauzują: {names(data, sitting)}</Text>}
            {cur.matches.filter(m => m.round === mr).map(m => <MatchRow key={m.id} m={m} editable />)}

            <Btn title="💾 Zapisz wyniki" grad="g3" onPress={saveScores} />
            <Btn title={`🎲 Losuj rundę ${mr + 1}`} grad="g2" style={{ marginTop: 10, opacity: roundDone ? 1 : 0.5 }} onPress={roundDone ? genNext : () => toast('Najpierw wpisz wyniki tej rundy')} />

            {pastRounds.length > 0 && (
              <Pressable onPress={() => setShowHist(h => !h)} style={{ marginTop: 16, paddingVertical: 8 }}>
                <Text style={{ fontWeight: '800', color: C.muted, textAlign: 'center' }}>{showHist ? '▲ Ukryj poprzednie rundy' : `▼ Poprzednie rundy (${pastRounds.length})`}</Text>
              </Pressable>
            )}
            {showHist && pastRounds.map(r => (
              <View key={r}>
                <Text style={{ fontSize: 12, fontWeight: '900', color: C.muted, marginTop: 8, marginBottom: 4 }}>RUNDA {r}</Text>
                {cur.matches.filter(m => m.round === r).map(m => <MatchRow key={m.id} m={m} editable={false} />)}
              </View>
            ))}

            <Btn title="🏁 Zakończ turniej" ghost style={{ marginTop: 14 }} onPress={finish} />
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
  input: { borderWidth: 2, borderColor: C.line, backgroundColor: '#FBFBFD', borderRadius: 14, padding: 14, fontSize: 16, color: C.ink },
  modeCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderWidth: 2, borderColor: C.line, borderRadius: 16, padding: 12, marginBottom: 8 },
  pt: { flex: 1, alignItems: 'center', paddingVertical: 12, borderRadius: 12, borderWidth: 2, borderColor: C.line, backgroundColor: '#fff' },
  pairRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', borderRadius: 12, padding: 8, marginBottom: 6 },
  scoreInput: { width: 46, textAlign: 'center', paddingVertical: 8, borderRadius: 10, borderWidth: 2, borderColor: C.line, fontWeight: '900', fontSize: 17, color: C.ink },
  step: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#F0F1F5', alignItems: 'center', justifyContent: 'center' },
  stepT: { fontSize: 22, fontWeight: '900', color: C.ink },
  sitOut: { backgroundColor: '#F0F1F5', color: C.muted, fontSize: 12, fontWeight: '700', padding: 10, borderRadius: 12, marginBottom: 10 },
});

import React from 'react';
import { View, Text, Pressable, Modal, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { C, G, shadow } from './theme';
import { Player, Data } from './logic';

/* ---------- toast (global) ---------- */
let _show: ((m: string) => void) | null = null;
export const registerToast = (fn: (m: string) => void) => (_show = fn);
export const toast = (m: string) => _show && _show(m);

export function Avatar({ p, size = 40 }: { p?: Player; size?: number }) {
  if (!p) return null;
  return (
    <View style={{ width: size, height: size, borderRadius: size * 0.34, backgroundColor: p.color + '22', alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontSize: size * 0.5 }}>{p.emoji}</Text>
    </View>
  );
}

export function AvStack({ data, ids, size = 30 }: { data: Data; ids: string[]; size?: number }) {
  return (
    <View style={{ flexDirection: 'row' }}>
      {ids.map((id, i) => {
        const p = data.players.find(x => x.id === id);
        return <View key={id} style={{ marginLeft: i ? -8 : 0, borderRadius: size * 0.34, borderWidth: 2, borderColor: '#fff' }}><Avatar p={p} size={size} /></View>;
      })}
    </View>
  );
}

export function Hero({ grad = 'g1', kick, title, right }: { grad?: string; kick: string; title: string; right?: React.ReactNode }) {
  return (
    <LinearGradient colors={G[grad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={st.hero}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flex: 1 }}>
          <Text style={st.kick}>{kick}</Text>
          <Text style={st.h1}>{title}</Text>
        </View>
        {right}
      </View>
    </LinearGradient>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[st.card, style]}>{children}</View>;
}

export function Btn({ title, onPress, grad, ghost, small, style, textStyle }: { title: string; onPress?: () => void; grad?: string; ghost?: boolean; small?: boolean; style?: ViewStyle; textStyle?: any }) {
  const pad = small ? { paddingVertical: 10, paddingHorizontal: 14 } : { paddingVertical: 14, paddingHorizontal: 18 };
  const inner = <Text style={[{ color: ghost ? C.ink : '#fff', fontWeight: '800', fontSize: small ? 14 : 15, textAlign: 'center' }, textStyle]}>{title}</Text>;
  if (grad) {
    return (
      <Pressable onPress={onPress} style={({ pressed }) => [{ borderRadius: 16, overflow: 'hidden', opacity: pressed ? 0.9 : 1 }, shadow, style]}>
        <LinearGradient colors={G[grad]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[pad, { alignItems: 'center', borderRadius: 16 }]}>{inner}</LinearGradient>
      </Pressable>
    );
  }
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pad, { borderRadius: 16, alignItems: 'center', opacity: pressed ? 0.9 : 1, backgroundColor: ghost ? '#fff' : C.ink, borderWidth: ghost ? 2 : 0, borderColor: C.line }, ghost ? {} : shadow, style]}>
      {inner}
    </Pressable>
  );
}

export function Chip({ label, p, active, tone, onPress }: { label: string; p?: Player; active?: boolean; tone?: 'a' | 'b'; onPress?: () => void }) {
  const activeColor = tone === 'a' ? C.blue : tone === 'b' ? C.coral : C.purple;
  const activeBg = tone === 'a' ? '#EAF1FF' : tone === 'b' ? '#FFECEC' : '#F1EFFE';
  return (
    <Pressable onPress={onPress} style={[st.chip, active && { borderColor: activeColor, backgroundColor: activeBg }]}>
      {p && <Avatar p={p} size={24} />}
      <Text style={{ fontWeight: '800', fontSize: 14, color: active ? activeColor : C.ink }}>{label}</Text>
    </Pressable>
  );
}

export function Badge({ label, tone }: { label: string; tone: 'amer' | 'klas' | 'open' | 'live' | 'done' }) {
  const map: Record<string, [string, string]> = { amer: ['#E7F7EF', C.teal], klas: ['#EAF1FF', C.blue], open: ['#E7F7EF', C.teal], live: ['#FFECEC', C.coral], done: ['#F0F1F5', C.muted] };
  const [bg, fg] = map[tone];
  return <View style={{ backgroundColor: bg, borderRadius: 999, paddingVertical: 4, paddingHorizontal: 9 }}><Text style={{ color: fg, fontWeight: '900', fontSize: 11 }}>{label}</Text></View>;
}

export function Segmented({ options, value, onChange, scroll }: { options: { k: string; label: string }[]; value: string; onChange: (k: string) => void; scroll?: boolean }) {
  if (scroll) {
    return (
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map(o => (
          <Pressable key={o.k} onPress={() => onChange(o.k)} style={[{ paddingVertical: 9, paddingHorizontal: 14, borderRadius: 12, backgroundColor: value === o.k ? '#fff' : '#EDEEF4' }, value === o.k ? shadow : null]}>
            <Text numberOfLines={1} style={{ fontWeight: '800', fontSize: 13, color: value === o.k ? C.ink : C.muted }}>{o.label}</Text>
          </Pressable>
        ))}
      </View>
    );
  }
  return (
    <View style={st.seg}>
      {options.map(o => (
        <Pressable key={o.k} onPress={() => onChange(o.k)} style={[st.segBtn, value === o.k && st.segBtnOn]}>
          <Text numberOfLines={1} style={{ fontWeight: '800', fontSize: 13, color: value === o.k ? C.ink : C.muted }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Tile({ n, l, color }: { n: string; l: string; color?: string }) {
  return (
    <View style={[st.tile, shadow]}>
      <Text style={{ fontSize: 22, fontWeight: '900', color: color || C.ink }}>{n}</Text>
      <Text style={{ fontSize: 10, fontWeight: '800', color: C.muted, marginTop: 2, textTransform: 'uppercase' }}>{l}</Text>
    </View>
  );
}

export function Sheet({ visible, onClose, title, sub, children }: { visible: boolean; onClose: () => void; title: string; sub?: string; children: React.ReactNode }) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={st.ov} onPress={onClose} />
      <View style={st.sheet}>
        <View style={st.grip} />
        <Text style={{ fontSize: 20, fontWeight: '900', color: C.ink }}>{title}</Text>
        {sub ? <Text style={{ color: C.muted, fontWeight: '600', fontSize: 14, marginTop: 2, marginBottom: 12 }}>{sub}</Text> : <View style={{ height: 12 }} />}
        <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 520 }}>{children}</ScrollView>
      </View>
    </Modal>
  );
}

export function RowLabel({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10, marginTop: 18 }}>
      <Text style={{ fontSize: 16, fontWeight: '900', color: C.ink }}>{title}</Text>
      {right}
    </View>
  );
}

export function Empty({ emoji, text }: { emoji: string; text: string }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 26 }}>
      <Text style={{ fontSize: 40, marginBottom: 8 }}>{emoji}</Text>
      <Text style={{ color: C.muted, fontWeight: '600', textAlign: 'center' }}>{text}</Text>
    </Card>
  );
}

const st = StyleSheet.create({
  hero: { paddingTop: 20, paddingBottom: 20, paddingHorizontal: 16, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 },
  kick: { color: '#fff', opacity: 0.85, fontSize: 12, fontWeight: '800', letterSpacing: 1.5, textTransform: 'uppercase' },
  h1: { color: '#fff', fontSize: 26, fontWeight: '900', marginTop: 3, letterSpacing: -0.5 },
  card: { backgroundColor: C.card, borderRadius: 20, padding: 16, ...shadow },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: '#fff', borderWidth: 2, borderColor: C.line, borderRadius: 999, paddingVertical: 6, paddingLeft: 6, paddingRight: 12 },
  seg: { flexDirection: 'row', backgroundColor: '#EDEEF4', borderRadius: 14, padding: 4, gap: 4 },
  segBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 11, alignItems: 'center' },
  segBtnOn: { backgroundColor: '#fff', ...shadow, shadowRadius: 8 },
  tile: { flex: 1, backgroundColor: C.card, borderRadius: 18, paddingVertical: 14, alignItems: 'center' },
  ov: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(20,22,28,0.5)' },
  sheet: { position: 'absolute', bottom: 0, left: 0, right: 0, backgroundColor: C.bg, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16, paddingBottom: 32 },
  grip: { width: 44, height: 5, borderRadius: 3, backgroundColor: '#D5D7E0', alignSelf: 'center', marginBottom: 14 },
});

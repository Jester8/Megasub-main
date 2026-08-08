import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Modal,
  FlatList,
  ActivityIndicator,
} from 'react-native';
import { Ionicons, Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Contacts from 'expo-contacts';

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

const BRAND = '#4A55DD';

// Normalizes a picked number to the local leading-zero format the buy
// endpoints expect: strips spaces/dashes/parens, converts +234/234 to 0.
export function normalizePhone(raw) {
  let n = (raw || '').replace(/[\s\-().]/g, '');
  if (n.startsWith('+234')) n = `0${n.slice(4)}`;
  else if (n.startsWith('234') && n.length > 10) n = `0${n.slice(3)}`;
  return n;
}

// Full-screen contact picker shared by Airtime/Data (single select) and
// Bulk Recharge (multi select). onDone receives an array of phone numbers —
// length 1 in single mode.
export default function ContactPicker({ visible, onClose, onDone, colors, multi }) {
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [denied, setDenied] = useState(false);
  const [contacts, setContacts] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({}); // id -> phone

  useEffect(() => {
    if (!visible) return;
    setSelected({});
    setSearch('');
    let cancelled = false;
    (async () => {
      setLoading(true);
      setDenied(false);
      try {
        const { status } = await Contacts.requestPermissionsAsync();
        if (cancelled) return;
        if (status !== 'granted') {
          setDenied(true);
          return;
        }
        const { data } = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.PhoneNumbers],
          sort: Contacts.SortTypes.FirstName,
        });
        if (cancelled) return;
        const withPhones = (data || [])
          .filter((c) => c.phoneNumbers?.length)
          .map((c) => ({
            id: c.id,
            name: c.name || 'Unknown',
            phone: normalizePhone(c.phoneNumbers[0].number),
          }))
          .filter((c) => c.phone.length >= 7);
        setContacts(withPhones);
      } catch (error) {
        setDenied(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [visible]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return contacts;
    return contacts.filter((c) => c.name.toLowerCase().includes(q) || c.phone.includes(q));
  }, [contacts, search]);

  const selectedCount = Object.keys(selected).length;

  const handlePress = (contact) => {
    if (!multi) {
      onDone([contact.phone]);
      onClose();
      return;
    }
    setSelected((prev) => {
      const next = { ...prev };
      if (next[contact.id]) delete next[contact.id];
      else next[contact.id] = contact.phone;
      return next;
    });
  };

  const handleDoneMulti = () => {
    onDone(Object.values(selected));
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
          <TouchableOpacity
            style={[styles.closeBtn, { backgroundColor: colors.card }]}
            onPress={onClose}
            activeOpacity={0.7}
          >
            <Feather name="x" size={20} color={colors.text} />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, { color: colors.text }]}>
            {multi ? 'Select Contacts' : 'Select Contact'}
          </Text>
          <View style={{ width: 38 }} />
        </View>

        <View style={[styles.searchCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Feather name="search" size={16} color={colors.textFaint} />
          <TextInput
            style={[styles.searchInput, { color: colors.text }]}
            placeholder="Search name or number"
            placeholderTextColor={colors.textFaint}
            value={search}
            onChangeText={setSearch}
            autoCapitalize="none"
          />
        </View>

        {loading ? (
          <ActivityIndicator color={BRAND} style={styles.loader} />
        ) : denied ? (
          <View style={styles.emptyState}>
            <Ionicons name="lock-closed-outline" size={36} color="#B7BCEF" />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>Contacts access needed</Text>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Allow contact access in your phone settings to pick recipients from your contact list.
            </Text>
          </View>
        ) : filtered.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="users" size={36} color="#B7BCEF" />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No contacts found.</Text>
          </View>
        ) : (
          <FlatList
            data={filtered}
            keyExtractor={(item) => item.id}
            contentContainerStyle={[styles.list, { paddingBottom: insets.bottom + (multi ? 90 : 20) }]}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => {
              const isSelected = !!selected[item.id];
              return (
                <TouchableOpacity
                  style={[
                    styles.row,
                    { backgroundColor: colors.card, borderColor: colors.border },
                    isSelected && { borderColor: BRAND },
                  ]}
                  onPress={() => handlePress(item)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.avatar, isSelected && { backgroundColor: BRAND }]}>
                    {isSelected ? (
                      <Feather name="check" size={16} color="#FFFFFF" />
                    ) : (
                      <Text style={styles.avatarText}>{item.name.charAt(0).toUpperCase()}</Text>
                    )}
                  </View>
                  <View style={styles.rowInfo}>
                    <Text style={[styles.rowName, { color: colors.text }]} numberOfLines={1}>{item.name}</Text>
                    <Text style={[styles.rowPhone, { color: colors.textMuted }]} numberOfLines={1}>{item.phone}</Text>
                  </View>
                </TouchableOpacity>
              );
            }}
          />
        )}

        {multi && selectedCount > 0 ? (
          <View style={[styles.footer, { paddingBottom: insets.bottom + 12, backgroundColor: colors.background }]}>
            <TouchableOpacity style={styles.doneBtn} activeOpacity={0.85} onPress={handleDoneMulti}>
              <Text style={styles.doneBtnText}>
                Add {selectedCount} number{selectedCount === 1 ? '' : 's'}
              </Text>
            </TouchableOpacity>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  closeBtn: {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
    elevation: 2, shadowColor: '#0B0D1A', shadowOpacity: 0.06,
    shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16 },

  searchCard: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    marginHorizontal: 20, marginBottom: 12,
    borderRadius: 14, borderWidth: 1.5, paddingHorizontal: 14, height: 46,
  },
  searchInput: { flex: 1, fontFamily: FONTS.medium, fontSize: 13.5 },

  loader: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { paddingHorizontal: 20, gap: 10 },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    borderRadius: 14, borderWidth: 1.5, padding: 12,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(74,85,221,0.12)',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontFamily: FONTS.bold, fontSize: 15, color: BRAND },
  rowInfo: { flex: 1 },
  rowName: { fontFamily: FONTS.semibold, fontSize: 13.5, marginBottom: 2 },
  rowPhone: { fontFamily: FONTS.regular, fontSize: 12 },

  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 40, gap: 10 },
  emptyTitle: { fontFamily: FONTS.bold, fontSize: 15 },
  emptyText: { fontFamily: FONTS.medium, fontSize: 12.5, textAlign: 'center', lineHeight: 18 },

  footer: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 20, paddingTop: 12,
  },
  doneBtn: {
    backgroundColor: BRAND, borderRadius: 18, height: 54,
    alignItems: 'center', justifyContent: 'center',
  },
  doneBtnText: { fontFamily: FONTS.bold, fontSize: 15, color: '#FFFFFF' },
});

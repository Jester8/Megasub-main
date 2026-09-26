import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  StatusBar,
  RefreshControl,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { fetchMyEsims } from '../../../lib/api';
import { useTheme } from '../../../contexts/ThemeContext';
import { formatUsd } from '../../../lib/format';
import UnavailableNotice from '../components/UnavailableNotice';
import EsimInstallCard from '../components/EsimInstallCard';

import LogoLoader from '../components/LogoLoader';
const FONTS = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semibold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
  extrabold: 'Montserrat_800ExtraBold',
};

const BRAND = '#4A55DD';

const TONES = {
  good: { bg: 'rgba(22,163,74,0.12)', fg: '#16A34A' },
  warn: { bg: 'rgba(245,158,11,0.14)', fg: '#B45309' },
  bad: { bg: 'rgba(220,38,38,0.1)', fg: '#DC2626' },
  neutral: { bg: 'rgba(107,112,136,0.12)', fg: '#6B7088' },
};

// The provider reports UPPERCASE states. INACTIVE means the eSIM has been
// bought but not yet installed/activated on a phone — showing that as
// "Active" would tell someone their plan is running when it isn't.
function describeStatus(esim) {
  const raw = String(esim.status || '').toUpperCase();
  const pastExpiry = esim.expiry_date && new Date(esim.expiry_date).getTime() < Date.now();
  if (raw === 'EXPIRED' || pastExpiry) return { label: 'Expired', tone: 'bad', installable: false };
  if (raw === 'INACTIVE' || raw === 'NOT_ACTIVATED' || raw === 'PENDING') {
    return { label: 'Not installed', tone: 'warn', installable: true };
  }
  if (raw === 'ACTIVE' || raw === 'INSTALLED' || raw === 'ENABLED') {
    return { label: 'Active', tone: 'good', installable: true };
  }
  if (!raw) return { label: 'Unknown', tone: 'neutral', installable: true };
  const pretty = raw.charAt(0) + raw.slice(1).toLowerCase().replace(/_/g, ' ');
  return { label: pretty, tone: 'neutral', installable: raw !== 'CANCELLED' };
}

export default function MyESIMs({ navigate, user }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [esims, setEsims] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [unavailableMessage, setUnavailableMessage] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  useEffect(() => {
    load();
  }, []);

  const load = async ({ pull = false } = {}) => {
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      const json = await fetchMyEsims(user?.id);
      setUnavailableMessage(null);
      setEsims(json.data || []);
    } catch (error) {
      if (error.isUnavailable) setUnavailableMessage(error.message);
      else Alert.alert('Network Error', error.message || 'Could not load your eSIMs.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card }]}
          onPress={() => navigate && navigate('home')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>My eSIMs</Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card }]}
          onPress={() => navigate && navigate('esim')}
          activeOpacity={0.7}
        >
          <Feather name="plus" size={20} color={colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => load({ pull: true })} tintColor={BRAND} />}
      >
        {loading ? (
          <LogoLoader centered />
        ) : unavailableMessage ? (
          <UnavailableNotice title="eSIM Coming Soon" message={unavailableMessage} icon="globe" colors={colors} />
        ) : esims.length === 0 ? (
          <View style={styles.emptyState}>
            <Feather name="wifi-off" size={40} color="#B7BCEF" />
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>No eSIMs yet</Text>
            <Text style={[styles.emptySubtext, { color: colors.textFaint }]}>
              Purchase a global eSIM plan to see it here.
            </Text>
            <TouchableOpacity style={styles.ctaBtn} activeOpacity={0.85} onPress={() => navigate && navigate('esim')}>
              <Text style={styles.ctaText}>Buy an eSIM</Text>
            </TouchableOpacity>
          </View>
        ) : (
          esims.map((e, i) => {
            const status = describeStatus(e);
            const tone = TONES[status.tone];
            const id = e.id || String(i);
            const open = expandedId === id;
            return (
              <View key={id} style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TouchableOpacity
                  style={styles.cardTop}
                  activeOpacity={0.8}
                  onPress={() => status.installable && setExpandedId(open ? null : id)}
                >
                  <Text style={styles.cardFlag}>{e.flag_emoji || '🌍'}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.cardCountry, { color: colors.text }]}>{e.country}</Text>
                    <Text style={[styles.cardPlan, { color: colors.textMuted }]}>
                      {e.plan_name}
                      {e.data_size ? ` · ${e.data_size}` : ''}
                    </Text>
                  </View>
                  <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
                    <Text style={[styles.statusText, { color: tone.fg }]}>{status.label}</Text>
                  </View>
                </TouchableOpacity>

                <View style={styles.metaRow}>
                  {e.price ? (
                    <Text style={[styles.metaText, { color: colors.textFaint }]}>{formatUsd(e.price, e.currency)}</Text>
                  ) : null}
                  {e.validity_days ? (
                    <Text style={[styles.metaText, { color: colors.textFaint }]}>{e.validity_days} days</Text>
                  ) : null}
                  {e.expiry_date ? (
                    <Text style={[styles.metaText, { color: colors.textFaint }]}>Expires {e.expiry_date}</Text>
                  ) : null}
                </View>

                {status.installable ? (
                  <TouchableOpacity style={styles.toggleRow} onPress={() => setExpandedId(open ? null : id)} activeOpacity={0.7}>
                    <Text style={styles.toggleText}>{open ? 'Hide install details' : 'Show install details'}</Text>
                    <Feather name={open ? 'chevron-up' : 'chevron-down'} size={16} color={BRAND} />
                  </TouchableOpacity>
                ) : null}

                {open ? (
                  <View style={{ marginTop: 12 }}>
                    <EsimInstallCard esim={e} colors={colors} />
                  </View>
                ) : null}
              </View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 18, paddingBottom: 14,
  },
  backBtn: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: '#FFFFFF',
    alignItems: 'center', justifyContent: 'center', elevation: 2,
    shadowColor: '#0B0D1A', shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16, color: '#0B0D1A' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },

  emptyState: { alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 6 },
  emptyText: { fontFamily: FONTS.semibold, fontSize: 14, marginTop: 10 },
  emptySubtext: { fontFamily: FONTS.regular, fontSize: 12, textAlign: 'center', paddingHorizontal: 30 },
  ctaBtn: { backgroundColor: BRAND, borderRadius: 14, paddingVertical: 12, paddingHorizontal: 24, marginTop: 16 },
  ctaText: { fontFamily: FONTS.bold, fontSize: 13.5, color: '#FFFFFF' },

  card: { borderRadius: 16, borderWidth: 1.5, padding: 16, marginTop: 14 },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cardFlag: { fontSize: 26 },
  cardCountry: { fontFamily: FONTS.bold, fontSize: 15, marginBottom: 2 },
  cardPlan: { fontFamily: FONTS.medium, fontSize: 12.5 },
  statusPill: { paddingVertical: 4, paddingHorizontal: 10, borderRadius: 10 },
  statusText: { fontFamily: FONTS.semibold, fontSize: 11 },
  metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginTop: 10 },
  metaText: { fontFamily: FONTS.regular, fontSize: 11.5 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 12 },
  toggleText: { fontFamily: FONTS.semibold, fontSize: 12.5, color: BRAND },
});

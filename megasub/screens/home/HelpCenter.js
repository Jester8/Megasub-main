import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  LayoutAnimation,
  Platform,
  UIManager,
  StatusBar,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../../contexts/ThemeContext';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

const FONTS = {
  regular: 'Manrope_400Regular',
  medium: 'Manrope_500Medium',
  semibold: 'Manrope_600SemiBold',
  bold: 'Manrope_700Bold',
};

const BRAND = '#4A55DD';

const FAQS = [
  {
    id: '1',
    question: 'How long does it take for my wallet to be funded?',
    answer: 'Wallet top-ups via bank transfer are usually credited within a few minutes. If it takes longer than 30 minutes, please contact support with your payment reference.',
  },
  {
    id: '2',
    question: 'What should I do if a transaction fails but I was charged?',
    answer: 'Failed transactions are automatically reversed to your wallet within 24 hours. If the refund does not reflect, reach out to support with the transaction reference.',
  },
  {
    id: '3',
    question: 'How do I change my transaction PIN?',
    answer: 'Go to Profile > Change Transaction PIN, enter your current PIN followed by your new PIN twice to confirm.',
  },
  {
    id: '4',
    question: 'Why do I need to complete KYC verification?',
    answer: 'KYC verification confirms your identity and unlocks higher daily transaction limits. You can complete it from Profile > KYC Verification.',
  },
  {
    id: '5',
    question: 'Is my personal information safe?',
    answer: 'Yes. All sensitive data is encrypted in transit and at rest, and your transaction PIN is never stored in plain text.',
  },
];

function FaqItem({ item, expanded, onToggle, colors }) {
  return (
    <TouchableOpacity style={styles.faqItem} onPress={onToggle} activeOpacity={0.75}>
      <View style={styles.faqRow}>
        <Text style={[styles.faqQuestion, { color: colors.text }]}>{item.question}</Text>
        <Feather name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textFaint} />
      </View>
      {expanded && <Text style={[styles.faqAnswer, { color: colors.textMuted }]}>{item.answer}</Text>}
    </TouchableOpacity>
  );
}

export default function HelpCenter({ navigate }) {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const [expandedId, setExpandedId] = useState(null);

  const handleToggle = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpandedId(expandedId === id ? null : id);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />
      <View style={[styles.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.card }]}
          onPress={() => navigate && navigate('profile')}
          activeOpacity={0.7}
        >
          <Feather name="arrow-left" size={20} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Help Center</Text>
        <View style={{ width: 38 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>Frequently Asked Questions</Text>
        <View style={[styles.listCard, { backgroundColor: colors.card }]}>
          {FAQS.map((item, index) => (
            <View key={item.id}>
              <FaqItem item={item} expanded={expandedId === item.id} onToggle={() => handleToggle(item.id)} colors={colors} />
              {index < FAQS.length - 1 && <View style={[styles.divider, { backgroundColor: colors.divider }]} />}
            </View>
          ))}
        </View>

        <TouchableOpacity
          style={styles.contactBtn}
          activeOpacity={0.85}
          onPress={() => navigate && navigate('contact-support')}
        >
          <Text style={styles.contactBtnText}>Still need help? Contact Support</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#F7F8FC' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 14,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
    shadowColor: '#0B0D1A',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  headerTitle: { fontFamily: FONTS.bold, fontSize: 16, color: '#0B0D1A' },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 30 },
  sectionLabel: { fontFamily: FONTS.semibold, fontSize: 13, color: '#6B7088', marginBottom: 10 },

  listCard: { backgroundColor: '#FFFFFF', borderRadius: 18, paddingHorizontal: 16 },
  faqItem: { paddingVertical: 14 },
  faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  faqQuestion: { flex: 1, fontFamily: FONTS.semibold, fontSize: 13.5, color: '#0B0D1A' },
  faqAnswer: { fontFamily: FONTS.regular, fontSize: 12.5, color: 'rgba(11,13,26,0.55)', lineHeight: 19, marginTop: 10 },
  divider: { height: 1, backgroundColor: 'rgba(11,13,26,0.06)' },

  contactBtn: {
    alignItems: 'center', justifyContent: 'center', paddingVertical: 16, marginTop: 20,
  },
  contactBtnText: { fontFamily: FONTS.bold, fontSize: 13.5, color: BRAND },
});

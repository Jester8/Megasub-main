import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import WelcomeHeader from './components/WelcomeHeader';
import WalletCard from './components/Walletcard';
import Slide from './components/Slides';
import ServicesGrid from './components/Servicesgrid';
import RecentTransactions from './components/Recent';
import BottomNav from './components/BottomNav';
import { useTheme } from '../../contexts/ThemeContext';

export default function HomeScreen({ navigate, user }) {
  const { colors } = useTheme();
  const [activeTab, setActiveTab] = useState('home');

  function handleTopUp() { navigate('topup'); }

  function handleSeeAllTransactions() { navigate('history'); }

  function handleTabPress(tab) {
    if (tab === 'home') {
      setActiveTab(tab);
      return;
    }
    navigate(tab);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />

      <WelcomeHeader
        userName={user?.first_name || user?.username || 'there'}
        userData={user}
        notifCount={0}
        onNotifPress={() => console.log('notifications')}
      />

      {/* Main content body handles screen fitting dynamically */}
      <View style={styles.mainContent}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <WalletCard userData={user} onTopUp={handleTopUp} />
          <Slide />
          <ServicesGrid navigate={navigate} />
          <RecentTransactions onSeeAllPress={handleSeeAllTransactions} />
        </ScrollView>
      </View>

      <BottomNav activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  mainContent: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 24,
  },
});
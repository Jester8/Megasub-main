import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
  RefreshControl,
} from 'react-native';
import WelcomeHeader from './components/WelcomeHeader';
import WalletCard from './components/Walletcard';
import Slide from './components/Slides';
import ServicesGrid from './components/Servicesgrid';
import RecentTransactions from './components/Recent';
import BottomNav from './components/BottomNav';
import { useTheme } from '../../contexts/ThemeContext';
import { useResponsive } from '../../lib/responsive';

const BRAND = '#4A55DD';

export default function HomeScreen({ navigate, user, onRefreshWallet }) {
  const { colors } = useTheme();
  const { content } = useResponsive();
  const [activeTab, setActiveTab] = useState('home');
  const [refreshing, setRefreshing] = useState(false);
  const [refreshSignal, setRefreshSignal] = useState(0);

  function handleTopUp() { navigate('topup'); }

  function handleSeeAllTransactions() { navigate('history'); }

  function handleSeeAllServices() { navigate('all-services'); }

  function handleTabPress(tab) {
    if (tab === 'home') {
      setActiveTab(tab);
      return;
    }
    navigate(tab);
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.resolve(onRefreshWallet && onRefreshWallet());
    setRefreshSignal((n) => n + 1);
    setRefreshing(false);
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <StatusBar barStyle={colors.statusBarStyle} translucent backgroundColor="transparent" />

      <WelcomeHeader
        userName={user?.first_name || user?.username || 'there'}
        userData={user}
        notifCount={0}
        onNotifPress={() => navigate('notifications')}
      />

      {/* Main content body handles screen fitting dynamically */}
      <View style={styles.mainContent}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, content]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={BRAND} />
          }
        >
          <WalletCard userData={user} onTopUp={handleTopUp} />
          <Slide />
          <ServicesGrid navigate={navigate} onSeeAllPress={handleSeeAllServices} />
          <RecentTransactions user={user} onSeeAllPress={handleSeeAllTransactions} refreshSignal={refreshSignal} />
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
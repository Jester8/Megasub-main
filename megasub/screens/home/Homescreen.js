import React, { useState } from 'react';
import {
  View,
  ScrollView,
  StyleSheet,
  StatusBar,
} from 'react-native';
import WelcomeHeader from './components/WelcomeHeader';
import WalletCard from './components/Walletcard';
import ServicesGrid from './components/Servicesgrid';
import RecentTransactions from './components/Recent';
import BottomNav from './components/BottomNav';

export default function HomeScreen({ navigate, user }) {
  const [activeTab, setActiveTab] = useState('home');
  const [balance, setBalance] = useState(0.00);

  console.log('🏠 HomeScreen user data:', user);
  console.log('🏠 user.first_name:', user?.first_name);

  function handleTopUp() {
    console.log('Open top-up modal');
  }

  function handleServicePress(service) {
    console.log('Service pressed:', service.id);
  }

  function handleSeeAllTransactions() {
    console.log('See all transactions');
  }

  function handleTabPress(tab) {
    setActiveTab(tab);
  }

  return (
    <View style={styles.root}>
      <StatusBar barStyle="dark-content" translucent backgroundColor="transparent" />

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <WelcomeHeader
          // ✅ FIXED: Use first_name (with underscore) instead of firstName
          userName={user?.first_name || user?.username || 'there'}
          userData={user}
          notifCount={3}
          onNotifPress={() => console.log('notifications')}
        />

        <WalletCard
          balance={balance}
          onTopUp={handleTopUp}
        />

        <ServicesGrid
          onServicePress={handleServicePress}
        />

        <RecentTransactions
          onSeeAllPress={handleSeeAllTransactions}
        />

        <View style={{ height: 100 }} />
      </ScrollView>

      <BottomNav activeTab={activeTab} onTabPress={handleTabPress} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
});
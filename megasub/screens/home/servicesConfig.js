// Shared between the Home services grid and the "See all" page.
export const SERVICES = [
  { id: 'airtime',      label: 'Airtime',        icon: 'call-outline',            color: '#4A55DD', bg: 'rgba(74,85,221,0.1)' },
  { id: 'data',         label: 'Data',           icon: 'wifi-outline',            color: '#00C9A7', bg: 'rgba(0,201,167,0.1)' },
  { id: 'virtual-card', label: 'Virtual\nCard',  icon: 'card-outline',            color: '#EF4444', bg: 'rgba(239,68,68,0.1)' },
  { id: 'esim',         label: 'E-SIM',          icon: 'sim-outline', iconSet: 'material', color: '#06B6D4', bg: 'rgba(6,182,212,0.1)' },
  { id: 'electricity',  label: 'Electricity',    icon: 'flash-outline',           color: '#F59E0B', bg: 'rgba(245,158,11,0.1)' },
  { id: 'cable',        label: 'Cable TV',       icon: 'tv-outline',              color: '#EC4899', bg: 'rgba(236,72,153,0.1)' },
  { id: 'bulk-sms',     label: 'Bulk\nAirtime',  icon: 'phone-portrait-outline',  color: '#7C3AED', bg: 'rgba(124,58,237,0.1)' },
  { id: 'bulk-data',    label: 'Bulk\nData',     icon: 'cellular-outline',        color: '#2563EB', bg: 'rgba(37,99,235,0.1)' },
  { id: 'waec',         label: 'Results\nChecker', icon: 'school-outline',        color: '#10B981', bg: 'rgba(16,185,129,0.1)' },
];

// Home shows the first eight services (two rows of four); "See all" shows
// every one. KYC is not a service tile; it is prompted by the KycBanner on
// Home and routed to by SERVICE_SCREENS.
export const HOME_SERVICES = SERVICES.slice(0, 8);

// Maps a service id to the screen name used in App.js's `screen` state.
// Services without a documented Mega-Sub API route go to the shared
// "coming soon" placeholder instead of a broken/fake integration.
export const SERVICE_SCREENS = {
  airtime: 'airtime',
  data: 'data',
  cable: 'cable',
  electricity: 'electricity',
  'bulk-sms': 'bulk',
  'bulk-data': 'bulk-data',
  esim: 'esim',
  waec: 'result-checker',
  'virtual-card': 'virtual-card',
  kyc: 'kyc',
};

export function isComingSoon(serviceId) {
  return !!SERVICE_SCREENS[serviceId]?.startsWith('coming-soon');
}

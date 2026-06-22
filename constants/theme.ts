export const LIGHT_COLORS = {
    primary: '#1A237E', // Deep Indigo 900 for academic feel
    primaryDark: '#000051',
    primaryLight: '#534BAE',
    header: '#1A237E',
    onPrimary: '#FFFFFF',
    accent: '#FFB300', // Amber 600
    background: '#F5F7FA', // Soft gray-blue background
    surface: '#FFFFFF',
    surfaceVariant: '#EEF0F4',
    text: '#212121',
    textSecondary: '#607D8B', // Blue grey 500
    error: '#D32F2F',
    success: '#2E7D32',
    warning: '#F57C00',
    info: '#0288D1',
    border: '#E0E0E0',
    // Badge colors
    badgeBg: '#E8EAF6',
    badgeText: '#3F51B5',
    badgeOfflineBg: '#E8F5E9',
    badgeOfflineText: '#2E7D32',
    badgeLangBg: '#FFF3E0',
    badgeLangText: '#E65100',
};

export type AppColors = typeof LIGHT_COLORS;

export const DARK_COLORS: AppColors = {
  primary: '#9FA8DA',
  primaryDark: '#151B3F',
  primaryLight: '#7986CB',
  header: '#202752',
  onPrimary: '#FFFFFF',
  accent: '#FFC247',
  background: '#101217',
  surface: '#1A1D24',
  surfaceVariant: '#252A34',
  text: '#F2F3F7',
  textSecondary: '#B0B7C5',
  error: '#FF6B6B',
  success: '#66BB6A',
  warning: '#FFB74D',
  info: '#4FC3F7',
  border: '#343A46',
  badgeBg: '#29304A',
  badgeText: '#C5CAE9',
  badgeOfflineBg: '#183A29',
  badgeOfflineText: '#81C784',
  badgeLangBg: '#3D3020',
  badgeLangText: '#FFCC80',
};

export const THEME = {
  colors: LIGHT_COLORS,
  readerThemes: {
    light: {
      bg: '#FAF9ED', // Бумага
      text: '#1A1714',
      topbar: '#5C6BC0',
      bottombar: '#F2EFE6',
    },
    sepia: {
      bg: '#EDDCB8',
      text: '#331F0D',
      topbar: '#8C612E',
      bottombar: '#E0CC9A',
    },
    dark: {
      bg: '#1A1A1E',
      text: '#E0DBD1',
      topbar: '#292933',
      bottombar: '#24242B',
    },
  },
};

export const PALETTE = [
  "#5C6BC0", "#26A69A", "#EF5350", "#AB47BC",
  "#FFA726", "#66BB6A", "#EC407A", "#42A5F5",
];

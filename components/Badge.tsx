import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useAppTheme } from '../contexts/ThemeContext';

interface BadgeProps {
  label: string;
  type?: 'default' | 'offline' | 'lang' | 'type';
  icon?: React.ReactNode;
}

export default function Badge({ label, type = 'default', icon }: BadgeProps) {
  const { colors } = useAppTheme();
  let bg = colors.badgeBg;
  let color = colors.badgeText;

  if (type === 'offline') {
    bg = colors.badgeOfflineBg;
    color = colors.badgeOfflineText;
  } else if (type === 'lang') {
    bg = colors.badgeLangBg;
    color = colors.badgeLangText;
  } else if (type === 'type') {
    bg = colors.primaryLight;
    color = '#FFF';
  }

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {icon && <View style={styles.iconContainer}>{icon}</View>}
      <Text style={[styles.label, { color }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    marginRight: 6,
    marginBottom: 6,
  },
  iconContainer: {
    marginRight: 4,
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
});

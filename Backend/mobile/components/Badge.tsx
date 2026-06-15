import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { THEME } from '../constants/theme';

interface BadgeProps {
  label: string;
  type?: 'default' | 'offline' | 'lang' | 'type';
  icon?: React.ReactNode;
}

export default function Badge({ label, type = 'default', icon }: BadgeProps) {
  let bg = THEME.colors.badgeBg;
  let color = THEME.colors.badgeText;

  if (type === 'offline') {
    bg = THEME.colors.badgeOfflineBg;
    color = THEME.colors.badgeOfflineText;
  } else if (type === 'lang') {
    bg = THEME.colors.badgeLangBg;
    color = THEME.colors.badgeLangText;
  } else if (type === 'type') {
    bg = THEME.colors.primaryLight;
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

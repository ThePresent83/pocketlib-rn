import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Icon } from 'react-native-paper';
import { Image } from 'expo-image';
import { Book } from '../services/bookService';
import { THEME } from '../constants/theme';
import Badge from './Badge';

interface MaterialCardProps {
  item: Book;
  onPress: (item: Book) => void;
}

export default function MaterialCard({ item, onPress }: MaterialCardProps) {
  return (
    <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.8}>
      <Card style={styles.card}>
        <View style={styles.row}>
          <View style={styles.coverWrap}>
            {item.cover_url ? (
              <Image
                source={item.cover_url}
                style={styles.cover}
                contentFit="cover"
              />
            ) : (
              <Icon source="book-open-variant" size={40} color="#B3B3BF" />
            )}
          </View>
          <View style={styles.info}>
            <Text variant="titleMedium" style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text variant="bodySmall" style={styles.author} numberOfLines={1}>
              {item.author || 'Автор неизвестен'}
            </Text>
            
            <View style={styles.badgeRow}>
              {item.material_type && (
                <Badge label={item.material_type} type="type" />
              )}
              {item.language && (
                <Badge label={item.language.toUpperCase()} type="lang" />
              )}
              {item.is_downloaded ? (
                <Badge label="Офлайн" type="offline" icon={<Icon source="check-circle" size={12} color={THEME.colors.badgeOfflineText} />} />
              ) : (
                <Badge label="Онлайн" />
              )}
            </View>
          </View>
        </View>
      </Card>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
    backgroundColor: THEME.colors.surface,
    borderRadius: 16,
    elevation: 2,
  },
  row: {
    flexDirection: 'row',
    padding: 12,
  },
  coverWrap: {
    width: 70,
    height: 100,
    borderRadius: 8,
    backgroundColor: THEME.colors.badgeBg,
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
  },
  cover: {
    width: '100%',
    height: '100%',
  },
  info: {
    flex: 1,
    marginLeft: 12,
    justifyContent: 'center',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
    color: THEME.colors.text,
  },
  author: {
    color: THEME.colors.textSecondary,
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
});

import { View, StyleSheet } from 'react-native';
import { Card, Text, Icon, IconButton } from 'react-native-paper';
import { Image } from 'expo-image';
import { SearchResult } from '../services/api';
import { THEME } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';
import { useAppTheme } from '../contexts/ThemeContext';

interface SearchResultCardProps {
  item: SearchResult;
  onAdd: (item: SearchResult) => void;
}

export default function SearchResultCard({ item, onAdd }: SearchResultCardProps) {
  const { t } = useLanguage();
  const { colors } = useAppTheme();

  return (
    <Card style={[styles.card, { backgroundColor: colors.surface }]}>
      <View style={styles.row}>
        <View style={[styles.coverWrap, { backgroundColor: colors.surfaceVariant }]}>
          {item.cover_url ? (
            <Image
              source={item.cover_url}
              style={styles.cover}
              contentFit="cover"
            />
          ) : (
            <Icon source="book-open-variant" size={40} color={colors.textSecondary} />
          )}
        </View>
        <View style={styles.info}>
          <Text variant="titleMedium" style={styles.title} numberOfLines={2}>
            {item.title}
          </Text>
          <Text variant="bodySmall" style={[styles.author, { color: colors.textSecondary }]} numberOfLines={1}>
            {item.author}
          </Text>
          <Text variant="bodySmall" style={[styles.meta, { color: colors.textSecondary }]} numberOfLines={1}>
            {t('year')}: {item.year || '—'}  |  ISBN: {item.isbn || '—'}
          </Text>

          {!!item.has_fulltext && (
            <View style={styles.badgeRow}>
              <Icon source="book-open-page-variant" size={14} color={colors.success} />
              <Text style={[styles.badgeText, { color: colors.success }]}>{t('read_online')}</Text>
            </View>
          )}
        </View>
        <View style={styles.actionCol}>
          <IconButton
            icon="plus-circle-outline"
            size={28}
            iconColor={colors.primary}
            onPress={() => onAdd(item)}
          />
        </View>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 10,
    backgroundColor: '#fff',
    borderRadius: 16,
  },
  row: {
    flexDirection: 'row',
    padding: 10,
  },
  coverWrap: {
    width: 80,
    height: 120,
    borderRadius: 8,
    backgroundColor: '#E8E8EC',
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
    marginLeft: 10,
    justifyContent: 'flex-start',
  },
  title: {
    fontWeight: 'bold',
    marginBottom: 4,
  },
  author: {
    color: THEME.colors.textSecondary,
    marginBottom: 4,
  },
  meta: {
    color: '#999',
    marginBottom: 8,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
  },
  badgeText: {
    fontSize: 12,
    marginLeft: 4,
    color: '#1A9E3D',
  },
  actionCol: {
    justifyContent: 'center',
    paddingLeft: 4,
  },
});

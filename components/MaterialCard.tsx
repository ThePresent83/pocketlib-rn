import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Icon, IconButton } from 'react-native-paper';
import { Image } from 'expo-image';
import { Book } from '../services/bookService';
import { THEME } from '../constants/theme';
import Badge from './Badge';
import { useLanguage } from '../contexts/LanguageContext';
import { useAppTheme } from '../contexts/ThemeContext';

interface MaterialCardProps {
  item: Book;
  onPress: (item: Book) => void;
  isFavorite?: boolean;
  onToggleFavorite?: (item: Book) => void;
}

function getFileExtension(path?: string): string {
  return path?.split('?')[0].split('.').pop()?.toLowerCase() || '';
}

export default function MaterialCard({ item, onPress, isFavorite, onToggleFavorite }: MaterialCardProps) {
  const { t } = useLanguage();
  const { colors } = useAppTheme();
  const typeLabels: Record<string, string> = {
    textbook: t('textbook'),
    lecture: t('lecture'),
    manual: t('manual'),
    practice: t('practice'),
    book: t('books'),
  };
  const fileExt = getFileExtension(item.file_name || item.file_path || item.external_url);
  const isMediaDocument = ['pdf', 'djvu'].includes(fileExt);
  const canReadGutenberg = Boolean(item.gutenberg_id && item.has_fulltext);
  const canReadInside = canReadGutenberg || Boolean((item.file_path || item.has_file) && !isMediaDocument);
  const readHint = canReadInside
    ? t('read_in_app')
    : item.has_file && !item.is_downloaded ? t('download_for_reading') : isMediaDocument ? t('open_document') : t('open_source');

  return (
    <TouchableOpacity onPress={() => onPress(item)} activeOpacity={0.8}>
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
            <View style={styles.titleRow}>
              <View style={styles.titleTextBlock}>
            <Text variant="titleMedium" style={[styles.title, { color: colors.text }]} numberOfLines={2}>
              {item.title}
            </Text>
            <Text variant="bodySmall" style={[styles.author, { color: colors.textSecondary }]} numberOfLines={1}>
              {item.author || t('unknown_author')}
            </Text>
              </View>
              {onToggleFavorite ? (
                <IconButton
                  icon={isFavorite ? 'heart' : 'heart-outline'}
                  size={20}
                  iconColor={isFavorite ? colors.warning : colors.textSecondary}
                  style={styles.favoriteButton}
                  onPress={() => onToggleFavorite(item)}
                />
              ) : null}
            </View>
            
            <View style={styles.badgeRow}>
              {item.material_type && (
                <Badge label={typeLabels[item.material_type] || item.material_type} type="type" />
              )}
              {item.language && (
                <Badge label={item.language.toUpperCase()} type="lang" />
              )}
              {item.is_downloaded ? (
                <Badge label={t('offline')} type="offline" icon={<Icon source="check-circle" size={12} color={colors.badgeOfflineText} />} />
              ) : item.has_file ? (
                <Badge label={t('on_server')} />
              ) : (
                <Badge label={t('online')} />
              )}
            </View>
            <View style={styles.readHint}>
              <Icon
                source={canReadInside ? 'book-open-page-variant' : item.has_file && !item.is_downloaded ? 'download' : isMediaDocument ? 'file-document-outline' : 'open-in-new'}
                size={15}
                color={canReadInside ? colors.success : isMediaDocument ? colors.warning : colors.info}
              />
              <Text style={[styles.readHintText, { color: canReadInside ? colors.success : isMediaDocument ? colors.warning : colors.info }]}>
                {readHint}
              </Text>
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
    borderRadius: 10,
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
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  titleTextBlock: {
    flex: 1,
    minWidth: 0,
  },
  favoriteButton: {
    margin: -8,
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
  readHint: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  readHintText: {
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 5,
  },
});

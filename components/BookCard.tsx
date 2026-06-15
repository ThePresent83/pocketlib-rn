import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { Card, Text, Icon } from 'react-native-paper';
import { Image } from 'expo-image';
import { Book } from '../services/bookService';
import { THEME } from '../constants/theme';
import { useLanguage } from '../contexts/LanguageContext';

interface BookCardProps {
  book: Book;
  onPress?: (book: Book) => void;
}

export default function BookCard({ book, onPress }: BookCardProps) {
  const { t } = useLanguage();
  const hasText = !!(book.has_fulltext || book.ol_key);

  return (
    <Card style={styles.card} onPress={() => onPress?.(book)}>
      <View style={styles.row}>
        <View style={styles.coverWrap}>
          {book.cover_url ? (
            <Image
              source={book.cover_url}
              style={styles.cover}
              contentFit="cover"
            />
          ) : (
            <Icon source="book-open-variant" size={36} color="#999" />
          )}
        </View>
        <View style={styles.info}>
          <Text variant="titleMedium" style={styles.title} numberOfLines={2}>
            {book.title}
          </Text>
          <Text variant="bodySmall" style={styles.author} numberOfLines={1}>
            {book.author || t('unknown_author')}
          </Text>
          
          <View style={styles.statusRow}>
            {hasText && (
              <View style={styles.statusBadge}>
                <Icon source="book-open-page-variant" size={14} color="#1A9E3D" />
                <Text style={[styles.statusText, { color: '#1A9E3D' }]}>{t('online')}</Text>
              </View>
            )}
            {!!book.is_downloaded && (
              <View style={styles.statusBadge}>
                <Icon source="download-circle" size={14} color="#3442A4" />
                <Text style={[styles.statusText, { color: '#3442A4' }]}>{t('offline')}</Text>
              </View>
            )}
          </View>
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
    width: 70,
    height: 100,
    borderRadius: 8,
    backgroundColor: '#E0E0E5',
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
    marginBottom: 8,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 'auto',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 10,
  },
  statusText: {
    fontSize: 12,
    marginLeft: 4,
  },
});

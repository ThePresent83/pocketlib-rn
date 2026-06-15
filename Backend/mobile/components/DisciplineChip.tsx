import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import { THEME } from '../constants/theme';

interface DisciplineChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export default function DisciplineChip({ label, selected, onPress }: DisciplineChipProps) {
  return (
    <Chip
      mode="flat"
      selected={selected}
      onPress={onPress}
      style={[
        styles.chip,
        selected && { backgroundColor: THEME.colors.primary + '33' }
      ]}
      textStyle={[
        selected && { color: THEME.colors.primary, fontWeight: 'bold' }
      ]}
    >
      {label}
    </Chip>
  );
}

const styles = StyleSheet.create({
  chip: {
    marginRight: 8,
    borderRadius: 20,
  },
});

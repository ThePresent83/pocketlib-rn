import { StyleSheet } from 'react-native';
import { Chip } from 'react-native-paper';
import { useAppTheme } from '../contexts/ThemeContext';

interface DisciplineChipProps {
  label: string;
  selected: boolean;
  onPress: () => void;
}

export default function DisciplineChip({ label, selected, onPress }: DisciplineChipProps) {
  const { colors } = useAppTheme();

  return (
    <Chip
      mode="flat"
      selected={selected}
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: selected ? `${colors.primary}33` : colors.surfaceVariant }
      ]}
      textStyle={[
        { color: selected ? colors.primary : colors.text, fontWeight: selected ? 'bold' : 'normal' }
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

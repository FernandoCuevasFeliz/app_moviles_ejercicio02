import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

type UnitId = 'km' | 'm' | 'cm' | 'mm';

type Unit = {
  id: UnitId;
  symbol: string;
  name: string;
  meters: number;
};

type ConversionPair = {
  from: UnitId;
  to: UnitId;
};

type ConversionResult = {
  value: number;
  sourceValue: number;
  from: UnitId;
  to: UnitId;
};

type ParseStatus = 'empty' | 'invalid' | 'ok';

type ParseResult = {
  status: ParseStatus;
  value: number;
};

type SanitizeResult = {
  text: string;
  hadInvalidChars: boolean;
};

const UNITS: Record<UnitId, Unit> = {
  km: { id: 'km', symbol: 'km', name: 'Kilómetros', meters: 1000 },
  m: { id: 'm', symbol: 'm', name: 'Metros', meters: 1 },
  cm: { id: 'cm', symbol: 'cm', name: 'Centímetros', meters: 0.01 },
  mm: { id: 'mm', symbol: 'mm', name: 'Milímetros', meters: 0.001 },
};

const UNIT_ORDER: UnitId[] = ['km', 'm', 'cm', 'mm'];

const COMMON_PAIRS: ConversionPair[] = [
  { from: 'km', to: 'm' },
  { from: 'm', to: 'km' },
  { from: 'cm', to: 'mm' },
  { from: 'mm', to: 'cm' },
];

const MAX_DECIMALS = 6;
const MAX_ABS_VALUE = 1e12;

const VALID_NUMBER = /^-?\d+(\.\d+)?$/;

const ERROR_MESSAGES = {
  empty: 'Ingresa un valor numérico para convertir.',
  invalid: 'Valor no válido: solo se admiten números. Ejemplo: 12.5',
  range: 'El valor es demasiado grande (máximo 1 000 000 000 000).',
  letters: 'Las letras no son válidas en el campo numérico. Ejemplo: 250',
  sameUnit: 'Elige una unidad de destino distinta a la unidad de origen.',
};

const convert = (value: number, from: UnitId, to: UnitId) =>
  (value * UNITS[from].meters) / UNITS[to].meters;

const sanitizeInput = (raw: string): SanitizeResult => {
  const normalized = raw.replace(/\s/g, '').replace(/,/g, '.');
  const filtered = normalized.replace(/[^\d.-]/g, '');
  const isNegative = filtered.startsWith('-');
  const [integerPart, ...decimalParts] = filtered.replace(/-/g, '').split('.');
  const decimals = decimalParts.join('').replace(/\D/g, '').slice(0, MAX_DECIMALS);
  const hasDecimalPoint = decimalParts.length > 0;
  const text = `${isNegative ? '-' : ''}${integerPart}${hasDecimalPoint ? `.${decimals}` : ''}`;

  return { text, hadInvalidChars: text !== raw };
};

const parseInput = (text: string): ParseResult => {
  const trimmed = text.trim();

  if (trimmed === '' || trimmed === '-' || trimmed === '.') {
    return { status: 'empty', value: NaN };
  }

  if (!VALID_NUMBER.test(trimmed)) {
    return { status: 'invalid', value: NaN };
  }

  const value = Number(trimmed);

  if (!Number.isFinite(value)) {
    return { status: 'invalid', value: NaN };
  }

  if (Math.abs(value) > MAX_ABS_VALUE) {
    return { status: 'invalid', value };
  }

  return { status: 'ok', value };
};

const formatNumber = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '—';
  }

  if (value === 0) {
    return '0';
  }

  const absolute = Math.abs(value);

  if (absolute >= MAX_ABS_VALUE || absolute < 1e-6) {
    return value.toExponential(4);
  }

  const rounded = Number(value.toFixed(MAX_DECIMALS));
  const [integerPart, decimalPart] = String(rounded).split('.');
  const grouped = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return decimalPart ? `${grouped}.${decimalPart}` : grouped;
};

type UnitPickerProps = {
  label: string;
  selected: UnitId;
  accent: string;
  onSelect: (unit: UnitId) => void;
};

function UnitPicker({ label, selected, accent, onSelect }: UnitPickerProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.unitRow}>
        {UNIT_ORDER.map((id) => {
          const unit = UNITS[id];
          const isSelected = id === selected;

          return (
            <Pressable
              key={id}
              onPress={() => onSelect(id)}
              accessibilityRole="button"
              accessibilityLabel={`${label}: ${unit.name}`}
              accessibilityState={{ selected: isSelected }}
              style={({ pressed }) => [
                styles.unitButton,
                isSelected && { backgroundColor: accent, borderColor: accent },
                pressed && styles.pressed,
              ]}
            >
              <Text
                style={[
                  styles.unitButtonText,
                  isSelected && styles.unitButtonTextSelected,
                ]}
              >
                {unit.symbol}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function App() {
  const [input, setInput] = useState('');
  const [fromUnit, setFromUnit] = useState<UnitId>('km');
  const [toUnit, setToUnit] = useState<UnitId>('m');
  const [result, setResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleChangeText = (text: string) => {
    const { text: sanitized, hadInvalidChars } = sanitizeInput(text);

    setInput(sanitized);
    setResult(null);
    setError(hadInvalidChars ? ERROR_MESSAGES.letters : null);
  };

  const runConversion = () => {
    setResult(null);

    const parsed = parseInput(input);

    if (parsed.status === 'empty') {
      setError(ERROR_MESSAGES.empty);
      return;
    }

    if (parsed.status === 'invalid') {
      setError(
        Number.isFinite(parsed.value) ? ERROR_MESSAGES.range : ERROR_MESSAGES.invalid
      );
      return;
    }

    if (fromUnit === toUnit) {
      setError(ERROR_MESSAGES.sameUnit);
      return;
    }

    setError(null);
    setResult({
      value: convert(parsed.value, fromUnit, toUnit),
      sourceValue: parsed.value,
      from: fromUnit,
      to: toUnit,
    });
  };

  const handleSelectFrom = (unit: UnitId) => {
    setFromUnit(unit);
    setResult(null);
    setError(null);
  };

  const handleSelectTo = (unit: UnitId) => {
    setToUnit(unit);
    setResult(null);
    setError(null);
  };

  const handleSwap = () => {
    setFromUnit(toUnit);
    setToUnit(fromUnit);
    setResult(null);
    setError(null);
  };

  const handleSelectPair = (pair: ConversionPair) => {
    setFromUnit(pair.from);
    setToUnit(pair.to);
    setResult(null);
    setError(null);
  };

  const handleClear = () => {
    setInput('');
    setResult(null);
    setError(null);
  };

  return (
    <KeyboardAvoidingView
      style={styles.screen}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <StatusBar style="light" />
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Conversor de longitud</Text>
          <Text style={styles.subtitle}>Convierte entre km, m, cm y mm</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.label}>Valor a convertir</Text>
          <View
            style={[styles.inputWrapper, error !== null && styles.inputWrapperError]}
          >
            <TextInput
              value={input}
              onChangeText={handleChangeText}
              placeholder="0"
              placeholderTextColor="#9CA3AF"
              keyboardType={
                Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'numeric'
              }
              returnKeyType="done"
              accessibilityLabel="Valor numérico a convertir"
              style={styles.input}
            />
            <Text numberOfLines={1} style={styles.inputUnit}>
              {UNITS[fromUnit].symbol}
            </Text>
            {input.length > 0 && (
              <Pressable
                onPress={handleClear}
                accessibilityRole="button"
                accessibilityLabel="Borrar valor"
                hitSlop={8}
                style={({ pressed }) => [styles.clearButton, pressed && styles.pressed]}
              >
                <Text style={styles.clearButtonText}>×</Text>
              </Pressable>
            )}
          </View>

          <UnitPicker
            label="Unidad de origen"
            selected={fromUnit}
            accent="#1D4ED8"
            onSelect={handleSelectFrom}
          />

          <Pressable
            onPress={handleSwap}
            accessibilityRole="button"
            accessibilityLabel="Intercambiar unidad de origen y destino"
            style={({ pressed }) => [styles.swapButton, pressed && styles.pressed]}
          >
            <Text style={styles.swapButtonText}>⇄ Intercambiar unidades</Text>
          </Pressable>

          <UnitPicker
            label="Unidad de destino"
            selected={toUnit}
            accent="#047857"
            onSelect={handleSelectTo}
          />

          <Pressable
            onPress={runConversion}
            accessibilityRole="button"
            accessibilityLabel="Convertir valor"
            style={({ pressed }) => [styles.convertButton, pressed && styles.pressed]}
          >
            <Text style={styles.convertButtonText}>Convertir</Text>
          </Pressable>

          {error !== null && (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}
        </View>

        <View style={styles.resultCard}>
          <Text style={styles.resultLabel}>Resultado</Text>
          {result !== null ? (
            <>
              <Text style={styles.resultValue}>
                {formatNumber(result.value)} {UNITS[result.to].symbol}
              </Text>
              <Text style={styles.resultFormula}>
                {formatNumber(result.sourceValue)} {UNITS[result.from].symbol} ={' '}
                {formatNumber(result.value)} {UNITS[result.to].symbol}
              </Text>
            </>
          ) : (
            <Text style={styles.resultPlaceholder}>
              Presiona Convertir para ver el resultado.
            </Text>
          )}
        </View>

        <View style={styles.commonSection}>
          <Text style={styles.commonTitle}>Conversiones más comunes</Text>

          {result !== null ? (
            COMMON_PAIRS.map((pair) => {
              const isActive = pair.from === result.from && pair.to === result.to;
              const leftValue = convert(result.sourceValue, result.from, pair.from);
              const rightValue = convert(result.sourceValue, result.from, pair.to);

              return (
                <Pressable
                  key={`${pair.from}-${pair.to}`}
                  onPress={() => handleSelectPair(pair)}
                  accessibilityRole="button"
                  accessibilityLabel={`Usar conversión de ${UNITS[pair.from].name} a ${UNITS[pair.to].name}`}
                  accessibilityState={{ selected: isActive }}
                  style={({ pressed }) => [
                    styles.commonRow,
                    isActive && styles.commonRowActive,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text
                    style={[styles.commonFrom, isActive && styles.commonTextActive]}
                  >
                    {formatNumber(leftValue)} {UNITS[pair.from].symbol}
                  </Text>
                  <Text style={styles.commonArrow}>→</Text>
                  <Text
                    style={[styles.commonTo, isActive && styles.commonTextActive]}
                  >
                    {formatNumber(rightValue)} {UNITS[pair.to].symbol}
                  </Text>
                </Pressable>
              );
            })
          ) : (
            <Text style={styles.commonHint}>
              Presiona Convertir para ver las conversiones km-m, m-km, cm-mm y
              mm-cm.
            </Text>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  container: {
    padding: 20,
    paddingTop: 48,
    paddingBottom: 40,
    gap: 16,
  },
  header: {
    marginBottom: 4,
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  subtitle: {
    marginTop: 4,
    fontSize: 15,
    color: '#94A3B8',
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 18,
    gap: 14,
  },
  field: {
    gap: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F8FAFC',
  },
  inputWrapperError: {
    borderColor: '#DC2626',
    backgroundColor: '#FEF2F2',
  },
  input: {
    flex: 1,
    minWidth: 0,
    paddingVertical: 12,
    fontSize: 22,
    fontWeight: '600',
    color: '#0F172A',
  },
  inputUnit: {
    flexShrink: 0,
    marginLeft: 8,
    fontSize: 16,
    fontWeight: '700',
    color: '#64748B',
  },
  clearButton: {
    flexShrink: 0,
    marginLeft: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E2E8F0',
  },
  clearButtonText: {
    fontSize: 18,
    lineHeight: 20,
    fontWeight: '700',
    color: '#475569',
  },
  unitRow: {
    flexDirection: 'row',
    gap: 10,
  },
  unitButton: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
  },
  unitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#334155',
  },
  unitButtonTextSelected: {
    color: '#FFFFFF',
  },
  swapButton: {
    alignSelf: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 999,
    backgroundColor: '#F1F5F9',
  },
  swapButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#334155',
  },
  convertButton: {
    marginTop: 2,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#1D4ED8',
    alignItems: 'center',
  },
  convertButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pressed: {
    opacity: 0.7,
  },
  errorBox: {
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: '#DC2626',
    backgroundColor: '#FEE2E2',
    padding: 12,
  },
  errorText: {
    fontSize: 14,
    color: '#991B1B',
  },
  resultCard: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#1D4ED8',
  },
  resultLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#BFDBFE',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  resultValue: {
    marginTop: 6,
    fontSize: 34,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  resultFormula: {
    marginTop: 6,
    fontSize: 14,
    color: '#DBEAFE',
  },
  resultPlaceholder: {
    marginTop: 6,
    fontSize: 15,
    color: '#DBEAFE',
  },
  commonSection: {
    borderRadius: 16,
    padding: 18,
    backgroundColor: '#1E293B',
    gap: 10,
  },
  commonTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  commonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
    backgroundColor: '#0F172A',
  },
  commonRowActive: {
    borderColor: '#34D399',
    backgroundColor: '#064E3B',
  },
  commonFrom: {
    fontSize: 15,
    color: '#CBD5E1',
  },
  commonArrow: {
    fontSize: 15,
    color: '#64748B',
  },
  commonTo: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  commonTextActive: {
    color: '#6EE7B7',
  },
  commonHint: {
    fontSize: 14,
    color: '#94A3B8',
  },
});

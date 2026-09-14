export const fontDemo = {
  background: '#F7F8FA',
  paper: '#FFFFFF',
  ink: '#192231',
  muted: '#627084',
  accent: '#003C69',
  button: '#DFE8F4',
  specimen: '#F0EBDD',
  spacing: 16,
  gap: 12,
  radius: 16,
  inputHeight: 54,
} as const;

export const fontChoices = [
  { value: 'system', label: 'System', family: null, nativeName: null },
  {
    value: 'regular',
    label: 'Regular',
    family: 'Quicksand_400Regular',
    nativeName: 'Quicksand-Regular',
  },
  {
    value: 'semibold',
    label: 'Semibold',
    family: 'Quicksand_600SemiBold',
    nativeName: 'Quicksand-SemiBold',
  },
  {
    value: 'bold',
    label: 'Bold',
    family: 'Quicksand_700Bold',
    nativeName: 'Quicksand-Bold',
  },
] as const;

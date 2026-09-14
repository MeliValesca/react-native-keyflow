import { useFonts } from 'expo-font';

/** The app owns and loads these font files; Keyflow receives only their names. */
export function useQuicksand() {
  return useFonts({
    Quicksand_400Regular: require('../../assets/fonts/quicksand/Quicksand_400Regular.ttf'),
    Quicksand_600SemiBold: require('../../assets/fonts/quicksand/Quicksand_600SemiBold.ttf'),
    Quicksand_700Bold: require('../../assets/fonts/quicksand/Quicksand_700Bold.ttf'),
  });
}

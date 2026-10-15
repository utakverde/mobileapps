import { Platform } from 'react-native';
import { Redirect } from 'expo-router';

export default function Index() {
  return <Redirect href={(Platform.OS === 'web' ? '/utility-web' : '/splash') as any} />;
}

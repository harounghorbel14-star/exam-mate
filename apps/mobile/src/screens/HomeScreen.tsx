import { View } from 'react-native';
import { useApp } from '../lib/app';
import { Badge, Button, Card, P, Screen, Title, s } from '../components/ui';

export function HomeScreen({ navigation }: { navigation: { navigate(name: string, params?: object): void } }) {
  const { t, user, online } = useApp();
  return (
    <Screen>
      <Title>{user ? t('home.greeting', { name: user.displayName }) : t('app.name')}</Title>
      <P muted>{t('app.tagline')}</P>
      {!online && <Card><P style={{ color: '#fbbf24' }}>{t('offline.banner')}</P></Card>}
      <Card>
        <P style={{ fontWeight: '700' }}>{t('home.quickActions')}</P>
        <View style={s.row}>
          <Button title={t('nav.scan')} variant="primary" onPress={() => navigation.navigate('Scan')} />
          <Button title={t('nav.solver')} onPress={() => navigation.navigate('Solver')} />
          <Button title={t('nav.games')} onPress={() => navigation.navigate('Games')} />
        </View>
      </Card>
      <Card>
        <View style={[s.row, { justifyContent: 'space-between' }]}><P style={{ fontWeight: '700' }}>{t('home.dailyChallenge')}</P><Badge text={t('common.offlineReady')} tone="success" /></View>
        <Button title={t('common.start')} variant="primary" onPress={() => navigation.navigate('GamePlay', { id: 'daily-challenge' })} />
      </Card>
      <Card>
        <View style={s.row}>
          <Button title={t('nav.flashcards')} onPress={() => navigation.navigate('Flashcards')} />
          <Button title={t('nav.documents')} onPress={() => navigation.navigate('Documents')} />
          <Button title={t('nav.progress')} onPress={() => navigation.navigate('Progress')} />
        </View>
      </Card>
    </Screen>
  );
}

import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SUPPORTED_LOCALES, LOCALES } from '@exammate/core';
import { useApp } from '../lib/app';
import { apiBase, setApiBase } from '../lib/api';
import { syncAll } from '../lib/sync';
import { Button, Card, Input, P, Screen, Title, s } from '../components/ui';

export function SettingsScreen() {
  const { t, locale, setLocale, user, login, completeMfa, register, logout, online } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [challenge, setChallenge] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [useRecovery, setUseRecovery] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => { void apiBase().then(setUrl); }, []);
  const run = async (fn: () => Promise<unknown>) => { setMsg(null); try { await fn(); setMsg(t('common.saved')); } catch (e) { setMsg((e as Error).message); } };
  return (
    <Screen>
      <Title>{t('settings.title')}</Title>
      <Card>
        <P style={{ fontWeight: '700' }}>{t('settings.language')}</P>
        <View style={s.row}>{SUPPORTED_LOCALES.map((l) => <Button key={l} title={LOCALES[l].name} variant={l === locale ? 'primary' : 'default'} onPress={() => void setLocale(l).then((r) => setMsg(r.needsRestart ? t('settings.restartForRtl') : null))} />)}</View>
      </Card>
      <Card>
        <P style={{ fontWeight: '700' }}>{user ? user.email : t('auth.login')}</P>
        {user ? (
          <>
            <Button title={t('sync.now')} onPress={() => void run(syncAll)} disabled={!online} />
            <Button title={t('auth.logout')} variant="danger" onPress={() => void logout()} />
          </>
        ) : challenge ? (
          <>
            <P style={{ fontWeight: '700' }}>{t('mfa.loginTitle')}</P>
            <P muted>{useRecovery ? t('mfa.recoveryHelp') : t('mfa.loginHelp')}</P>
            <Input value={code} onChangeText={setCode} placeholder={useRecovery ? t('mfa.recoveryCode') : t('mfa.code')} accessibilityLabel={useRecovery ? t('mfa.recoveryCode') : t('mfa.code')}
              autoCapitalize="none" {...(useRecovery ? {} : { keyboardType: 'number-pad' as const, textContentType: 'oneTimeCode' as const, autoComplete: 'sms-otp' as const, maxLength: 7 })} />
            <Button title={t('mfa.verify')} variant="primary" onPress={() => void (async () => {
              setMsg(null);
              try { await completeMfa(challenge, useRecovery ? { recoveryCode: code } : { code: code.replace(/\s/g, '') }); setChallenge(null); setCode(''); }
              catch (e) {
                const m = (e as Error).message;
                if (/expired/i.test(m)) { setChallenge(null); setMsg(t('mfa.expired')); } else setMsg(t('mfa.invalid'));
              }
            })()} />
            <Button title={useRecovery ? t('mfa.useApp') : t('mfa.useRecovery')} variant="ghost" onPress={() => { setUseRecovery((x) => !x); setCode(''); }} />
          </>
        ) : (
          <>
            <Input value={name} onChangeText={setName} placeholder={t('auth.name')} autoComplete="name" />
            <Input value={email} onChangeText={setEmail} placeholder={t('auth.email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            <Input value={password} onChangeText={setPassword} placeholder={t('auth.password')} secureTextEntry autoComplete="password" />
            <View style={s.row}>
              <Button title={t('auth.login')} variant="primary" onPress={() => void (async () => { setMsg(null); try { const r = await login(email, password); if (r.mfaChallenge) { setChallenge(r.mfaChallenge); setPassword(''); } } catch (e) { setMsg((e as Error).message); } })()} />
              <Button title={t('auth.register')} onPress={() => void run(() => register(email, password, name || 'Student'))} />
            </View>
          </>
        )}
      </Card>
      <Card>
        <P style={{ fontWeight: '700' }}>{t('settings.server')}</P>
        <Input value={url} onChangeText={setUrl} autoCapitalize="none" keyboardType="url" />
        <Button title={t('common.save')} onPress={() => void run(() => setApiBase(url))} />
      </Card>
      <Card><P muted>{t('agent.noExternal')}</P><P muted>{t('settings.mobileVoiceNote')}</P></Card>
      {msg && <P>{msg}</P>}
    </Screen>
  );
}

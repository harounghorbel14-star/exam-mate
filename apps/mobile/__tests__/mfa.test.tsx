import { render, fireEvent, screen, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppProvider } from '../src/lib/app';
import { SettingsScreen } from '../src/screens/SettingsScreen';

describe('mobile two-factor sign-in', () => {
  it('asks for the authenticator code after the password and signs in with it', async () => {
    await AsyncStorage.clear();
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    global.fetch = jest.fn(async (url: string, init?: { body?: string }) => {
      const body = init?.body ? JSON.parse(init.body) : {};
      calls.push({ url, body });
      const json = (o: unknown, status = 200) => ({ ok: status < 400, status, text: async () => JSON.stringify(o) });
      if (url.endsWith('/auth/login')) return json({ mfaRequired: true, challenge: 'chal-123456789' });
      if (url.endsWith('/auth/login/mfa')) {
        if (body.code === '123456') return json({ user: { id: 'u1', email: 'two@factor.test', displayName: 'Two' }, token: 'tok' });
        return json({ error: { code: 'unauthorized', message: 'Invalid code' } }, 401);
      }
      return json({ error: { code: 'not_found', message: 'nf' } }, 404);
    }) as unknown as typeof fetch;
    await render(<AppProvider><SettingsScreen /></AppProvider>);
    await fireEvent.changeText(screen.getByPlaceholderText('Email'), 'two@factor.test');
    await fireEvent.changeText(screen.getByPlaceholderText('Password'), 'a long enough password');
    await fireEvent.press(screen.getByLabelText('Log in'));
    expect(await screen.findByText('Enter your code')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '000000');
    await fireEvent.press(screen.getByLabelText('Verify'));
    expect(await screen.findByText('That code is not valid. Try the newest code from your app.')).toBeTruthy();
    await fireEvent.changeText(screen.getByLabelText('6-digit code'), '123 456');
    await fireEvent.press(screen.getByLabelText('Verify'));
    await waitFor(() => expect(screen.getByText('two@factor.test')).toBeTruthy());
    expect(calls.filter((c) => c.url.endsWith('/auth/login/mfa')).at(-1)!.body).toEqual({ challenge: 'chal-123456789', code: '123456' });
  });
});

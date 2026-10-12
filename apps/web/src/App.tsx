import { lazy, Suspense } from 'react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';

import { I18nProvider } from './lib/i18n';
import { AuthProvider } from './lib/auth';
import { PrefsProvider } from './lib/prefs';
import { Layout } from './components/Layout';
import { Spinner } from './components/ui';

// The static demo build keeps navigation in memory so it works inside any host page.
const Router = import.meta.env.VITE_DEMO ? MemoryRouter : BrowserRouter;

// Large modules are split so the first load stays small.
const Home = lazy(() => import('./pages/Home'));
const Solver = lazy(() => import('./pages/Solver'));
const Scan = lazy(() => import('./pages/Scan'));
const Documents = lazy(() => import('./pages/Documents'));
const DocumentDetail = lazy(() => import('./pages/DocumentDetail'));
const Exams = lazy(() => import('./pages/Exams'));
const ExamTake = lazy(() => import('./pages/ExamTake'));
const Games = lazy(() => import('./pages/Games'));
const GamePlay = lazy(() => import('./pages/GamePlay'));
const Arcade = lazy(() => import('./pages/Arcade'));
const ArcadePlay = lazy(() => import('./pages/ArcadePlay'));
const Play = lazy(() => import('./pages/Play'));
const PlayRoom = lazy(() => import('./pages/PlayRoom'));
const Flashcards = lazy(() => import('./pages/Flashcards'));
const Progress = lazy(() => import('./pages/Progress'));
const Settings = lazy(() => import('./pages/Settings'));
const Tools = lazy(() => import('./pages/Tools'));
const Coach = lazy(() => import('./pages/Coach'));
const Onboarding = lazy(() => import('./pages/Onboarding'));
const AuthPages = lazy(() => import('./pages/Auth'));

export function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <PrefsProvider>
          <Router>
            <Suspense fallback={<div className="content"><Spinner /></div>}>
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="solver" element={<Solver />} />
                  <Route path="scan" element={<Scan />} />
                  <Route path="documents" element={<Documents />} />
                  <Route path="documents/:id" element={<DocumentDetail />} />
                  <Route path="exams" element={<Exams />} />
                  <Route path="exams/:id" element={<ExamTake />} />
                  <Route path="games" element={<Games />} />
                  <Route path="games/:id" element={<GamePlay />} />
                  <Route path="arcade" element={<Arcade />} />
                  <Route path="arcade/:id" element={<ArcadePlay />} />
                  <Route path="play" element={<Play />} />
                  <Route path="play/:code" element={<PlayRoom />} />
                  <Route path="flashcards" element={<Flashcards />} />
                  <Route path="progress" element={<Progress />} />
                  <Route path="settings" element={<Settings />} />
                  <Route path="tools" element={<Tools />} />
                  <Route path="coach" element={<Coach />} />
                  <Route path="onboarding" element={<Onboarding />} />
                  <Route path="login" element={<AuthPages mode="login" />} />
                  <Route path="register" element={<AuthPages mode="register" />} />
                  <Route path="forgot" element={<AuthPages mode="forgot" />} />
                  <Route path="reset-password" element={<AuthPages mode="reset" />} />
                  <Route path="verify-email" element={<AuthPages mode="verify" />} />
                  <Route path="*" element={<Home />} />
                </Route>
              </Routes>
            </Suspense>
          </Router>
        </PrefsProvider>
      </AuthProvider>
    </I18nProvider>
  );
}

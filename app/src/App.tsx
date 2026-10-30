import { useEffect } from 'react';
import { createHashRouter, Outlet, RouterProvider, useNavigate } from 'react-router-dom';
import { entryTarget } from './features/share/entry';
import { initialSchemeUrl } from './platform/toss';
import { Candidates } from './routes/Candidates';
import { Detail } from './routes/Detail';
import { History } from './routes/History';
import { Home } from './routes/Home';
import { Input } from './routes/Input';
import { Join } from './routes/Join';
import { Result } from './routes/Result';
import { RouteView } from './routes/RouteView';
import { Search } from './routes/Search';
import { Settings, SettingsPage } from './routes/Settings';
import { ShareScreen } from './routes/Share';
import { AppStateProvider } from './state/AppState';

/** 토스 링크(intoss://saeit/…)로 들어오면 한 번만 해당 화면으로 보낸다. 검증 실패 시 홈 그대로. */
function EntryRedirect() {
  const navigate = useNavigate();
  useEffect(() => {
    let done = false;
    initialSchemeUrl().then((url) => {
      if (done || !url) return;
      const target = entryTarget(url);
      if (target) navigate(target, { replace: true });
    });
    return () => { done = true; };
  }, [navigate]);
  return <Outlet />;
}

// 해시 라우팅: 앱인토스는 dist 정적 파일을 그대로 열기 때문에 서버 경로 재작성에 기대지 않는다(D-009)
const router = createHashRouter([
  {
    element: <EntryRedirect />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/input', element: <Input /> },
      { path: '/search/:slot', element: <Search /> },
      { path: '/result', element: <Result /> },
      { path: '/candidates', element: <Candidates /> },
      { path: '/detail', element: <Detail /> },
      { path: '/route', element: <RouteView /> },
      { path: '/share', element: <ShareScreen /> },
      { path: '/join', element: <Join /> },
      { path: '/history', element: <History /> },
      { path: '/settings', element: <Settings /> },
      { path: '/settings/:page', element: <SettingsPage /> },
      { path: '*', element: <Home /> },
    ],
  },
]);

export function App() {
  return (
    <AppStateProvider>
      <RouterProvider router={router} />
    </AppStateProvider>
  );
}

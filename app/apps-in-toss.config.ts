import { defineConfig } from '@apps-in-toss/web-framework/config';

export default defineConfig({
  // 콘솔 등록명과 같아야 업로드된다. 'saeit'는 기본 제안값 — 콘솔에서 확정 후 src/platform/toss.ts APP_NAME도 같이 바꾼다.
  appName: 'saeit',
  brand: {
    primaryColor: '#4778F5',
  },
  // 결과 링크 복사(Clipboard.setText)에만 쓴다
  permissions: [{ name: 'clipboard', access: 'write' }],
  // 토스 내비게이션 바의 뒤로가기를 쓰고, 앱은 자체 뒤로가기 버튼을 그리지 않는다(체크리스트: 두 뒤로가기 동시 노출 금지)
  navigationBar: {
    withBackButton: true,
    withHomeButton: true,
  },
  webView: {
    bounces: false,
    pullToRefreshEnabled: false,
  },
  webBundleDir: 'dist',
});

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // 앱인토스는 dist 폴더를 그대로 패키징한다 → 상대 경로로 빌드해 어느 경로에서 열려도 에셋을 찾게 한다
  base: './',
  build: { outDir: 'dist', target: 'es2020' },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});

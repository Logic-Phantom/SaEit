import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react()],
  // 앱인토스는 dist 폴더를 그대로 패키징한다 → 상대 경로로 빌드해 어느 경로에서 열려도 에셋을 찾게 한다
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2020',
    rolldownOptions: {
      output: {
        // 라이브러리·노선 그래프를 앱 코드와 나눠 한 파일이 500 KB를 넘지 않게 한다(설치된 rolldown 1.2 CodeSplittingGroup 타입 확인)
        codeSplitting: {
          groups: [
            { name: 'graph', test: /graph\.v\d+\.json/ },
            { name: 'vendor', test: /node_modules/ },
          ],
        },
      },
    },
  },
  test: { environment: 'node', include: ['tests/**/*.test.ts'] },
});

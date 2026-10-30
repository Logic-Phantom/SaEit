// 토스 앱 안(WebView)인지 판별하고 SDK 호출을 감싼다. SDK는 토스 밖에서 호출하면 throw하므로(설치된 3.9.0 dist 확인:
// window.ReactNativeWebView == null 이면 "apps-in-toss 웹뷰 환경이 아니에요") 같은 조건으로 판별해 브라우저 대체 동작을 쓴다.

export const APP_NAME = 'saeit'; // 콘솔 등록명 확정 전 기본 제안값(apps-in-toss.config.ts와 같게)

declare global {
  interface Window { ReactNativeWebView?: unknown }
}

export function isInToss(): boolean {
  return typeof window !== 'undefined' && window.ReactNativeWebView != null;
}

async function sdk() {
  return import('@apps-in-toss/web-framework');
}

/** 앱에 처음 들어온 스킴 URL(intoss://saeit/result?…). 토스 밖이면 null. */
export async function initialSchemeUrl(): Promise<string | null> {
  if (!isInToss()) return null;
  try {
    return (await sdk()).Environment.initialURL || null;
  } catch {
    return null;
  }
}

/** 결과 공유 링크. 토스: Share.createLink(intoss://), 브라우저: 현재 주소 기준 해시 링크. */
export async function createResultLink(query: string, ogImageUrl?: string): Promise<string> {
  if (isInToss()) {
    const { Share } = await sdk();
    return Share.createLink({ path: `intoss://${APP_NAME}/result?${query}`, ogImageUrl });
  }
  return `${location.origin}${location.pathname}#/result?${query}`;
}

export async function shareMessage(message: string): Promise<'shared' | 'copied'> {
  if (isInToss()) {
    const { Share } = await sdk();
    await Share.sendMessage({ message });
    return 'shared';
  }
  if (navigator.share) {
    try {
      await navigator.share({ text: message });
      return 'shared';
    } catch {
      // 사용자가 취소했거나 미지원 → 복사로 대체
    }
  }
  await copyText(message);
  return 'copied';
}

export async function copyText(text: string): Promise<void> {
  if (isInToss()) {
    const { Clipboard } = await sdk();
    await Clipboard.setText(text);
    return;
  }
  await navigator.clipboard.writeText(text);
}

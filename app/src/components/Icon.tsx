// 자체 제작 선 아이콘(24px, stroke). 외부 아이콘 세트·운영기관 심볼 미사용.
const PATHS = {
  back: 'M15 5l-7 7 7 7',
  chevron: 'M9 5l7 7-7 7',
  chevronDown: 'M6 9l6 6 6-6',
  plus: 'M12 5v14M5 12h14',
  close: 'M6 6l12 12M18 6L6 18',
  home: 'M4 11l8-6 8 6v8a1 1 0 0 1-1 1h-4v-5h-6v5H5a1 1 0 0 1-1-1z',
  history: 'M12 7v5l3 2M4 12a8 8 0 1 0 2.4-5.7M4 4v4h4',
  settings: 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 13.5l1.6 1.2-2 3.4-1.9-.7a7 7 0 0 1-1.9 1.1L14.9 21h-4l-.3-2.5a7 7 0 0 1-1.9-1.1l-1.9.7-2-3.4 1.6-1.2a7 7 0 0 1 0-3L4.8 9.3l2-3.4 1.9.7a7 7 0 0 1 1.9-1.1L10.9 3h4l.3 2.5a7 7 0 0 1 1.9 1.1l1.9-.7 2 3.4-1.6 1.2a7 7 0 0 1 0 3z',
  search: 'M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4',
  share: 'M12 15V4M8 8l4-4 4 4M5 13v6a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-6',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  link: 'M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1',
  info: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v5M12 8h.01',
  arrowRight: 'M5 12h14M13 6l6 6-6 6',
  walk: 'M13 4.5a1.5 1.5 0 1 0 0-.01M10 21l2-6 3 3v3M9 12l2-4 3 1 2 3M11 8l-2 6',
  pin: 'M12 21s-6-5.5-6-11a6 6 0 1 1 12 0c0 5.5-6 11-6 11zM12 12a2 2 0 1 0 0-4 2 2 0 0 0 0 4z',
  doc: 'M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6',
  shield: 'M12 3l7 3v5c0 5-3 8.5-7 10-4-1.5-7-5-7-10V6z',
  trash: 'M5 7h14M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  calc: 'M6 3h12v18H6zM9 7h6M9 11h.01M12 11h.01M15 11h.01M9 15h.01M12 15h.01M15 15h.01',
  person: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4.5 20a7.5 7.5 0 0 1 15 0',
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 22, strokeWidth = 1.9, className }: { name: IconName; size?: number; strokeWidth?: number; className?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[name]} />
    </svg>
  );
}

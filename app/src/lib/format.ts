export function minutes(sec: number): number {
  return Math.max(0, Math.round(sec / 60));
}

export function participantName(nicknames: string[] | undefined, i: number): string {
  return nicknames?.[i]?.trim() || `참가자 ${i + 1}`;
}

export function shortDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getMonth() + 1}월 ${d.getDate()}일`;
}

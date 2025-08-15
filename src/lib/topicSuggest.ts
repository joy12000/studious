// Simple rule-based topic suggestion. Tries to read optional user rules from localStorage.
export type TopicRule = { name: string; keywords: string[] };

const builtin: TopicRule[] = [
  { name: "회의", keywords: ["회의", "안건", "의견", "합의", "미팅", "회의록"] },
  { name: "독서", keywords: ["독서", "책", "인용", "장", "문장", "서평"] },
  { name: "아이디어", keywords: ["아이디어", "가설", "실험", "메모", "브레인스토밍"] },
  { name: "건강", keywords: ["운동", "수면", "식단", "건강", "헬스", "스트레칭"] },
  { name: "학습", keywords: ["학습", "공부", "강의", "강좌", "요약", "노트"] },
];

function loadUserRules(): TopicRule[] {
  const keys = ["topicRules", "topic.rules", "topic.rules.json"];
  for (const k of keys) {
    try {
      const raw = localStorage.getItem(k);
      if (!raw) continue;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        return arr
          .filter(x => x && typeof x.name === "string" && Array.isArray(x.keywords))
          .map(x => ({ name: x.name, keywords: x.keywords.filter((w: any) => typeof w === "string") }));
      }
    } catch {}
  }
  return [];
}

export function suggestTopics(text: string, max = 5): string[] {
  if (!text || !text.trim()) return [];
  const rules = [...loadUserRules(), ...builtin];
  const lc = text.toLowerCase();
  const hits = new Map<string, number>();
  for (const r of rules) {
    for (const kw of r.keywords) {
      const k = String(kw).toLowerCase();
      if (!k) continue;
      if (lc.includes(k)) {
        hits.set(r.name, (hits.get(r.name) || 0) + k.length);
      }
    }
  }
  return Array.from(hits.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max)
    .map(([name]) => name);
}

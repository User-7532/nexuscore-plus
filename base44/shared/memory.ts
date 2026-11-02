// ほかのAIとの会話などから覚えた、本人についての要点。どのAIの返答にも渡す
export async function loadMemory(base44) {
  const page = await base44.entities.AssistantMemory.list({ sort: '-updated_date', limit: 1 }).catch(() => ({ items: [] }));
  return (page.items || [])[0] || null;
}

export async function memoryBlock(base44) {
  const memory = await loadMemory(base44);
  const summary = String(memory?.summary || '').trim();
  if (!summary) return '';
  return `[これまでに分かっている本人のこと（ほかのAIとの会話などから）]\n${summary}\nこれは参考情報。今回の発話や記録と食い違うときは、今回の発話と記録を優先する。`;
}

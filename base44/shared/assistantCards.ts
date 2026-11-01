// 全画面共通のAIチャットで、最後にカードにした発言を探す
export async function lastCardMark(base44) {
  const page = await base44.entities.AssistantMessage.filter(
    { cards_checked: true },
    { sort: '-created_date', limit: 1 }
  );
  return (page.items || [])[0] || null;
}

// 前回カードにしてから、ユーザーが何回話しかけたか
export async function userTurnsSinceMark(base44) {
  const mark = await lastCardMark(base44);
  const query = mark ? { created_date: { $gt: mark.created_date }, role: 'user' } : { role: 'user' };
  const page = await base44.entities.AssistantMessage.filter(query, { sort: '-created_date', limit: 10 });
  return (page.items || []).length;
}

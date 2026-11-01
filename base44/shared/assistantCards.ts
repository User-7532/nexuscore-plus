// 全画面共通のAIチャットで、最後にカードにした発言を探す
export async function lastCardMark(base44) {
  const page = await base44.entities.AssistantMessage.filter(
    { cards_checked: true },
    { sort: '-created_date', limit: 1 }
  );
  return (page.items || [])[0] || null;
}

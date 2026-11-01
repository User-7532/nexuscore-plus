const EVENT = 'nexuscore:ask-selection';

// 選択した文章を「AIチャットへの引用」として渡す
export function askAboutSelection(text) {
  const value = String(text || '').trim();
  if (!value) return;
  window.dispatchEvent(new CustomEvent(EVENT, { detail: value }));
}

export function onAskSelection(handler) {
  const listener = (e) => handler(String(e.detail || ''));
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
}

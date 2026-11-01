// 知識カードの分類。サーバー側の base44/shared/taxonomy.ts と同じ内容を保つ
// mode: fact=事実や定義で正誤が決まる / interpret=解釈が中心で、観点を満たしているかで判定する
export const FIELDS = [
  {
    id: 'active-inference',
    label: '能動的推論',
    subfields: [
      { id: 'fep-core', label: '自由エネルギー原理の基礎', mode: 'fact' },
      { id: 'bayes-variational', label: 'ベイズ推論と変分推論', mode: 'fact' },
      { id: 'probability', label: '確率論・測度論', mode: 'fact' },
      { id: 'info-geometry', label: '情報幾何', mode: 'fact' },
      { id: 'predictive-coding', label: '生成モデルと予測符号化', mode: 'fact' },
      { id: 'action-selection', label: '期待自由エネルギーと行為選択', mode: 'fact' },
      { id: 'markov-blanket', label: 'マルコフブランケット', mode: 'fact' },
      { id: 'social-inference', label: '集団・社会と能動的推論', mode: 'interpret' },
    ],
  },
  {
    id: 'math-physics',
    label: '数理物理',
    subfields: [
      { id: 'complex-systems', label: '複雑系科学', mode: 'fact' },
      { id: 'information-theory', label: '情報理論', mode: 'fact' },
      { id: 'differential-geometry', label: '微分幾何学', mode: 'fact' },
      { id: 'stat-mech', label: '統計力学・非平衡熱力学', mode: 'fact' },
      { id: 'dynamical-systems', label: '力学系とカオス', mode: 'fact' },
      { id: 'stochastic', label: '確率過程', mode: 'fact' },
    ],
  },
  {
    id: 'computation',
    label: '計算理論',
    subfields: [
      { id: 'turing', label: 'チューリングマシンと計算可能性', mode: 'fact' },
      { id: 'complexity', label: '計算複雑性', mode: 'fact' },
      { id: 'ait', label: 'アルゴリズム情報理論', mode: 'fact' },
      { id: 'godel', label: 'ゲーデルの不完全性定理', mode: 'fact' },
      { id: 'cellular-automata', label: 'セルオートマトンとライフゲーム', mode: 'fact' },
      { id: 'formal-languages', label: '形式言語とラムダ計算', mode: 'fact' },
    ],
  },
  {
    id: 'neuroscience',
    label: '神経科学',
    subfields: [
      { id: 'anatomy', label: '脳部位と機能解剖', mode: 'fact' },
      { id: 'biochemistry', label: '神経生化学', mode: 'fact' },
      { id: 'pharmacology', label: '神経薬理', mode: 'fact' },
      { id: 'cellular', label: '細胞・シナプス生理', mode: 'fact' },
      { id: 'computational-neuro', label: '計算論的神経科学', mode: 'fact' },
      { id: 'consciousness', label: '意識と知覚の神経基盤', mode: 'fact' },
      { id: 'neuro-case', label: '宗教・文化的実践と神経科学', mode: 'interpret' },
      { id: 'thought-neuro', label: '思想と神経科学', mode: 'interpret' },
      { id: 'hidden-suffering', label: '見えにくい苦しみの神経科学', mode: 'interpret' },
    ],
  },
];

export const fieldOf = (id) => FIELDS.find((f) => f.id === id) || null;

export const subfieldOf = (fieldId, subId) => fieldOf(fieldId)?.subfields.find((s) => s.id === subId) || null;

export const fieldLabel = (id) => fieldOf(id)?.label || '未分類';

export const subfieldLabel = (fieldId, subId) => subfieldOf(fieldId, subId)?.label || '';

// カードの見出しに出す分野名。分類がないカードは元の domain を使う
export const cardPlace = (card) =>
  card?.field ? [fieldLabel(card.field), subfieldLabel(card.field, card.subfield)].filter(Boolean).join(' / ') : card?.domain || '未分類';

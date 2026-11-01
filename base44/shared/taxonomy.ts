// 知識カードの分類。フロントの src/lib/taxonomy.js と同じ内容を保つ
// mode: fact=事実や定義で正誤が決まる / interpret=解釈が中心で、観点を満たしているかで判定する
export const FIELDS = [
  {
    id: 'active-inference',
    label: '能動的推論',
    subfields: [
      { id: 'fep-core', label: '自由エネルギー原理の基礎', mode: 'fact', scope: '変分自由エネルギー、驚き（サプライザル）、恒常性との関係' },
      { id: 'bayes-variational', label: 'ベイズ推論と変分推論', mode: 'fact', scope: 'ベイズの定理、事後分布、KLダイバージェンス、ELBO、平均場近似' },
      { id: 'probability', label: '確率論・測度論', mode: 'fact', scope: '確率空間、確率変数、条件付き期待値、測度と積分の基礎' },
      { id: 'info-geometry', label: '情報幾何', mode: 'fact', scope: 'フィッシャー情報量、統計多様体、自然勾配' },
      { id: 'predictive-coding', label: '生成モデルと予測符号化', mode: 'fact', scope: '階層的生成モデル、予測誤差、精度（precision）の重みづけ' },
      { id: 'action-selection', label: '期待自由エネルギーと行為選択', mode: 'fact', scope: '期待自由エネルギー、認識的価値と実用的価値、方策の推論' },
      { id: 'markov-blanket', label: 'マルコフブランケット', mode: 'fact', scope: '条件付き独立、内部状態と外部状態、境界の定義をめぐる議論' },
      { id: 'social-inference', label: '集団・社会と能動的推論', mode: 'interpret', scope: '集団の維持、規範や文化の共有、集団での信念の同期を、能動的推論の枠組みで捉える試み' },
    ],
  },
  {
    id: 'math-physics',
    label: '数理物理',
    subfields: [
      { id: 'complex-systems', label: '複雑系科学', mode: 'fact', scope: '創発、自己組織化、べき乗則、ネットワーク科学' },
      { id: 'information-theory', label: '情報理論', mode: 'fact', scope: 'シャノンエントロピー、相互情報量、通信路容量、符号化定理' },
      { id: 'differential-geometry', label: '微分幾何学', mode: 'fact', scope: '多様体、接空間、計量、接続、曲率' },
      { id: 'stat-mech', label: '統計力学・非平衡熱力学', mode: 'fact', scope: 'ボルツマン分布、自由エネルギー、ゆらぎの定理、散逸構造' },
      { id: 'dynamical-systems', label: '力学系とカオス', mode: 'fact', scope: '相空間、アトラクター、分岐、リアプノフ指数' },
      { id: 'stochastic', label: '確率過程', mode: 'fact', scope: 'マルコフ過程、ランジュバン方程式、フォッカー・プランク方程式' },
    ],
  },
  {
    id: 'computation',
    label: '計算理論',
    subfields: [
      { id: 'turing', label: 'チューリングマシンと計算可能性', mode: 'fact', scope: 'チューリングマシン、停止問題、チャーチ＝チューリングのテーゼ' },
      { id: 'complexity', label: '計算複雑性', mode: 'fact', scope: 'P と NP、NP完全、還元、時間・空間計算量' },
      { id: 'ait', label: 'アルゴリズム情報理論', mode: 'fact', scope: 'コルモゴロフ複雑性、チャイティンの Ω、ランダム性の定義' },
      { id: 'godel', label: 'ゲーデルの不完全性定理', mode: 'fact', scope: '第一・第二不完全性定理、ゲーデル数化、形式体系の限界' },
      { id: 'cellular-automata', label: 'セルオートマトンとライフゲーム', mode: 'fact', scope: 'ライフゲームの規則、グライダー、計算万能性、ウルフラムの分類' },
      { id: 'formal-languages', label: '形式言語とラムダ計算', mode: 'fact', scope: 'チョムスキー階層、オートマトン、ラムダ計算' },
    ],
  },
  {
    id: 'neuroscience',
    label: '神経科学',
    subfields: [
      { id: 'anatomy', label: '脳部位と機能解剖', mode: 'fact', scope: '大脳皮質の領野、大脳辺縁系、基底核、小脳、脳幹' },
      { id: 'biochemistry', label: '神経生化学', mode: 'fact', scope: '神経伝達物質の合成と分解、受容体、セカンドメッセンジャー' },
      { id: 'pharmacology', label: '神経薬理', mode: 'fact', scope: '作動薬と拮抗薬、再取り込み阻害、主要な薬物の作用機序' },
      { id: 'cellular', label: '細胞・シナプス生理', mode: 'fact', scope: '活動電位、シナプス可塑性、LTP・LTD' },
      { id: 'computational-neuro', label: '計算論的神経科学', mode: 'fact', scope: '神経回路モデル、強化学習とドーパミン、ベイズ脳' },
      { id: 'consciousness', label: '意識と知覚の神経基盤', mode: 'fact', scope: '意識の神経相関、主要な意識理論とその検証状況' },
      { id: 'neuro-case', label: '宗教・文化的実践と神経科学', mode: 'interpret', scope: '宗教的実践や文化の中の事例（例: スーフィズムのマジュズーブ、瞑想、儀礼）を、神経科学の知見と照らして考察する' },
      { id: 'thought-neuro', label: '思想と神経科学', mode: 'interpret', scope: '哲学・宗教思想・心理学の考え方と、神経科学の知見を結びつける' },
      { id: 'hidden-suffering', label: '見えにくい苦しみの神経科学', mode: 'interpret', scope: '外から見えにくい苦しみの例と、その背景にある神経科学的な仕組み' },
    ],
  },
];

// 社会科学は単独の分野にしない。社会・文化の話題は、上のどれかの分野とつながる場合だけ扱う
export const SCOPE_RULE = `分類は上の4分野だけ。社会・文化・経済・歴史・地政学などの話題は、能動的推論・数理物理・計算理論・神経科学のどれかと実際につながる内容だけを、その分野に入れる。どの分野ともつながらない純粋な社会科学の内容は扱わない。`;

// 解釈が中心の下位分野のID
export const INTERPRET_IDS = FIELDS.flatMap((f) => f.subfields.filter((s) => s.mode === 'interpret').map((s) => s.id));

export function findSubfield(fieldId, subfieldId) {
  const field = FIELDS.find((f) => f.id === fieldId);
  const sub = field?.subfields.find((s) => s.id === subfieldId);
  return field && sub ? { field, sub } : null;
}

export function taxonomyList() {
  return FIELDS.map((f) => `${f.id}（${f.label}）: ${f.subfields.map((s) => `${s.id}=${s.label}`).join(' / ')}`).join('\n');
}

// 解釈が中心の分野で守る書き方。カード・問題・採点で共通に使う
export const INTERPRET_RULES = `この分野は解釈が中心になる。次を必ず守る。
- 確かめられること（史料・研究で裏づけのある事実、確立した神経科学の知見）と、解釈・仮説を分けて書く。解釈を事実のように書かない。
- 宗教的・文化的な経験を、神経科学の説明だけに還元しない。神経科学は一つの見方として示し、当事者の文化の中での意味も尊重する。
- 過去の人物や集団に、医学的な診断名を断定的に当てはめない。「〜という仮説がある」「〜と比べて考えられる」の形にする。
- 苦しみを扱うときは、当事者を見下したり、単純な原因に帰したりしない。`;

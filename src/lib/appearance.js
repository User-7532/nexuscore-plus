// 背景のトーン・アクセント色・書体を切り替える。設定はこのブラウザにだけ保存する
const KEY = 'attractor:appearance';

export const TONES = [
  {
    id: 'kinari',
    label: '生成り',
    swatch: '#f6f2ea',
    vars: {
      '--background': '40 33% 96%',
      '--foreground': '30 14% 22%',
      '--card': '42 44% 98%',
      '--card-foreground': '30 14% 22%',
      '--popover': '42 44% 99%',
      '--popover-foreground': '30 14% 22%',
      '--secondary': '40 24% 92%',
      '--secondary-foreground': '30 14% 26%',
      '--muted': '40 20% 93%',
      '--muted-foreground': '30 10% 46%',
      '--border': '38 20% 87%',
      '--input': '38 20% 87%',
      '--sidebar-background': '42 30% 94%',
      '--sidebar-foreground': '30 14% 26%',
      '--sidebar-accent': '40 26% 89%',
      '--sidebar-border': '38 20% 87%',
    },
  },
  {
    id: 'hakuji',
    label: '白磁',
    swatch: '#fbfbf9',
    vars: {
      '--background': '60 14% 98%',
      '--foreground': '220 10% 20%',
      '--card': '0 0% 100%',
      '--card-foreground': '220 10% 20%',
      '--popover': '0 0% 100%',
      '--popover-foreground': '220 10% 20%',
      '--secondary': '60 8% 94%',
      '--secondary-foreground': '220 10% 24%',
      '--muted': '60 8% 95%',
      '--muted-foreground': '220 6% 46%',
      '--border': '60 6% 88%',
      '--input': '60 6% 88%',
      '--sidebar-background': '60 10% 96%',
      '--sidebar-foreground': '220 10% 24%',
      '--sidebar-accent': '60 8% 92%',
      '--sidebar-border': '60 6% 88%',
    },
  },
  {
    id: 'yoru',
    label: '夜',
    swatch: '#23211e',
    vars: {
      '--background': '30 8% 11%',
      '--foreground': '40 20% 90%',
      '--card': '30 8% 14%',
      '--card-foreground': '40 20% 90%',
      '--popover': '30 8% 14%',
      '--popover-foreground': '40 20% 90%',
      '--secondary': '30 7% 19%',
      '--secondary-foreground': '40 16% 86%',
      '--muted': '30 7% 18%',
      '--muted-foreground': '35 8% 62%',
      '--border': '30 7% 23%',
      '--input': '30 7% 23%',
      '--sidebar-background': '30 8% 12%',
      '--sidebar-foreground': '40 16% 86%',
      '--sidebar-accent': '30 7% 18%',
      '--sidebar-border': '30 7% 23%',
    },
  },
];

// 夜のトーンでは、同じ色相のまま明るめにして読みやすくする
export const ACCENTS = [
  { id: 'tsuchi', label: '土', swatch: '#916a52', light: '22 30% 44%', dark: '24 40% 64%' },
  { id: 'koke', label: '苔', swatch: '#5c7350', light: '100 18% 38%', dark: '100 22% 60%' },
  { id: 'ai', label: '藍', swatch: '#476784', light: '210 30% 40%', dark: '208 38% 66%' },
  { id: 'beni', label: '紅', swatch: '#9c4a5a', light: '350 35% 45%', dark: '350 45% 68%' },
  { id: 'sumi', label: '墨', swatch: '#46423c', light: '30 8% 26%', dark: '40 10% 80%' },
];

export const FONTS = [
  { id: 'mixed', label: '見出しは明朝、本文はゴシック', heading: "'Noto Serif JP', 'Hiragino Mincho ProN', serif", body: "'Zen Kaku Gothic New', 'Hiragino Kaku Gothic ProN', system-ui, sans-serif" },
  { id: 'gothic', label: 'すべてゴシック', heading: "'Zen Kaku Gothic New', 'Hiragino Kaku Gothic ProN', system-ui, sans-serif", body: "'Zen Kaku Gothic New', 'Hiragino Kaku Gothic ProN', system-ui, sans-serif" },
  { id: 'mincho', label: 'すべて明朝', heading: "'Noto Serif JP', 'Hiragino Mincho ProN', serif", body: "'Noto Serif JP', 'Hiragino Mincho ProN', serif" },
];

export const DEFAULT_APPEARANCE = { tone: 'kinari', accent: 'tsuchi', font: 'mixed' };

export function loadAppearance() {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || 'null');
    return { ...DEFAULT_APPEARANCE, ...(saved || {}) };
  } catch {
    return { ...DEFAULT_APPEARANCE };
  }
}

export function saveAppearance(value) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(value));
  } catch {
    // 保存できない環境では、このページを開いているあいだだけ反映する
  }
}

export function applyAppearance(value) {
  const root = document.documentElement;
  const tone = TONES.find((t) => t.id === value.tone) || TONES[0];
  const accent = ACCENTS.find((a) => a.id === value.accent) || ACCENTS[0];
  const font = FONTS.find((f) => f.id === value.font) || FONTS[0];
  const dark = tone.id === 'yoru';

  Object.entries(tone.vars).forEach(([k, v]) => root.style.setProperty(k, v));
  const primary = dark ? accent.dark : accent.light;
  root.style.setProperty('--primary', primary);
  root.style.setProperty('--ring', primary);
  root.style.setProperty('--sidebar-primary', primary);
  root.style.setProperty('--chart-1', primary);
  root.style.setProperty('--primary-foreground', dark ? '30 10% 10%' : '40 40% 98%');
  root.style.setProperty('--sidebar-primary-foreground', dark ? '30 10% 10%' : '40 40% 98%');
  root.style.setProperty('--font-heading', font.heading);
  root.style.setProperty('--font-display', font.heading);
  root.style.setProperty('--font-body', font.body);
  root.style.colorScheme = dark ? 'dark' : 'light';
}

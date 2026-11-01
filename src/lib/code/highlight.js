// エディタ用の軽い構文の色分け。入力はすべてエスケープしてから色を付ける
const escapeHtml = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const CPP_KEYWORDS = [
  'int','long','short','unsigned','signed','float','double','char','bool','void','auto','const','constexpr','static','inline',
  'struct','class','public','private','protected','template','typename','using','namespace','return','if','else','for','while',
  'do','switch','case','default','break','continue','new','delete','nullptr','true','false','sizeof','virtual','override','friend',
  'operator','try','catch','throw','this','std','vector','string','unordered_map','unordered_set','map','set','queue','stack',
  'priority_queue','pair','tuple','deque','sort','max','min','swap','push_back','emplace_back','size_t','cout','cin','endl',
  'begin','end','first','second','make_pair','memset','printf','scanf','malloc','free',
];

const C_KEYWORDS = [
  'int','long','short','unsigned','signed','float','double','char','void','const','static','inline','extern','register','volatile',
  'struct','union','enum','typedef','sizeof','return','if','else','for','while','do','switch','case','default','break','continue',
  'goto','NULL','true','false','bool','size_t','FILE','EOF','stdin','stdout',
  'printf','scanf','fprintf','sprintf','puts','putchar','getchar','fgets','fopen','fclose',
  'malloc','calloc','realloc','free','memset','memcpy','strlen','strcpy','strncpy','strcmp','strcat','log','log2','exp','sqrt','pow',
];

const PY_KEYWORDS = [
  'def','return','if','elif','else','for','while','in','not','and','or','import','from','as','class','try','except','finally',
  'raise','with','lambda','yield','pass','break','continue','global','nonlocal','assert','del','is','None','True','False',
  'self','print','len','range','enumerate','sorted','list','dict','set','tuple','str','int','float','bool','sum','min','max',
  'zip','map','filter','append','collections','deque','defaultdict','heapq','math','random',
];

const build = (language) => {
  const kw = (language === 'python' ? PY_KEYWORDS : language === 'c' ? C_KEYWORDS : CPP_KEYWORDS).join('|');
  if (language === 'python') {
    return new RegExp(
      `(?<str>"""[\\s\\S]*?"""|'''[\\s\\S]*?'''|"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')` +
        `|(?<com>#[^\\n]*)` +
        `|(?<num>\\b\\d[\\w.]*\\b)` +
        `|(?<kw>\\b(?:${kw})\\b)` +
        `|(?<fn>\\b[A-Za-z_]\\w*(?=\\())`,
      'g'
    );
  }
  return new RegExp(
    `(?<str>"(?:\\\\.|[^"\\\\])*"|'(?:\\\\.|[^'\\\\])*')` +
      `|(?<com>\\/\\/[^\\n]*|\\/\\*[\\s\\S]*?\\*\\/)` +
      `|(?<meta>^[ \\t]*#[ \\t]*\\w+)` +
      `|(?<num>\\b\\d[\\w.]*\\b)` +
      `|(?<kw>\\b(?:${kw})\\b)` +
      `|(?<fn>\\b[A-Za-z_]\\w*(?=\\())`,
    'gm'
  );
};

export function highlight(code, language) {
  const source = code || '';
  const re = build(language);
  let out = '';
  let last = 0;
  let m = re.exec(source);
  while (m) {
    if (m.index > last) out += escapeHtml(source.slice(last, m.index));
    const g = m.groups || {};
    const cls = g.str ? 'str' : g.com ? 'com' : g.meta ? 'meta' : g.num ? 'num' : g.kw ? 'kw' : 'fn';
    out += `<span class="tk-${cls}">${escapeHtml(m[0])}</span>`;
    last = m.index + m[0].length;
    if (m[0].length === 0) re.lastIndex += 1;
    m = re.exec(source);
  }
  out += escapeHtml(source.slice(last));
  return out;
}

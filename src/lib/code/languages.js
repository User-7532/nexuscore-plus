export const LANGUAGES = [
  { id: 'python', label: 'Python', filename: 'solution.py' },
  { id: 'cpp', label: 'C++', filename: 'solution.cpp' },
  { id: 'c', label: 'C', filename: 'solution.c' },
];

export const languageLabel = (id) => LANGUAGES.find((l) => l.id === id)?.label || id;

export const languageFilename = (id) => LANGUAGES.find((l) => l.id === id)?.filename || `solution.${id}`;

export function getTemplate(problem, languageId) {
  const found = (problem?.templates || []).find((t) => t.language === languageId);
  return found?.code || '';
}

export function fallbackTemplate(languageId) {
  if (languageId === 'python') return 'def solve(data):\n    # ここに書く\n    return None\n';
  if (languageId === 'c') {
    return '#include <stdio.h>\n#include <stdlib.h>\n#include <string.h>\n\nint main(void) {\n    // ここに書く\n    return 0;\n}\n';
  }
  return '#include <bits/stdc++.h>\nusing namespace std;\n\nint main() {\n    // ここに書く\n    return 0;\n}\n';
}

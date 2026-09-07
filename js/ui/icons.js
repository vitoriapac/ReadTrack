// Ícones minimalistas em SVG puro (stroke, 1.6px), para não depender
// de nenhuma biblioteca de ícones externa.

const wrap = (inner, size = 16) =>
  `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${inner}</svg>`;

export const icons = {
  dashboard: wrap('<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>'),
  library: wrap('<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H9v18H5.5A1.5 1.5 0 0 1 4 19.5v-15Z"/><path d="M9 3h6v18H9z"/><path d="M15 4.2 19.4 5.6a1.5 1.5 0 0 1 1 1.9l-4.4 13.5"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
  search: wrap('<circle cx="11" cy="11" r="7"/><path d="m20 20-3.2-3.2"/>'),
  kebab: wrap('<circle cx="12" cy="5" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.4" fill="currentColor" stroke="none"/><circle cx="12" cy="19" r="1.4" fill="currentColor" stroke="none"/>'),
  close: wrap('<path d="M6 6l12 12M18 6 6 18"/>'),
  book: wrap('<path d="M4 4.5A1.5 1.5 0 0 1 5.5 3H12v18H5.5A1.5 1.5 0 0 1 4 19.5v-15Z"/><path d="M12 3h6.5A1.5 1.5 0 0 1 20 4.5v15a1.5 1.5 0 0 1-1.5 1.5H12"/>'),
  check: wrap('<path d="M5 13l4 4L19 7"/>'),
  pause: wrap('<rect x="6" y="4" width="4" height="16" rx="1"/><rect x="14" y="4" width="4" height="16" rx="1"/>'),
  play: wrap('<path d="M7 4l13 8-13 8V4Z"/>'),
  flag: wrap('<path d="M5 21V4"/><path d="M5 5h13l-3 4 3 4H5"/>'),
  trash: wrap('<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="M6 7l1 13h10l1-13"/>'),
  edit: wrap('<path d="M4 20h4l10.5-10.5a2 2 0 0 0 0-2.8l-1.2-1.2a2 2 0 0 0-2.8 0L4 16v4Z"/>'),
  quill: wrap('<path d="M20 4c-6 1-11 6-14 14 8-3 13-8 14-14Z"/><path d="M6 18 4 20"/>'),
};

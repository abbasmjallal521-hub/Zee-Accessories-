// Shared bits for the shop and admin pages
const S = 'fill="none" stroke="url(#gold)" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"';
const I = {
  watch:`<svg viewBox="0 0 48 48" ${S}><rect x="17" y="3" width="14" height="9" rx="2"/><rect x="17" y="36" width="14" height="9" rx="2"/><circle cx="24" cy="24" r="12"/><path d="M24 17v7l5 3"/></svg>`,
  wallet:`<svg viewBox="0 0 48 48" ${S}><rect x="6" y="12" width="36" height="26" rx="4"/><path d="M42 21H32a4 4 0 0 0 0 8h10"/><path d="M10 12l20-6 3 6"/></svg>`,
  glasses:`<svg viewBox="0 0 48 48" ${S}><path d="M4 22h40"/><path d="M6 22c0 8 3 11 8 11s8-4 8-11"/><path d="M26 22c0 7 3 11 8 11s8-3 8-11"/><path d="M22 23c1-2 3-2 4 0"/></svg>`,
  bracelet:`<svg viewBox="0 0 48 48" ${S}><ellipse cx="24" cy="24" rx="17" ry="11"/><circle cx="24" cy="13" r="2.4"/><circle cx="12" cy="17" r="2.4"/><circle cx="36" cy="17" r="2.4"/><circle cx="9" cy="27" r="2.4"/><circle cx="39" cy="27" r="2.4"/></svg>`,
  belt:`<svg viewBox="0 0 48 48" ${S}><path d="M2 20h44v8H2z"/><rect x="14" y="15" width="12" height="18" rx="2"/><path d="M20 24h10"/></svg>`,
  cuff:`<svg viewBox="0 0 48 48" ${S}><rect x="6" y="14" width="16" height="16" rx="3"/><rect x="26" y="14" width="16" height="16" rx="3"/><path d="M14 30v6M34 30v6M10 36h8M30 36h8"/></svg>`,
  necklace:`<svg viewBox="0 0 48 48" ${S}><path d="M8 6c0 14 7 22 16 22s16-8 16-22"/><path d="M24 28l-5 7 5 7 5-7z"/></svg>`,
  earrings:`<svg viewBox="0 0 48 48" ${S}><circle cx="14" cy="8" r="3"/><circle cx="34" cy="8" r="3"/><path d="M14 11v6M34 11v6"/><path d="M14 17c-6 8-6 18 0 24 6-6 6-16 0-24zM34 17c-6 8-6 18 0 24 6-6 6-16 0-24z"/></svg>`,
  ring:`<svg viewBox="0 0 48 48" ${S}><circle cx="24" cy="30" r="13"/><path d="M18 12l6-7 6 7-6 5z"/></svg>`,
  bag:`<svg viewBox="0 0 48 48" ${S}><path d="M8 18h32l-3 24H11z"/><path d="M17 18v-4a7 7 0 0 1 14 0v4"/><path d="M20 26h8"/></svg>`,
  scarf:`<svg viewBox="0 0 48 48" ${S}><path d="M10 6h28l-6 12H16z"/><path d="M16 18l-4 24h8l4-16 4 16h8l-4-24"/></svg>`,
  clip:`<svg viewBox="0 0 48 48" ${S}><path d="M6 20h36v8H6z"/><circle cx="12" cy="24" r="6"/><circle cx="12" cy="24" r="2"/></svg>`
};
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money = n => '$' + (+n).toFixed(n % 1 ? 2 : 0);
const pics = p => (Array.isArray(p.imgs) && p.imgs.length) ? p.imgs : (p.img ? [p.img] : []);
const visual = p => pics(p).length ? `<img src="${esc(pics(p)[0])}" alt="" loading="lazy">` : (I[p.icon] || I.necklace);
// Card picture: one image, a swipeable set with dots, or the gold icon
const gallery = p => {
  const list = pics(p);
  if (list.length < 2) return visual(p);
  return `<div class="slides">${list.map(u => `<img src="${esc(u)}" alt="" loading="lazy">`).join('')}</div>`
    + `<div class="dots">${list.map((_, i) => `<i class="${i ? '' : 'on'}"></i>`).join('')}</div>`;
};

'use strict';
let content, activeType = '全部';
const authorFilter = new URLSearchParams(location.search).get('author') || '';
const $ = s => document.querySelector(s);
function el(tag, text, cls) { const node = document.createElement(tag); if (text != null) node.textContent = text; if (cls) node.className = cls; return node; }
function safeUrl(value) { try { const u = new URL(value); return u.protocol === 'https:' ? u.href : ''; } catch { return ''; } }
function externalLink(url, label) { const a = el('a', label); a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; return a; }
function workTypes(work) { return Array.isArray(work.types) ? work.types : String(work.type || '').split('、'); }
function selectWorks(works, authors, { authorId = '', latest = false, type = '全部', term = '' } = {}) {
  const names = new Map(authors.map(a => [a.id, a.name]));
  let selected = works.map((work, index) => ({ work, index })).filter(({ work }) => names.has(work.authorId) && (!authorId || work.authorId === authorId));
  selected.sort((a, b) => (Date.parse(b.work.submittedAt || b.work.date) || 0) - (Date.parse(a.work.submittedAt || a.work.date) || 0) || b.index - a.index);
  if (latest) selected = selected.slice(0, 10);
  return selected.map(item => item.work).filter(w => (type === '全部' || workTypes(w).includes(type)) && `${w.title} ${w.text || ''} ${w.description || ''} ${names.get(w.authorId)}`.toLocaleLowerCase().includes(term.toLocaleLowerCase()));
}
function showWork(work) {
  const box = $('#reader-content'); box.replaceChildren();
  const author = content.authors.find(a => a.id === work.authorId);
  box.append(el('p', workTypes(work).join(' / '), 'eyebrow'), el('h2', work.title), el('p', `${author?.name || '作者'} · ${work.date || ''}`, 'muted'));
  if (work.text) box.append(el('div', work.text, 'poem'));
  if (work.description) box.append(el('h3', '作品說明'), el('div', work.description, 'work-description'));
  const imageUrl = safeUrl(work.imageUrl || (work.type === '圖片' ? work.url : ''));
  const videoUrl = safeUrl(work.videoUrl || (work.type === '影片' ? work.url : ''));
  if (imageUrl) box.append(externalLink(imageUrl, '開啟雲端圖片 ↗'));
  if (videoUrl) box.append(externalLink(videoUrl, '前往觀看影片 ↗'));
  if (work.type === '詩歌' && safeUrl(work.url)) box.append(externalLink(safeUrl(work.url), '開啟作品連結 ↗'));
  $('#reader').showModal();
}
function renderWorks() {
  if (!$('#works-grid')) return;
  const term = $('#search').value.trim().toLocaleLowerCase();
  const isAuthorPage = document.body.dataset.page === 'author';
  if (isAuthorPage && !content.authors.some(a => a.id === authorFilter)) {
    $('#work-count').textContent = '';
    $('#works-grid').replaceChildren(el('p', '找不到這位同仁，請返回同仁名錄選擇作者。', 'empty'));
    return;
  }
  const works = selectWorks(content.works, content.authors, { authorId: isAuthorPage ? authorFilter : '', latest: !isAuthorPage, type: activeType, term });
  $('#work-count').textContent = `${works.length} 件作品`;
  const grid = $('#works-grid'); grid.replaceChildren();
  if (!works.length) grid.append(el('p', '暫無符合條件的作品。可清除搜尋或選擇「全部作品」。', 'empty'));
  works.forEach(w => {
    const a = content.authors.find(a => a.id === w.authorId);
    const card = el('button', null, 'card'); card.type = 'button';
    const bottom = el('div', null, 'card-bottom'); bottom.append(el('span', a.name), el('span', '閱讀作品 ↗'));
    card.append(el('span', workTypes(w).join(' / '), 'meta'), el('h3', w.title), el('div', (w.text || w.description || '以影像，寫下另一種詩。').slice(0, 100), 'excerpt'), bottom);
    card.addEventListener('click', () => showWork(w)); grid.append(card);
  });
}
async function init() {
  try {
    const response = await fetch('data/content.json', { cache: 'no-store' });
    if (!response.ok) throw new Error('資料讀取失敗');
    content = await response.json();
    if (!Array.isArray(content.authors) || !Array.isArray(content.works)) throw new Error('資料格式錯誤');
    $('#notice').textContent = content.demo ? '目前為網站示範：作者與作品皆為示例，正式同步後會替換為審核通過的資料。' : '';
    if ($('#authors-grid')) content.authors.forEach(a => {
      const card = el('article', null, 'author'), button = el('a', '閱讀作品 →');
      button.href = `author.html?author=${encodeURIComponent(a.id)}`;
      card.append(el('div', a.name.slice(0, 1), 'avatar'), el('h3', a.name), el('p', a.bio), button);
      $('#authors-grid').append(card);
    });
    if ($('#authors-grid') && !content.authors.length) $('#authors-grid').append(el('p', '同仁名錄將於創作者通過審核後開放。', 'empty'));
    if (document.body.dataset.page === 'author') {
      const author = content.authors.find(a => a.id === authorFilter);
      $('#author-name').textContent = author ? `${author.name}的作品` : '找不到這位同仁';
      $('#author-bio').textContent = author?.bio || '';
      document.title = author ? `${author.name}的作品 · 臺灣詩學` : '作者作品 · 臺灣詩學';
    }
    let missing = false;
    for (const key of ['author', 'work']) {
      const a = $(`#${key}-form`), url = safeUrl(content.forms?.[key]);
      if (!a) continue;
      if (url) { a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer'; }
      else { missing = true; a.textContent = key === 'author' ? '創作者登記 · 準備中' : '作品投稿 · 準備中'; a.setAttribute('aria-disabled', 'true'); a.addEventListener('click', e => e.preventDefault()); }
    }
    if ($('#form-status')) $('#form-status').textContent = missing ? '投稿入口將在管理員完成設定後開放。' : '使用 Google 表單填寫，送出後請等待審核。';
    renderWorks();
  } catch (err) { $('#notice').textContent = '暫時無法載入作品，請重新整理後再試。'; console.error(err); }
}
function updateFilters() { document.querySelectorAll('[data-type]').forEach(b => { const selected = b.dataset.type === activeType; b.classList.toggle('active', selected); b.setAttribute('aria-pressed', selected); }); }
document.querySelectorAll('[data-type]').forEach(b => b.addEventListener('click', () => { activeType = b.dataset.type; updateFilters(); if (content) renderWorks(); }));
$('#search')?.addEventListener('input', () => { if (content) renderWorks(); });
$('#reader .close')?.addEventListener('click', () => $('#reader').close());
$('#reader')?.addEventListener('click', e => { if (e.target === $('#reader')) { const r = e.target.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) e.target.close(); } });
const headerMenu = $('.header-menu');
headerMenu.querySelectorAll('a').forEach(link => link.addEventListener('click', () => { headerMenu.open = false; }));
document.addEventListener('click', event => { if (!headerMenu.contains(event.target)) headerMenu.open = false; });
document.addEventListener('keydown', event => { if (event.key === 'Escape' && headerMenu.open) { headerMenu.open = false; headerMenu.querySelector('summary').focus(); } });
if ($('#notice')) init();

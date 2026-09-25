// Tooltip, bead dialog, post reader and the realm's post list.
import { fetchJson } from './api.js';
import { toDevanagariDigits } from './math.js';

function formatDate(isoDate) {
  const date = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(date.getTime())) return isoDate;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function lockScroll(dialog) {
  document.documentElement.style.overflow = 'hidden';
  dialog.addEventListener('close', () => { document.documentElement.style.overflow = ''; }, { once: true });
}

function wireDialog(dialog) {
  dialog.querySelector('.close').addEventListener('click', () => dialog.close());
  // A click on the backdrop lands on the dialog element itself, outside its content box.
  dialog.addEventListener('click', (event) => {
    if (event.target !== dialog) return;
    const box = dialog.getBoundingClientRect();
    const inside = event.clientX >= box.left && event.clientX <= box.right && event.clientY >= box.top && event.clientY <= box.bottom;
    if (!inside) dialog.close();
  });
}

export function initUi() {
  const tooltip = document.getElementById('tooltip');
  const beadDialog = document.getElementById('bead-dialog');
  const reader = document.getElementById('reader');
  wireDialog(beadDialog);
  wireDialog(reader);
  let beadRequest = 0;
  let postRequest = 0;

  let tooltipTitle = null;

  // x/y are the viewport point just above the bead.
  function showTooltipAt(summary, x, y) {
    if (tooltipTitle !== summary.title) {
      tooltipTitle = summary.title;
      tooltip.replaceChildren(document.createTextNode(summary.title));
      if (summary.subtitle) {
        const deva = document.createElement('span');
        deva.className = 'deva';
        deva.textContent = summary.subtitle;
        tooltip.append(deva);
      }
    }
    tooltip.style.left = `${x.toFixed(1)}px`;
    tooltip.style.top = `${y.toFixed(1)}px`;
    tooltip.hidden = false;
  }

  function hideTooltip() {
    tooltip.hidden = true;
    tooltipTitle = null;
  }

  async function openBead(index, summary) {
    hideTooltip();
    const request = ++beadRequest;
    beadDialog.querySelector('.bead-number').textContent = index === 0 ? 'ॐ' : toDevanagariDigits(index);
    beadDialog.querySelector('.bead-title').textContent = summary.title;
    beadDialog.querySelector('.bead-subtitle').textContent = summary.subtitle;
    const body = beadDialog.querySelector('.bead-body');
    body.textContent = '…';
    if (!beadDialog.open) {
      beadDialog.showModal();
      lockScroll(beadDialog);
    }
    try {
      const bead = await fetchJson(`/api/beads/${index}`);
      if (request === beadRequest) body.innerHTML = bead.body_html; // trusted, author-written content
    } catch (error) {
      if (request === beadRequest) body.textContent = 'This bead is silent for now. Please try again.';
      console.error(error);
    }
  }

  async function openPost(slug) {
    const request = ++postRequest;
    const titleElement = reader.querySelector('.post-title');
    const dateElement = reader.querySelector('.post-date');
    const body = reader.querySelector('.post-body');
    titleElement.textContent = '';
    dateElement.textContent = '';
    body.textContent = '…';
    if (!reader.open) {
      reader.showModal();
      lockScroll(reader);
    }
    try {
      const post = await fetchJson(`/api/posts/${encodeURIComponent(slug)}`);
      if (request !== postRequest) return;
      titleElement.textContent = post.title;
      dateElement.textContent = formatDate(post.date);
      body.innerHTML = post.body_html; // trusted, author-written content
    } catch (error) {
      if (request === postRequest) body.textContent = 'This post could not be opened.';
      console.error(error);
    }
  }

  function renderPosts(posts) {
    const list = document.getElementById('post-list');
    list.replaceChildren();
    for (const post of posts) {
      const item = document.createElement('li');
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'post-card';
      const date = document.createElement('span');
      date.className = 'date';
      date.textContent = formatDate(post.date).toUpperCase();
      const title = document.createElement('h3');
      title.textContent = post.title;
      const summary = document.createElement('p');
      summary.textContent = post.summary;
      card.append(date, title, summary);
      card.addEventListener('click', () => openPost(post.slug));
      item.append(card);
      list.append(item);
    }
  }

  return { showTooltipAt, hideTooltip, openBead, openPost, renderPosts };
}

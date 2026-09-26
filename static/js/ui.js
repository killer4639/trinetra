// Bead tooltip and bead dialog.
import { fetchJson } from './api.js';
import { toDevanagariDigits } from './math.js';

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
  wireDialog(beadDialog);
  let beadRequest = 0;

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

  return { showTooltipAt, hideTooltip, openBead };
}

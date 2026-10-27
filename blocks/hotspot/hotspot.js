import { isHotspotData, parseHotspots } from '../../scripts/hotspot-data.js';

const SIDES = ['right', 'left', 'bottom', 'top'];
const GAP = 16;
const EDGE = 8;
let blockCount = 0;

function safeHref(link) {
  try {
    const url = new URL(link, window.location.href);
    return ['http:', 'https:', 'mailto:', 'tel:'].includes(url.protocol) ? url.href : null;
  } catch {
    return null;
  }
}

function closeAll(block) {
  block.querySelectorAll('.hotspot-marker.active').forEach((marker) => {
    marker.classList.remove('active');
    marker.querySelector('.hotspot-target').setAttribute('aria-expanded', 'false');
  });
}

function positionTooltip(marker, tooltip) {
  tooltip.classList.remove(...SIDES.map((s) => `tooltip-${s}`));
  tooltip.style.setProperty('--shift', '0px');

  const m = marker.getBoundingClientRect();
  const t = tooltip.getBoundingClientRect();
  const headerBottom = Math.max(0, document.querySelector('header')?.getBoundingClientRect().bottom || 0);
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;

  const fits = {
    right: vw - m.right >= t.width + GAP,
    left: m.left >= t.width + GAP,
    bottom: vh - m.bottom >= t.height + GAP,
    top: m.top - headerBottom >= t.height + GAP,
  };
  const side = SIDES.find((s) => fits[s]) || 'bottom';
  tooltip.classList.add(`tooltip-${side}`);

  // keep the tooltip on screen by sliding it along the cross axis
  const r = tooltip.getBoundingClientRect();
  let shift = 0;
  if (side === 'top' || side === 'bottom') {
    if (r.left < EDGE) shift = EDGE - r.left;
    else if (r.right > vw - EDGE) shift = vw - EDGE - r.right;
  } else if (r.top < headerBottom + EDGE) {
    shift = headerBottom + EDGE - r.top;
  } else if (r.bottom > vh - EDGE) {
    shift = vh - EDGE - r.bottom;
  }
  tooltip.style.setProperty('--shift', `${shift}px`);
}

function buildTooltip(hotspot, id) {
  const tooltip = document.createElement('div');
  tooltip.className = 'hotspot-tooltip';
  tooltip.id = id;
  tooltip.setAttribute('role', 'dialog');
  tooltip.setAttribute('aria-label', hotspot.title || hotspot.label || 'Hotspot details');

  const arrow = document.createElement('span');
  arrow.className = 'hotspot-tooltip-arrow';

  const close = document.createElement('button');
  close.type = 'button';
  close.className = 'hotspot-tooltip-close';
  close.setAttribute('aria-label', 'Close');

  tooltip.append(arrow, close);

  if (hotspot.title) {
    const title = document.createElement('p');
    title.className = 'hotspot-tooltip-title';
    title.textContent = hotspot.title;
    tooltip.append(title);
  }
  if (hotspot.description) {
    const desc = document.createElement('p');
    desc.textContent = hotspot.description;
    tooltip.append(desc);
  }
  const href = hotspot.link && safeHref(hotspot.link);
  if (href) {
    const wrapper = document.createElement('p');
    wrapper.className = 'button-wrapper';
    const a = document.createElement('a');
    a.className = 'button primary';
    a.href = href;
    a.textContent = 'Learn more';
    wrapper.append(a);
    tooltip.append(wrapper);
  }
  return tooltip;
}

function buildMarker(block, hotspot, id) {
  const marker = document.createElement('div');
  marker.className = 'hotspot-marker';
  marker.style.left = `${hotspot.x}%`;
  marker.style.top = `${hotspot.y}%`;

  const target = document.createElement('button');
  target.type = 'button';
  target.className = 'hotspot-target';
  target.setAttribute('aria-expanded', 'false');
  target.setAttribute('aria-controls', id);
  target.setAttribute('aria-label', hotspot.title || hotspot.label || 'Hotspot');

  const dot = document.createElement('span');
  dot.className = 'hotspot-dot';
  dot.textContent = hotspot.label;
  target.append(dot);

  const tooltip = buildTooltip(hotspot, id);
  marker.append(target, tooltip);

  target.addEventListener('click', () => {
    const wasOpen = marker.classList.contains('active');
    closeAll(block);
    if (wasOpen) return;
    marker.classList.add('active');
    target.setAttribute('aria-expanded', 'true');
    positionTooltip(marker, tooltip);
  });

  tooltip.querySelector('.hotspot-tooltip-close').addEventListener('click', () => {
    closeAll(block);
    target.focus();
  });

  return marker;
}

export default function decorate(block) {
  const img = block.querySelector('img');
  if (!img) return;
  const media = img.closest('picture') || img;

  // delivery renders the authored title as data-title
  const attr = ['data-title', 'title'].find((a) => isHotspotData(img.getAttribute(a)));
  const hotspots = attr ? parseHotspots(img.getAttribute(attr)) : [];
  if (attr) img.removeAttribute(attr);

  const stage = document.createElement('div');
  stage.className = 'hotspot-stage';
  stage.append(media);
  block.replaceChildren(stage);

  blockCount += 1;
  hotspots.forEach((hotspot, i) => {
    stage.append(buildMarker(block, hotspot, `hotspot-${blockCount}-${i}`));
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest?.('.hotspot-marker') || !block.contains(e.target)) closeAll(block);
  });
  block.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const open = block.querySelector('.hotspot-marker.active .hotspot-target');
    closeAll(block);
    open?.focus();
  });
}

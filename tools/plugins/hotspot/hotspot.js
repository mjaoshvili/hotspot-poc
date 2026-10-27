// eslint-disable-next-line import/no-unresolved
import DA_SDK from 'https://da.live/nx/utils/sdk.js';
import { isHotspotData, parseHotspots, serializeHotspots } from '../../../scripts/hotspot-data.js';

const state = {
  src: null,
  hotspots: [],
  active: -1,
};

const $ = (selector) => document.querySelector(selector);
const ui = {
  load: $('.load'),
  status: $('.status'),
  workspace: $('.workspace'),
  stage: $('.stage'),
  image: $('.stage-image'),
  list: $('.list'),
  cancel: $('.cancel'),
  clear: $('.clear'),
  apply: $('.apply'),
};

const FIELDS = [
  { name: 'label', label: 'Label', type: 'input' },
  { name: 'title', label: 'Title', type: 'input' },
  { name: 'description', label: 'Description', type: 'textarea' },
  { name: 'link', label: 'Link', type: 'input' },
];

const clamp = (n) => Math.min(100, Math.max(0, n));
const coords = ({ x, y }) => `${x.toFixed(1)}%, ${y.toFixed(1)}%`;

function setStatus(message) {
  ui.status.textContent = message;
}

function findImage(html) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return doc.querySelector('img');
}

function renderPins() {
  ui.stage.querySelectorAll('.pin').forEach((pin) => pin.remove());
  state.hotspots.forEach((hotspot, i) => {
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = `pin${i === state.active ? ' active' : ''}`;
    pin.dataset.index = i;
    pin.style.left = `${hotspot.x}%`;
    pin.style.top = `${hotspot.y}%`;
    pin.textContent = hotspot.label;
    pin.setAttribute('aria-label', `Hotspot ${hotspot.label || i + 1}`);
    ui.stage.append(pin);
  });
}

function setActive(index) {
  state.active = index;
  ui.stage.querySelectorAll('.pin').forEach((pin) => {
    pin.classList.toggle('active', Number(pin.dataset.index) === index);
  });
  ui.list.querySelectorAll('.item').forEach((item) => {
    item.classList.toggle('active', Number(item.dataset.index) === index);
  });
}

function renderList() {
  ui.list.replaceChildren(...state.hotspots.map((hotspot, i) => {
    const item = document.createElement('li');
    item.className = `item${i === state.active ? ' active' : ''}`;
    item.dataset.index = i;

    const head = document.createElement('div');
    head.className = 'item-head';
    const pos = document.createElement('span');
    pos.className = 'item-coords';
    pos.textContent = coords(hotspot);
    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove';
    remove.textContent = 'Delete';
    remove.addEventListener('click', () => {
      state.hotspots.splice(i, 1);
      state.active = -1;
      // eslint-disable-next-line no-use-before-define
      render();
    });
    head.append(pos, remove);
    item.append(head);

    FIELDS.forEach(({ name, label, type }) => {
      const wrapper = document.createElement('label');
      wrapper.textContent = label;
      const field = document.createElement(type);
      field.name = name;
      field.value = hotspot[name];
      if (name === 'link') {
        field.type = 'url';
        field.placeholder = 'https://…';
      }
      field.addEventListener('input', () => {
        hotspot[name] = field.value;
        if (name === 'label') {
          const pin = ui.stage.querySelector(`.pin[data-index="${i}"]`);
          if (pin) pin.textContent = field.value;
        }
      });
      wrapper.append(field);
      item.append(wrapper);
    });

    item.addEventListener('focusin', () => setActive(i));
    item.addEventListener('click', () => setActive(i));
    return item;
  }));
}

function render() {
  renderPins();
  renderList();
  ui.clear.disabled = !state.hotspots.length;
}

function pointFromEvent(e) {
  const rect = ui.image.getBoundingClientRect();
  return {
    x: clamp(((e.clientX - rect.left) / rect.width) * 100),
    y: clamp(((e.clientY - rect.top) / rect.height) * 100),
  };
}

function initStage() {
  let drag = null;

  ui.stage.addEventListener('pointerdown', (e) => {
    const pin = e.target.closest('.pin');
    if (pin) {
      const index = Number(pin.dataset.index);
      setActive(index);
      drag = { pin, index };
      pin.setPointerCapture(e.pointerId);
      return;
    }
    if (e.target !== ui.image) return;
    const { x, y } = pointFromEvent(e);
    state.hotspots.push({
      x, y, label: String.fromCharCode(65 + (state.hotspots.length % 26)), title: '', description: '', link: '',
    });
    state.active = state.hotspots.length - 1;
    render();
    ui.list.querySelector('.item.active input[name="title"]')?.focus();
  });

  ui.stage.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const hotspot = state.hotspots[drag.index];
    Object.assign(hotspot, pointFromEvent(e));
    drag.pin.style.left = `${hotspot.x}%`;
    drag.pin.style.top = `${hotspot.y}%`;
    const pos = ui.list.querySelector(`.item[data-index="${drag.index}"] .item-coords`);
    if (pos) pos.textContent = coords(hotspot);
  });

  const endDrag = () => { drag = null; };
  ui.stage.addEventListener('pointerup', endDrag);
  ui.stage.addEventListener('pointercancel', endDrag);
}

async function loadSelection(actions) {
  let html;
  try {
    html = await actions.getSelection();
  } catch {
    setStatus('Nothing selected. Click the image inside your hotspot block first.');
    return;
  }
  const img = findImage(html);
  if (!img?.getAttribute('src')) {
    setStatus('The selection does not contain an image. Click the image inside your hotspot block.');
    return;
  }

  state.src = img.getAttribute('src');
  state.hotspots = parseHotspots(img.getAttribute('title'));
  state.active = -1;
  ui.image.src = state.src;
  ui.image.alt = img.getAttribute('alt') || '';
  ui.workspace.hidden = false;
  ui.apply.disabled = false;
  render();
  setStatus(state.hotspots.length
    ? `Loaded ${state.hotspots.length} existing hotspot(s).`
    : 'No hotspots yet. Click the image to add one.');
}

async function apply(actions) {
  // re-read the selection so we never overwrite a different image than the one we loaded
  let html;
  try {
    html = await actions.getSelection();
  } catch {
    html = '';
  }
  const img = findImage(html);
  if (!img || img.getAttribute('src') !== state.src) {
    setStatus('The editor selection changed. Select the hotspot image again and reload.');
    return;
  }

  if (state.hotspots.length) {
    img.setAttribute('title', serializeHotspots(state.hotspots));
  } else if (isHotspotData(img.getAttribute('title'))) {
    img.removeAttribute('title');
  }

  const link = img.parentElement?.closest('a');
  actions.sendHTML((link || img).outerHTML);
  actions.closeLibrary();
}

async function init() {
  initStage();
  const { actions } = await DA_SDK;

  ui.load.addEventListener('click', () => loadSelection(actions));
  ui.apply.addEventListener('click', () => apply(actions));
  ui.cancel.addEventListener('click', () => actions.closeLibrary());
  ui.clear.addEventListener('click', () => {
    state.hotspots = [];
    state.active = -1;
    render();
  });

  loadSelection(actions);
}

init();

const els = {
  backendUrl: document.getElementById('backendUrl'),
  appPassword: document.getElementById('appPassword'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  healthBtn: document.getElementById('healthBtn'),
  healthStatus: document.getElementById('healthStatus'),

  stepBase: document.getElementById('stepBase'),
  stepLock: document.getElementById('stepLock'),
  stepExtension: document.getElementById('stepExtension'),
  stepBrief: document.getElementById('stepBrief'),

  photoInput: document.getElementById('photoInput'),
  baseContextInput: document.getElementById('baseContextInput'),
  scaleNoteInput: document.getElementById('scaleNoteInput'),
  referenceLengthInput: document.getElementById('referenceLengthInput'),
  baseGenerateSketch: document.getElementById('baseGenerateSketch'),
  baseStartBtn: document.getElementById('baseStartBtn'),
  showBaseBtn: document.getElementById('showBaseBtn'),

  displayImage: document.getElementById('displayImage'),
  canvasWrap: document.getElementById('canvasWrap'),
  markupCanvas: document.getElementById('markupCanvas'),
  clearMarkupBtn: document.getElementById('clearMarkupBtn'),
  downloadImageBtn: document.getElementById('downloadImageBtn'),
  drawMode: document.getElementById('drawMode'),
  brushSize: document.getElementById('brushSize'),
  imageHint: document.getElementById('imageHint'),

  baseJsonEditor: document.getElementById('baseJsonEditor'),
  formatBaseJsonBtn: document.getElementById('formatBaseJsonBtn'),
  downloadBaseJsonBtn: document.getElementById('downloadBaseJsonBtn'),
  baseLockStatus: document.getElementById('baseLockStatus'),
  toggleBaseLockBtn: document.getElementById('toggleBaseLockBtn'),
  baseRevisionInput: document.getElementById('baseRevisionInput'),
  baseReviseGenerateSketch: document.getElementById('baseReviseGenerateSketch'),
  baseReviseBtn: document.getElementById('baseReviseBtn'),

  extensionInput: document.getElementById('extensionInput'),
  extensionGenerateImage: document.getElementById('extensionGenerateImage'),
  extensionStartBtn: document.getElementById('extensionStartBtn'),
  showExtensionBtn: document.getElementById('showExtensionBtn'),
  extensionRevisionInput: document.getElementById('extensionRevisionInput'),
  extensionReviseGenerateImage: document.getElementById('extensionReviseGenerateImage'),
  extensionReviseBtn: document.getElementById('extensionReviseBtn'),
  extensionJsonEditor: document.getElementById('extensionJsonEditor'),
  formatExtensionJsonBtn: document.getElementById('formatExtensionJsonBtn'),
  downloadExtensionJsonBtn: document.getElementById('downloadExtensionJsonBtn'),

  downloadProjectBtn: document.getElementById('downloadProjectBtn'),
  projectUpload: document.getElementById('projectUpload'),

  briefBtn: document.getElementById('briefBtn'),
  briefOutput: document.getElementById('briefOutput'),
  downloadBriefBtn: document.getElementById('downloadBriefBtn'),
  toast: document.getElementById('toast'),
};

const state = {
  originalPhotoFile: null,
  originalPhotoDataUrl: null,
  baseSketchDataUrl: null,
  extensionImageDataUrl: null,
  currentImageDataUrl: null,
  currentImageKind: 'none', // original | base | extension
  hasMarkup: false,
  isDrawing: false,
};

function toast(message, ms = 3500) {
  els.toast.textContent = message;
  els.toast.classList.add('show');
  window.clearTimeout(toast._timer);
  toast._timer = window.setTimeout(() => els.toast.classList.remove('show'), ms);
}

function normalizeBackendUrl(url) {
  return (url || '').trim().replace(/\/+$/, '');
}

function getSettings() {
  return {
    backendUrl: normalizeBackendUrl(els.backendUrl.value),
    appPassword: els.appPassword.value,
  };
}

function saveSettings() {
  localStorage.setItem('pabygg.backendUrl', normalizeBackendUrl(els.backendUrl.value));
  sessionStorage.setItem('pabygg.appPassword', els.appPassword.value);
  toast('Innstillinger lagret. Passordet lagres kun i denne fanen.');
}

function loadSettings() {
  els.backendUrl.value = localStorage.getItem('pabygg.backendUrl') || localStorage.getItem('inngangsparti.backendUrl') || '';
  els.appPassword.value = sessionStorage.getItem('pabygg.appPassword') || sessionStorage.getItem('inngangsparti.appPassword') || '';
}

function assertSettings() {
  const { backendUrl, appPassword } = getSettings();
  if (!backendUrl) throw new Error('Mangler backend-URL.');
  if (!appPassword) throw new Error('Mangler app-passord.');
  return { backendUrl, appPassword };
}

async function apiFetch(path, formData) {
  const { backendUrl, appPassword } = assertSettings();
  const response = await fetch(`${backendUrl}${path}`, {
    method: 'POST',
    headers: { 'X-App-Password': appPassword },
    body: formData,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.detail || `Backend svarte ${response.status}`);
  }
  return payload;
}

async function testHealth() {
  const { backendUrl } = assertSettings();
  const response = await fetch(`${backendUrl}/health`);
  const payload = await response.json();
  els.healthStatus.textContent = payload.ok
    ? `OK – ${payload.service} v${payload.version || '?'} · tekst: ${payload.text_model} · bilde: ${payload.image_model} · flyt: ${payload.flow || 'ukjent'}`
    : 'Backend svarte, men ok=false.';
}

function setBusy(button, busy, busyText = 'Jobber...') {
  if (!button._originalText) button._originalText = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? busyText : button._originalText;
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function parseJsonFromEditor(editor, label) {
  try {
    return JSON.parse(editor.value);
  } catch (err) {
    throw new Error(`${label}: JSON-feil: ${err.message}`);
  }
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(',');
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || 'image/png';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function downloadText(filename, text, mime = 'text/plain') {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function setDisplayImage(dataUrl, kind = 'image') {
  if (!dataUrl) return;
  state.currentImageDataUrl = dataUrl;
  state.currentImageKind = kind;
  els.displayImage.src = dataUrl;
  els.displayImage.classList.add('has-image');
  clearMarkup();
  els.imageHint.textContent = kind === 'base'
    ? 'Base-skisse vises. Tegn rødt for korreksjoner av eksisterende hus, og bruk “Oppdater base”.'
    : kind === 'extension'
      ? 'Påbygg-bilde vises. Tegn rødt for endringer i påbygget, og bruk “Oppdater påbygg”.'
      : 'Originalfoto vises.';
}

function resizeCanvasToImage() {
  const rect = els.displayImage.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const dpr = window.devicePixelRatio || 1;
  els.markupCanvas.width = Math.round(rect.width * dpr);
  els.markupCanvas.height = Math.round(rect.height * dpr);
  els.markupCanvas.style.width = `${rect.width}px`;
  els.markupCanvas.style.height = `${rect.height}px`;
  const ctx = els.markupCanvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = 'rgba(230,0,0,0.95)';
  ctx.lineWidth = Number(els.brushSize.value || 14);
}

function clearMarkup() {
  const ctx = els.markupCanvas.getContext('2d');
  ctx.clearRect(0, 0, els.markupCanvas.width, els.markupCanvas.height);
  state.hasMarkup = false;
}

function pointerPos(event) {
  const rect = els.markupCanvas.getBoundingClientRect();
  return { x: event.clientX - rect.left, y: event.clientY - rect.top };
}

function beginDraw(event) {
  if (!els.drawMode.checked || !state.currentImageDataUrl) return;
  state.isDrawing = true;
  const ctx = els.markupCanvas.getContext('2d');
  ctx.lineWidth = Number(els.brushSize.value || 14);
  const p = pointerPos(event);
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
  event.preventDefault();
}

function draw(event) {
  if (!state.isDrawing) return;
  const ctx = els.markupCanvas.getContext('2d');
  const p = pointerPos(event);
  ctx.lineTo(p.x, p.y);
  ctx.stroke();
  state.hasMarkup = true;
  event.preventDefault();
}

function endDraw() {
  state.isDrawing = false;
}

async function composeMarkupBlob() {
  if (!state.hasMarkup || !state.currentImageDataUrl) return null;

  const baseImg = new Image();
  baseImg.src = state.currentImageDataUrl;
  await new Promise((resolve, reject) => {
    baseImg.onload = resolve;
    baseImg.onerror = reject;
  });

  const out = document.createElement('canvas');
  out.width = baseImg.naturalWidth;
  out.height = baseImg.naturalHeight;
  const ctx = out.getContext('2d');
  ctx.drawImage(baseImg, 0, 0, out.width, out.height);

  // Overlay drawn markup scaled from displayed canvas to natural image dimensions.
  ctx.drawImage(els.markupCanvas, 0, 0, out.width, out.height);

  return new Promise((resolve) => out.toBlob(resolve, 'image/png'));
}

function currentBaseLocked() {
  if (!els.baseJsonEditor.value.trim()) return false;
  try {
    const base = JSON.parse(els.baseJsonEditor.value);
    return Boolean(base.locked);
  } catch {
    return false;
  }
}

function setBaseLocked(locked) {
  const base = parseJsonFromEditor(els.baseJsonEditor, 'Base-house JSON');
  base.locked = locked;
  if (!base.iteration) base.iteration = { number: 1, change_log: [] };
  if (!Array.isArray(base.iteration.change_log)) base.iteration.change_log = [];
  base.iteration.change_log.push({
    action: locked ? 'locked_base_house' : 'unlocked_base_house',
    note: locked ? 'Bruker låste base-house JSON som utgangspunkt for påbygg.' : 'Bruker låste opp base-house JSON for videre korreksjon.',
    timestamp: new Date().toISOString(),
  });
  els.baseJsonEditor.value = prettyJson(base);
  updateLockUi();
}

function updateLockUi() {
  const locked = currentBaseLocked();
  els.baseLockStatus.textContent = locked ? 'Låst' : 'Ikke låst';
  els.baseLockStatus.className = `lock-badge ${locked ? 'locked' : 'unlocked'}`;
  els.toggleBaseLockBtn.textContent = locked ? 'Lås opp base' : 'Lås base';
  els.extensionStartBtn.disabled = !locked;
  els.extensionReviseBtn.disabled = !locked;
  els.stepBase.classList.toggle('done', Boolean(els.baseJsonEditor.value.trim()));
  els.stepLock.classList.toggle('active', !locked && Boolean(els.baseJsonEditor.value.trim()));
  els.stepLock.classList.toggle('done', locked);
  els.stepExtension.classList.toggle('active', locked);
  els.stepExtension.classList.toggle('done', Boolean(els.extensionJsonEditor.value.trim()));
  els.stepBrief.classList.toggle('active', Boolean(els.extensionJsonEditor.value.trim()));
}

async function startBase() {
  if (!state.originalPhotoFile) throw new Error('Velg et originalfoto først.');
  const fd = new FormData();
  fd.append('photo', state.originalPhotoFile);
  fd.append('context_note', els.baseContextInput.value || '');
  fd.append('scale_note', els.scaleNoteInput.value || '');
  if (els.referenceLengthInput.value) fd.append('reference_length_m', els.referenceLengthInput.value);
  fd.append('generate_sketch', els.baseGenerateSketch.checked ? 'true' : 'false');

  const payload = await apiFetch('/api/base/start', fd);
  els.baseJsonEditor.value = prettyJson(payload.base_house || {});
  if (payload.base_sketch_data_url) {
    state.baseSketchDataUrl = payload.base_sketch_data_url;
    setDisplayImage(state.baseSketchDataUrl, 'base');
  }
  updateLockUi();
  toast('Base-house JSON og skisse er laget. Kontroller utgangspunktet før du låser.');
}

async function reviseBase() {
  if (!els.baseJsonEditor.value.trim()) throw new Error('Mangler base-house JSON.');
  if (currentBaseLocked()) throw new Error('Base er låst. Lås opp før du korrigerer eksisterende hus.');

  const fd = new FormData();
  fd.append('base_house_json', els.baseJsonEditor.value);
  fd.append('instruction', els.baseRevisionInput.value || '');
  fd.append('generate_sketch', els.baseReviseGenerateSketch.checked ? 'true' : 'false');
  if (state.originalPhotoFile) fd.append('original_photo', state.originalPhotoFile);
  if (state.baseSketchDataUrl) fd.append('current_base_sketch', dataUrlToBlob(state.baseSketchDataUrl), 'base-sketch.png');
  const markupBlob = await composeMarkupBlob();
  if (markupBlob) fd.append('markup_image', markupBlob, 'base-markup.png');

  const payload = await apiFetch('/api/base/revise', fd);
  els.baseJsonEditor.value = prettyJson(payload.base_house || {});
  if (payload.base_sketch_data_url) {
    state.baseSketchDataUrl = payload.base_sketch_data_url;
    setDisplayImage(state.baseSketchDataUrl, 'base');
  }
  updateLockUi();
  toast('Base-house er oppdatert.');
}

async function startExtension() {
  if (!currentBaseLocked()) throw new Error('Lås base-house JSON før du lager påbygg.');
  const base = parseJsonFromEditor(els.baseJsonEditor, 'Base-house JSON');

  const fd = new FormData();
  fd.append('base_house_json', JSON.stringify(base));
  fd.append('instruction', els.extensionInput.value || '');
  fd.append('generate_image', els.extensionGenerateImage.checked ? 'true' : 'false');
  if (state.originalPhotoFile) fd.append('original_photo', state.originalPhotoFile);
  if (state.baseSketchDataUrl) fd.append('base_sketch', dataUrlToBlob(state.baseSketchDataUrl), 'base-sketch.png');

  const payload = await apiFetch('/api/extension/start', fd);
  els.extensionJsonEditor.value = prettyJson(payload.extension || {});
  if (payload.image_data_url) {
    state.extensionImageDataUrl = payload.image_data_url;
    setDisplayImage(state.extensionImageDataUrl, 'extension');
  }
  updateLockUi();
  toast('Påbygg-JSON og visualisering er laget.');
}

async function reviseExtension() {
  if (!currentBaseLocked()) throw new Error('Base-house JSON må være låst.');
  if (!els.extensionJsonEditor.value.trim()) throw new Error('Mangler påbygg-JSON. Lag påbygg først.');

  const fd = new FormData();
  fd.append('base_house_json', els.baseJsonEditor.value);
  fd.append('extension_json', els.extensionJsonEditor.value);
  fd.append('instruction', els.extensionRevisionInput.value || '');
  fd.append('generate_image', els.extensionReviseGenerateImage.checked ? 'true' : 'false');
  if (state.originalPhotoFile) fd.append('original_photo', state.originalPhotoFile);
  if (state.baseSketchDataUrl) fd.append('base_sketch', dataUrlToBlob(state.baseSketchDataUrl), 'base-sketch.png');
  if (state.extensionImageDataUrl) fd.append('current_visualization', dataUrlToBlob(state.extensionImageDataUrl), 'extension-current.png');
  const markupBlob = await composeMarkupBlob();
  if (markupBlob) fd.append('markup_image', markupBlob, 'extension-markup.png');

  const payload = await apiFetch('/api/extension/revise', fd);
  els.extensionJsonEditor.value = prettyJson(payload.extension || {});
  if (payload.image_data_url) {
    state.extensionImageDataUrl = payload.image_data_url;
    setDisplayImage(state.extensionImageDataUrl, 'extension');
  }
  updateLockUi();
  toast('Påbygget er oppdatert.');
}

async function makeBrief() {
  if (!els.baseJsonEditor.value.trim()) throw new Error('Mangler base-house JSON.');
  const fd = new FormData();
  fd.append('base_house_json', els.baseJsonEditor.value);
  fd.append('extension_json', els.extensionJsonEditor.value || '{}');
  const payload = await apiFetch('/api/brief', fd);
  els.briefOutput.textContent = payload.brief_markdown || 'Tom brief.';
  toast('Arkitektbrief laget.');
}

function buildProjectObject() {
  return {
    file_type: 'pabygg_project_frontend_state',
    version: '0.3',
    saved_at: new Date().toISOString(),
    base_house: els.baseJsonEditor.value.trim() ? JSON.parse(els.baseJsonEditor.value) : null,
    extension: els.extensionJsonEditor.value.trim() ? JSON.parse(els.extensionJsonEditor.value) : null,
    images: {
      original_photo_data_url: state.originalPhotoDataUrl,
      base_sketch_data_url: state.baseSketchDataUrl,
      extension_image_data_url: state.extensionImageDataUrl,
    },
    notes: {
      base_context: els.baseContextInput.value,
      extension_wish: els.extensionInput.value,
    },
  };
}

function loadProjectObject(project) {
  if (project.base_house) els.baseJsonEditor.value = prettyJson(project.base_house);
  if (project.extension) els.extensionJsonEditor.value = prettyJson(project.extension);
  if (project.images) {
    state.originalPhotoDataUrl = project.images.original_photo_data_url || null;
    state.baseSketchDataUrl = project.images.base_sketch_data_url || null;
    state.extensionImageDataUrl = project.images.extension_image_data_url || null;
  }
  if (project.notes) {
    els.baseContextInput.value = project.notes.base_context || '';
    els.extensionInput.value = project.notes.extension_wish || '';
  }
  if (state.extensionImageDataUrl) setDisplayImage(state.extensionImageDataUrl, 'extension');
  else if (state.baseSketchDataUrl) setDisplayImage(state.baseSketchDataUrl, 'base');
  else if (state.originalPhotoDataUrl) setDisplayImage(state.originalPhotoDataUrl, 'original');
  updateLockUi();
}

function bindEvents() {
  els.saveSettingsBtn.addEventListener('click', saveSettings);
  els.healthBtn.addEventListener('click', () => runButton(els.healthBtn, testHealth, 'Tester...'));

  els.photoInput.addEventListener('change', async () => {
    const file = els.photoInput.files && els.photoInput.files[0];
    if (!file) return;
    state.originalPhotoFile = file;
    state.originalPhotoDataUrl = await readFileAsDataUrl(file);
    setDisplayImage(state.originalPhotoDataUrl, 'original');
    toast('Originalfoto lastet inn lokalt.');
  });

  els.baseStartBtn.addEventListener('click', () => runButton(els.baseStartBtn, startBase, 'Lager base...'));
  els.baseReviseBtn.addEventListener('click', () => runButton(els.baseReviseBtn, reviseBase, 'Oppdaterer base...'));
  els.extensionStartBtn.addEventListener('click', () => runButton(els.extensionStartBtn, startExtension, 'Lager påbygg...'));
  els.extensionReviseBtn.addEventListener('click', () => runButton(els.extensionReviseBtn, reviseExtension, 'Reviderer...'));
  els.briefBtn.addEventListener('click', () => runButton(els.briefBtn, makeBrief, 'Lager brief...'));

  els.showBaseBtn.addEventListener('click', () => {
    if (!state.baseSketchDataUrl) return toast('Ingen base-skisse ennå.');
    setDisplayImage(state.baseSketchDataUrl, 'base');
  });
  els.showExtensionBtn.addEventListener('click', () => {
    if (!state.extensionImageDataUrl) return toast('Ingen påbygg-visualisering ennå.');
    setDisplayImage(state.extensionImageDataUrl, 'extension');
  });

  els.toggleBaseLockBtn.addEventListener('click', () => runButton(els.toggleBaseLockBtn, async () => setBaseLocked(!currentBaseLocked()), 'Endrer...'));

  els.formatBaseJsonBtn.addEventListener('click', () => {
    els.baseJsonEditor.value = prettyJson(parseJsonFromEditor(els.baseJsonEditor, 'Base-house JSON'));
    updateLockUi();
  });
  els.formatExtensionJsonBtn.addEventListener('click', () => {
    els.extensionJsonEditor.value = prettyJson(parseJsonFromEditor(els.extensionJsonEditor, 'Påbygg-JSON'));
  });

  els.baseJsonEditor.addEventListener('input', updateLockUi);
  els.extensionJsonEditor.addEventListener('input', updateLockUi);

  els.downloadBaseJsonBtn.addEventListener('click', () => downloadText('pabygg-base-house.json', els.baseJsonEditor.value || '{}', 'application/json'));
  els.downloadExtensionJsonBtn.addEventListener('click', () => downloadText('pabygg-extension.json', els.extensionJsonEditor.value || '{}', 'application/json'));
  els.downloadProjectBtn.addEventListener('click', () => {
    const project = buildProjectObject();
    downloadText('pabygg-project.json', prettyJson(project), 'application/json');
  });
  els.downloadBriefBtn.addEventListener('click', () => downloadText('pabygg-arkitektbrief.md', els.briefOutput.textContent || '', 'text/markdown'));
  els.downloadImageBtn.addEventListener('click', () => {
    if (!state.currentImageDataUrl) return toast('Ingen bilde å laste ned.');
    downloadBlob(`pabygg-${state.currentImageKind || 'image'}.png`, dataUrlToBlob(state.currentImageDataUrl));
  });

  els.projectUpload.addEventListener('change', async () => {
    const file = els.projectUpload.files && els.projectUpload.files[0];
    if (!file) return;
    const text = await file.text();
    loadProjectObject(JSON.parse(text));
    toast('Prosjektfil lastet inn. Merk: original bildefil må velges på nytt hvis den ikke lå i prosjektfilen.');
  });

  els.clearMarkupBtn.addEventListener('click', clearMarkup);
  els.brushSize.addEventListener('input', () => {
    const ctx = els.markupCanvas.getContext('2d');
    ctx.lineWidth = Number(els.brushSize.value || 14);
  });

  els.displayImage.addEventListener('load', resizeCanvasToImage);
  window.addEventListener('resize', resizeCanvasToImage);
  els.markupCanvas.addEventListener('pointerdown', beginDraw);
  els.markupCanvas.addEventListener('pointermove', draw);
  els.markupCanvas.addEventListener('pointerup', endDraw);
  els.markupCanvas.addEventListener('pointerleave', endDraw);
}

async function runButton(button, fn, busyText) {
  try {
    setBusy(button, true, busyText);
    await fn();
  } catch (err) {
    console.error(err);
    toast(err.message || String(err), 7000);
  } finally {
    setBusy(button, false);
  }
}

function init() {
  loadSettings();
  bindEvents();
  updateLockUi();
}

init();

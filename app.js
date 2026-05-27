const els = {
  backendUrl: document.getElementById('backendUrl'),
  appPassword: document.getElementById('appPassword'),
  saveSettingsBtn: document.getElementById('saveSettingsBtn'),
  healthBtn: document.getElementById('healthBtn'),
  healthStatus: document.getElementById('healthStatus'),
  photoInput: document.getElementById('photoInput'),
  wishesInput: document.getElementById('wishesInput'),
  scaleNoteInput: document.getElementById('scaleNoteInput'),
  referenceLengthInput: document.getElementById('referenceLengthInput'),
  startGenerateImage: document.getElementById('startGenerateImage'),
  startBtn: document.getElementById('startBtn'),
  displayImage: document.getElementById('displayImage'),
  canvasWrap: document.getElementById('canvasWrap'),
  markupCanvas: document.getElementById('markupCanvas'),
  clearMarkupBtn: document.getElementById('clearMarkupBtn'),
  downloadImageBtn: document.getElementById('downloadImageBtn'),
  drawMode: document.getElementById('drawMode'),
  brushSize: document.getElementById('brushSize'),
  jsonEditor: document.getElementById('jsonEditor'),
  formatJsonBtn: document.getElementById('formatJsonBtn'),
  downloadJsonBtn: document.getElementById('downloadJsonBtn'),
  jsonUpload: document.getElementById('jsonUpload'),
  revisionInput: document.getElementById('revisionInput'),
  reviseGenerateImage: document.getElementById('reviseGenerateImage'),
  reviseBtn: document.getElementById('reviseBtn'),
  briefBtn: document.getElementById('briefBtn'),
  briefOutput: document.getElementById('briefOutput'),
  downloadBriefBtn: document.getElementById('downloadBriefBtn'),
  toast: document.getElementById('toast'),
};

const state = {
  originalPhotoFile: null,
  currentImageDataUrl: null,
  isDrawing: false,
  hasMarkup: false,
};

function toast(message, ms = 3200) {
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
  localStorage.setItem('inngangsparti.backendUrl', normalizeBackendUrl(els.backendUrl.value));
  sessionStorage.setItem('inngangsparti.appPassword', els.appPassword.value);
  toast('Innstillinger lagret i nettleseren. Passordet lagres kun i denne fanen.');
}

function loadSettings() {
  els.backendUrl.value = localStorage.getItem('inngangsparti.backendUrl') || '';
  els.appPassword.value = sessionStorage.getItem('inngangsparti.appPassword') || '';
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
    ? `OK – ${payload.service}. OpenAI-nøkkel: ${payload.has_openai_key ? 'ja' : 'nei'}. Passord: ${payload.has_app_password ? 'ja' : 'nei'}.`
    : 'Backend svarte, men ok=false.';
}

function setBusy(button, busy, textWhenBusy = 'Jobber...') {
  if (!button._originalText) button._originalText = button.textContent;
  button.disabled = busy;
  button.textContent = busy ? textWhenBusy : button._originalText;
}

function prettyJson(value) {
  return JSON.stringify(value, null, 2);
}

function parseEditorJson() {
  try {
    return JSON.parse(els.jsonEditor.value);
  } catch (err) {
    throw new Error(`JSON-feil: ${err.message}`);
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

function canvasToBlob(canvas) {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}

function downloadText(filename, text, mime = 'text/plain') {
  const blob = new Blob([text], { type: mime });
  downloadBlob(filename, blob);
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

function setDisplayImageFromDataUrl(dataUrl) {
  state.currentImageDataUrl = dataUrl;
  els.displayImage.src = dataUrl;
  els.displayImage.style.display = 'block';
  els.displayImage.onload = () => resizeCanvasToImage();
}

function resizeCanvasToImage() {
  const img = els.displayImage;
  const canvas = els.markupCanvas;
  const rect = img.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  const old = document.createElement('canvas');
  old.width = canvas.width;
  old.height = canvas.height;
  old.getContext('2d').drawImage(canvas, 0, 0);

  const ratio = window.devicePixelRatio || 1;
  canvas.width = Math.max(1, Math.round(rect.width * ratio));
  canvas.height = Math.max(1, Math.round(rect.height * ratio));
  canvas.style.width = `${rect.width}px`;
  canvas.style.height = `${rect.height}px`;
  canvas.style.left = `${img.offsetLeft}px`;
  canvas.style.top = `${img.offsetTop}px`;
  canvas.style.right = 'auto';
  canvas.style.bottom = 'auto';

  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (state.hasMarkup && old.width && old.height) {
    ctx.drawImage(old, 0, 0, canvas.width, canvas.height);
  }
}

function canvasPoint(event) {
  const rect = els.markupCanvas.getBoundingClientRect();
  const ratioX = els.markupCanvas.width / rect.width;
  const ratioY = els.markupCanvas.height / rect.height;
  const touch = event.touches?.[0] || event.changedTouches?.[0];
  const clientX = touch ? touch.clientX : event.clientX;
  const clientY = touch ? touch.clientY : event.clientY;
  return { x: (clientX - rect.left) * ratioX, y: (clientY - rect.top) * ratioY };
}

function beginDraw(event) {
  if (!els.drawMode.checked || !state.currentImageDataUrl) return;
  event.preventDefault();
  state.isDrawing = true;
  const p = canvasPoint(event);
  const ctx = els.markupCanvas.getContext('2d');
  ctx.beginPath();
  ctx.moveTo(p.x, p.y);
}

function moveDraw(event) {
  if (!state.isDrawing) return;
  event.preventDefault();
  const p = canvasPoint(event);
  const ctx = els.markupCanvas.getContext('2d');
  const ratio = window.devicePixelRatio || 1;
  ctx.lineTo(p.x, p.y);
  ctx.strokeStyle = 'rgba(220, 0, 0, 0.88)';
  ctx.lineWidth = Number(els.brushSize.value) * ratio;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
  state.hasMarkup = true;
}

function endDraw(event) {
  if (!state.isDrawing) return;
  event.preventDefault();
  state.isDrawing = false;
}

function clearMarkup() {
  const ctx = els.markupCanvas.getContext('2d');
  ctx.clearRect(0, 0, els.markupCanvas.width, els.markupCanvas.height);
  state.hasMarkup = false;
}

async function getMarkupBlobIfAny() {
  if (!state.hasMarkup) return null;
  return await canvasToBlob(els.markupCanvas);
}

async function startProject() {
  if (!els.photoInput.files[0]) throw new Error('Velg et foto først.');
  state.originalPhotoFile = els.photoInput.files[0];
  const form = new FormData();
  form.append('photo', state.originalPhotoFile);
  form.append('wishes', els.wishesInput.value);
  form.append('scale_note', els.scaleNoteInput.value);
  if (els.referenceLengthInput.value) form.append('reference_length_m', els.referenceLengthInput.value);
  form.append('generate_image', els.startGenerateImage.checked ? 'true' : 'false');

  setBusy(els.startBtn, true, 'Lager første versjon...');
  try {
    const result = await apiFetch('/api/start', form);
    els.jsonEditor.value = prettyJson(result.project);
    if (result.image_data_url) {
      setDisplayImageFromDataUrl(result.image_data_url);
      clearMarkup();
    } else {
      const localDataUrl = await fileToDataUrl(state.originalPhotoFile);
      setDisplayImageFromDataUrl(localDataUrl);
    }
    toast('Første prosjektversjon er klar.');
  } finally {
    setBusy(els.startBtn, false);
  }
}

async function reviseProject() {
  const currentProject = parseEditorJson();
  const form = new FormData();
  form.append('current_project_json', JSON.stringify(currentProject));
  form.append('instruction', els.revisionInput.value);
  form.append('generate_image', els.reviseGenerateImage.checked ? 'true' : 'false');
  if (state.originalPhotoFile) form.append('original_photo', state.originalPhotoFile);
  if (state.currentImageDataUrl) form.append('current_visualization', dataUrlToBlob(state.currentImageDataUrl), 'current_visualization.png');
  const markupBlob = await getMarkupBlobIfAny();
  if (markupBlob) form.append('markup_image', markupBlob, 'markup.png');

  setBusy(els.reviseBtn, true, 'Lager ny versjon...');
  try {
    const result = await apiFetch('/api/revise', form);
    els.jsonEditor.value = prettyJson(result.project);
    if (result.image_data_url) {
      setDisplayImageFromDataUrl(result.image_data_url);
      clearMarkup();
    }
    toast('Ny versjon er klar.');
  } finally {
    setBusy(els.reviseBtn, false);
  }
}

async function makeBrief() {
  const currentProject = parseEditorJson();
  const form = new FormData();
  form.append('current_project_json', JSON.stringify(currentProject));
  setBusy(els.briefBtn, true, 'Lager brief...');
  try {
    const result = await apiFetch('/api/brief', form);
    els.briefOutput.textContent = result.brief_markdown || 'Ingen brief returnert.';
    toast('Arkitektbrief er klar.');
  } finally {
    setBusy(els.briefBtn, false);
  }
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

els.photoInput.addEventListener('change', async () => {
  const file = els.photoInput.files[0];
  if (!file) return;
  state.originalPhotoFile = file;
  setDisplayImageFromDataUrl(await fileToDataUrl(file));
  clearMarkup();
});

els.saveSettingsBtn.addEventListener('click', () => {
  try { saveSettings(); } catch (err) { toast(err.message); }
});
els.healthBtn.addEventListener('click', async () => {
  try {
    saveSettings();
    els.healthStatus.textContent = 'Tester...';
    await testHealth();
  } catch (err) {
    els.healthStatus.textContent = err.message;
  }
});
els.startBtn.addEventListener('click', () => startProject().catch(err => toast(err.message, 6000)));
els.reviseBtn.addEventListener('click', () => reviseProject().catch(err => toast(err.message, 7000)));
els.briefBtn.addEventListener('click', () => makeBrief().catch(err => toast(err.message, 6000)));
els.clearMarkupBtn.addEventListener('click', clearMarkup);
els.formatJsonBtn.addEventListener('click', () => {
  try { els.jsonEditor.value = prettyJson(parseEditorJson()); } catch (err) { toast(err.message); }
});
els.downloadJsonBtn.addEventListener('click', () => {
  const text = els.jsonEditor.value || '{}';
  downloadText(`inngangsparti-prosjekt-${new Date().toISOString().slice(0,10)}.json`, text, 'application/json');
});
els.jsonUpload.addEventListener('change', async () => {
  const file = els.jsonUpload.files[0];
  if (!file) return;
  els.jsonEditor.value = await file.text();
  try { els.jsonEditor.value = prettyJson(parseEditorJson()); } catch (_) {}
});
els.downloadImageBtn.addEventListener('click', () => {
  if (!state.currentImageDataUrl) return toast('Ingen bilde å laste ned.');
  downloadBlob('inngangsparti-visualisering.png', dataUrlToBlob(state.currentImageDataUrl));
});
els.downloadBriefBtn.addEventListener('click', () => {
  downloadText('inngangsparti-arkitektbrief.md', els.briefOutput.textContent || '', 'text/markdown');
});

['pointerdown', 'mousedown', 'touchstart'].forEach(evt => els.markupCanvas.addEventListener(evt, beginDraw, { passive: false }));
['pointermove', 'mousemove', 'touchmove'].forEach(evt => els.markupCanvas.addEventListener(evt, moveDraw, { passive: false }));
['pointerup', 'pointerleave', 'mouseup', 'mouseleave', 'touchend', 'touchcancel'].forEach(evt => els.markupCanvas.addEventListener(evt, endDraw, { passive: false }));
window.addEventListener('resize', resizeCanvasToImage);
loadSettings();

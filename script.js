const VOICEVOX_ORIGINS = ["http://127.0.0.1:50021", "http://localhost:50021"];
const VOICEVOX_PROXY_PATH = "/voicevox";
const CANVAS_WIDTH = 1080;
const CANVAS_HEIGHT = 1920;
const FPS = 30;
const APP_STATES = {
  idle: "待機中",
  synthesizing: "音声生成中",
  recording: "動画書き出し中",
  done: "完了",
};
const DEFAULT_SPEAKERS = ["四国めたん", "春日部つむぎ", "ずんだもん"];

const appState = {
  displayPhrases: [],
  readingPhrases: [],
  speakerOptions: [],
  prepared: null,
};

const ui = {
  displayInput: document.getElementById("displayInput"),
  readingInput: document.getElementById("readingInput"),
  speakerSelect: document.getElementById("speakerSelect"),
  rateSelect: document.getElementById("rateSelect"),
  pauseSelect: document.getElementById("pauseSelect"),
  fontScaleInput: document.getElementById("fontScaleInput"),
  fontScaleValue: document.getElementById("fontScaleValue"),
  reciteButton: document.getElementById("reciteButton"),
  saveVideoButton: document.getElementById("saveVideoButton"),
  statusRow: document.getElementById("statusRow"),
  statusText: document.getElementById("statusText"),
  errorBox: document.getElementById("errorBox"),
  phraseList: document.getElementById("phraseList"),
  canvas: document.getElementById("previewCanvas"),
  audioPlayer: document.getElementById("audioPlayer"),
  voicevoxCharacterList: document.getElementById("voicevoxCharacterList"),
};

const ctx = ui.canvas.getContext("2d");

init();

async function init() {
  bindEvents();
  setStatus("idle");
  syncPhrasePreview();
  await loadSpeakers();
}

function bindEvents() {
  ui.displayInput.addEventListener("input", handleInputChange);
  ui.readingInput.addEventListener("input", handleInputChange);
  ui.fontScaleInput.addEventListener("input", handleInputChange);
  ui.speakerSelect.addEventListener("change", handleInputChange);
  ui.reciteButton.addEventListener("click", handleRecite);
  ui.saveVideoButton.addEventListener("click", handleSaveVideo);
}

function setStatus(mode) {
  ui.statusText.textContent = APP_STATES[mode] || APP_STATES.idle;
  ui.statusRow.classList.remove("is-busy", "is-done");

  if (mode === "synthesizing" || mode === "recording") {
    ui.statusRow.classList.add("is-busy");
    return;
  }

  if (mode === "done") {
    ui.statusRow.classList.add("is-done");
  }
}

function handleInputChange() {
  appState.prepared = null;
  ui.saveVideoButton.disabled = true;
  syncPhrasePreview();
}

function syncPhrasePreview() {
  const parsed = parseInputs();
  appState.displayPhrases = parsed.displayPhrases;
  appState.readingPhrases = parsed.readingPhrases;
  ui.fontScaleValue.textContent = `${ui.fontScaleInput.value}%`;
  updatePhrasePreview(parsed.displayPhrases, parsed.readingPhrases);
  drawStaticPreview(parsed.displayPhrases);
}

function drawStaticPreview(displayPhrases) {
  const phrase = displayPhrases.join("");
  drawFrame({
    phrase: phrase || "韻律機",
    subtitle: "INRITSUKI",
    footer: getSelectedSpeakerName(),
  });
}

function parseInputs() {
  const displayPhrases = parseTanka(ui.displayInput.value);
  const rawReading = ui.readingInput.value.trim();
  const readingPhrases = rawReading ? parseTanka(rawReading) : [...displayPhrases];
  return { displayPhrases, readingPhrases };
}

async function loadSpeakers() {
  clearError();
  try {
    const response = await voicevoxFetch("/speakers");
    const speakers = await response.json();
    appState.speakerOptions = flattenSpeakers(speakers);
    updateCharacterList(speakers);
  } catch (error) {
    appState.speakerOptions = DEFAULT_SPEAKERS.map((name, index) => ({
      id: index + 1,
      label: `${name} / styleId ${index + 1}`,
    }));
    updateCharacterList(DEFAULT_SPEAKERS.map((name) => ({ name })));
    showError(resolveVoicevoxError(error));
  }

  ui.speakerSelect.innerHTML = appState.speakerOptions
    .map((option) => `<option value="${option.id}">${option.label}</option>`)
    .join("");
}

function updateCharacterList(speakers) {
  const names = [...new Set(speakers.map((speaker) => speaker.name).filter(Boolean))];
  ui.voicevoxCharacterList.textContent = `VOICEVOX: ${names.join(" / ")}`;
}

function getVoicevoxBaseCandidates() {
  const candidates = [];

  if (location.protocol === "http:" || location.protocol === "https:") {
    candidates.push(new URL(VOICEVOX_PROXY_PATH, location.origin).toString().replace(/\/$/, ""));
  }

  for (const origin of VOICEVOX_ORIGINS) {
    if (!candidates.includes(origin)) {
      candidates.push(origin);
    }
  }

  return candidates;
}

async function voicevoxFetch(path, options = {}) {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const failures = [];

  for (const baseUrl of getVoicevoxBaseCandidates()) {
    try {
      const response = await fetch(`${baseUrl}${normalizedPath}`, options);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return response;
    } catch (error) {
      failures.push({
        baseUrl,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const detail = failures.map((item) => `${item.baseUrl}: ${item.message}`).join("\n");
  throw new Error(`VOICEVOX_CONNECTION_FAILED\n${detail}`);
}

function flattenSpeakers(speakers) {
  const options = [];

  speakers.forEach((speaker) => {
    speaker.styles.forEach((style) => {
      options.push({
        id: style.id,
        label: `${speaker.name} / ${style.name}`,
        priority: DEFAULT_SPEAKERS.includes(speaker.name) ? 0 : 1,
      });
    });
  });

  return options.sort((a, b) => a.priority - b.priority || a.id - b.id);
}

function parseTanka(input) {
  const cleaned = input.trim().replace(/\r\n/g, "\n");
  if (!cleaned) {
    return [];
  }

  const rawParts = cleaned
    .split(/\n|\/+/)
    .map((part) => part.trim())
    .filter(Boolean);

  if (rawParts.length === 5) {
    return rawParts;
  }

  if (rawParts.length > 5) {
    const fixed = rawParts.slice(0, 4);
    fixed.push(rawParts.slice(4).join(" "));
    return fixed;
  }

  return splitEvenly(rawParts.join(""), 5);
}

function splitEvenly(text, count) {
  const chars = Array.from(text);
  const base = Math.floor(chars.length / count);
  let extra = chars.length % count;
  const result = [];
  let index = 0;

  for (let i = 0; i < count; i += 1) {
    const size = base + (extra > 0 ? 1 : 0);
    result.push(chars.slice(index, index + size).join(""));
    index += size;
    extra -= 1;
  }

  return result.map((part) => part || "　");
}

function updatePhrasePreview(displayPhrases, readingPhrases) {
  ui.phraseList.innerHTML = "";

  displayPhrases.forEach((displayPhrase, index) => {
    const item = document.createElement("li");
    const readingPhrase = readingPhrases[index] ?? "";
    item.textContent =
      readingPhrase && readingPhrase !== displayPhrase
        ? `${index + 1}句目: ${displayPhrase} / 読み: ${readingPhrase}`
        : `${index + 1}句目: ${displayPhrase}`;
    ui.phraseList.appendChild(item);
  });
}

function validateInputs(displayPhrases, readingPhrases) {
  if (!displayPhrases.length) {
    return "テロップ表示を入力してください。";
  }

  if (!readingPhrases.length) {
    return "読み上げを入力してください。";
  }

  if (displayPhrases.length !== readingPhrases.length) {
    return "テロップ表示と読み上げの句数をそろえてください。";
  }

  return "";
}

async function handleRecite() {
  clearError();
  const { displayPhrases, readingPhrases } = parseInputs();
  const validationError = validateInputs(displayPhrases, readingPhrases);

  if (validationError) {
    showError(validationError);
    return;
  }

  setStatus("synthesizing");
  ui.reciteButton.disabled = true;
  ui.saveVideoButton.disabled = true;
  drawStaticPreview(displayPhrases);

  try {
    const prepared = await prepareRecital(displayPhrases, readingPhrases);
    appState.prepared = prepared;
    await playPreparedRecital(prepared);
    ui.saveVideoButton.disabled = false;
    setStatus("done");
  } catch (error) {
    console.error(error);
    showError(resolveVoicevoxError(error));
    setStatus("idle");
  } finally {
    ui.reciteButton.disabled = false;
  }
}

async function handleSaveVideo() {
  clearError();
  const { displayPhrases, readingPhrases } = parseInputs();
  const validationError = validateInputs(displayPhrases, readingPhrases);

  if (validationError) {
    showError(validationError);
    return;
  }

  ui.saveVideoButton.disabled = true;
  ui.reciteButton.disabled = true;
  setStatus("recording");
  drawStaticPreview(displayPhrases);

  try {
    const prepared = isPreparedForCurrentInputs(displayPhrases, readingPhrases)
      ? appState.prepared
      : await prepareRecital(displayPhrases, readingPhrases);
    appState.prepared = prepared;
    const blob = await recordPreparedVideo(prepared);
    downloadBlob(blob, "inritsuki-recital.webm");
    setStatus("done");
    ui.saveVideoButton.disabled = false;
  } catch (error) {
    console.error(error);
    showError(resolveVoicevoxError(error));
    setStatus("idle");
  } finally {
    ui.reciteButton.disabled = false;
  }
}

function isPreparedForCurrentInputs(displayPhrases, readingPhrases) {
  if (!appState.prepared) {
    return false;
  }

  return (
    JSON.stringify(appState.prepared.displayPhrases) === JSON.stringify(displayPhrases) &&
    JSON.stringify(appState.prepared.readingPhrases) === JSON.stringify(readingPhrases)
  );
}

async function prepareRecital(displayPhrases, readingPhrases) {
  const speaker = Number(ui.speakerSelect.value);
  const speed = Number(ui.rateSelect.value);
  const pauseMs = Number(ui.pauseSelect.value);
  const segments = [];

  for (let index = 0; index < displayPhrases.length; index += 1) {
    const displayPhrase = displayPhrases[index];
    const readingPhrase = readingPhrases[index];
    const buffer = await synthesizePhrase(readingPhrase, speaker, speed);
    segments.push({
      displayPhrase,
      readingPhrase,
      buffer,
      durationMs: buffer.duration * 1000,
    });
  }

  return {
    displayPhrases: [...displayPhrases],
    readingPhrases: [...readingPhrases],
    speaker,
    speed,
    pauseMs,
    segments,
    totalDurationMs:
      segments.reduce((sum, segment) => sum + segment.durationMs, 0) +
      pauseMs * Math.max(segments.length - 1, 0) +
      900,
  };
}

async function synthesizePhrase(text, speaker, speedScale) {
  const queryResponse = await voicevoxFetch(
    `/audio_query?text=${encodeURIComponent(text)}&speaker=${speaker}`,
    { method: "POST" }
  );
  const query = await queryResponse.json();
  query.speedScale = speedScale;

  const synthResponse = await voicevoxFetch(`/synthesis?speaker=${speaker}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(query),
  });

  const arrayBuffer = await synthResponse.arrayBuffer();
  const context = new AudioContext();

  try {
    return await context.decodeAudioData(arrayBuffer.slice(0));
  } finally {
    await context.close();
  }
}

async function playPreparedRecital(prepared) {
  const audioBlob = await renderAudioBlob(prepared);
  ui.audioPlayer.src = URL.createObjectURL(audioBlob);
  await ui.audioPlayer.play();

  await new Promise((resolve) => {
    ui.audioPlayer.onended = () => resolve();
  });
}

async function renderAudioBlob(prepared) {
  const sampleRate = 44100;
  const frameCount = Math.ceil((prepared.totalDurationMs / 1000) * sampleRate);
  const offline = new OfflineAudioContext(1, frameCount, sampleRate);
  let cursor = 0;

  prepared.segments.forEach((segment) => {
    const source = offline.createBufferSource();
    source.buffer = segment.buffer;
    source.connect(offline.destination);
    source.start(cursor);
    cursor += segment.buffer.duration + prepared.pauseMs / 1000;
  });

  const rendered = await offline.startRendering();
  return audioBufferToWav(rendered);
}

async function recordPreparedVideo(prepared) {
  const stream = ui.canvas.captureStream(FPS);
  const audioContext = new AudioContext();
  const destination = audioContext.createMediaStreamDestination();
  const combined = new MediaStream([
    ...stream.getVideoTracks(),
    ...destination.stream.getAudioTracks(),
  ]);
  const chunks = [];
  const recorder = new MediaRecorder(combined, { mimeType: "video/webm" });

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  const stopPromise = new Promise((resolve) => {
    recorder.onstop = () => resolve(new Blob(chunks, { type: "video/webm" }));
  });

  scheduleRealtimePlayback(prepared, audioContext, destination);
  recorder.start();

  await wait(prepared.totalDurationMs + 200);
  recorder.stop();
  await audioContext.close();
  return stopPromise;
}

function scheduleRealtimePlayback(prepared, audioContext, destination) {
  let when = audioContext.currentTime + 0.08;

  prepared.segments.forEach((segment) => {
    const source = audioContext.createBufferSource();
    source.buffer = segment.buffer;
    source.connect(destination);
    source.start(when);
    when += segment.buffer.duration + prepared.pauseMs / 1000;
  });
}

function getSelectedSpeakerName() {
  const selectedId = Number(ui.speakerSelect.value);
  const selected = appState.speakerOptions.find((option) => option.id === selectedId);

  if (!selected) {
    return "VOICEVOX";
  }

  return `VOICEVOX: ${selected.label.split(" / ")[0] || selected.label}`;
}

function drawFrame({ phrase, subtitle, footer }) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  ctx.fillStyle = "#f5f1e8";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  drawPaperTexture();

  ctx.save();
  ctx.strokeStyle = "rgba(176, 141, 87, 0.46)";
  ctx.lineWidth = 4;
  ctx.strokeRect(72, 72, CANVAS_WIDTH - 144, CANVAS_HEIGHT - 144);
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "#1a1a1a";
  ctx.font = "88px serif";
  ctx.textAlign = "center";
  ctx.fillText(subtitle, CANVAS_WIDTH / 2, 180);
  drawVerticalPhrase(phrase);
  ctx.restore();

  ctx.fillStyle = "rgba(26, 26, 26, 0.55)";
  ctx.font = "40px serif";
  ctx.textAlign = "center";
  ctx.fillText(footer || getSelectedSpeakerName(), CANVAS_WIDTH / 2, CANVAS_HEIGHT - 120);
}

function drawPaperTexture() {
  ctx.save();
  for (let i = 0; i < 34; i += 1) {
    const x = (i * 137) % CANVAS_WIDTH;
    const y = (i * 211) % CANVAS_HEIGHT;
    ctx.fillStyle = `rgba(176, 141, 87, ${0.025 + (i % 3) * 0.012})`;
    ctx.beginPath();
    ctx.arc(x, y, 18 + (i % 4) * 10, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawVerticalPhrase(text) {
  const chars = Array.from(text || "　");
  const layout = getVerticalTextLayout(chars.length, Number(ui.fontScaleInput.value) / 100);
  const totalHeight = chars.length * layout.lineHeight;
  const startY = (CANVAS_HEIGHT - totalHeight) / 2 + layout.fontSize * 0.32;
  const x = CANVAS_WIDTH / 2;

  ctx.fillStyle = "#1a1a1a";
  ctx.font = `${layout.fontSize}px serif`;
  ctx.textAlign = "center";

  chars.forEach((char, index) => {
    ctx.fillText(char, x, startY + index * layout.lineHeight);
  });
}

function getVerticalTextLayout(charCount, scale) {
  const safeCount = Math.max(1, charCount);
  const availableHeight = CANVAS_HEIGHT - 460;
  const maxFontSize = 76;
  const minFontSize = 28;
  const lineHeightRatio = 0.9;
  const baseFontSize = Math.max(
    minFontSize,
    Math.min(maxFontSize, Math.floor(availableHeight / (safeCount * lineHeightRatio)))
  );
  const fontSize = Math.max(minFontSize, Math.floor(baseFontSize * scale));

  return {
    fontSize,
    lineHeight: Math.floor(fontSize * lineHeightRatio),
  };
}

function audioBufferToWav(buffer) {
  const channelData = buffer.getChannelData(0);
  const pcm = new Int16Array(channelData.length);

  for (let i = 0; i < channelData.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, channelData[i]));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }

  const wav = new ArrayBuffer(44 + pcm.length * 2);
  const view = new DataView(wav);
  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + pcm.length * 2, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, buffer.sampleRate, true);
  view.setUint32(28, buffer.sampleRate * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, pcm.length * 2, true);
  pcm.forEach((value, index) => view.setInt16(44 + index * 2, value, true));
  return new Blob([view], { type: "audio/wav" });
}

function writeAscii(view, offset, text) {
  for (let i = 0; i < text.length; i += 1) {
    view.setUint8(offset + i, text.charCodeAt(i));
  }
}

function showError(message) {
  ui.errorBox.textContent = message;
  ui.errorBox.className = "message-box is-visible";
}

function clearError() {
  ui.errorBox.textContent = "";
  ui.errorBox.className = "message-box";
}

function resolveVoicevoxError(error) {
  if (error instanceof Error && error.message.startsWith("VOICEVOX_CONNECTION_FAILED")) {
    const hints = [
      "VOICEVOX Engine に接続できません。",
      "VOICEVOX 本体が http://127.0.0.1:50021/ で開けることを確認してください。",
      "次に node server.mjs を実行し、http://127.0.0.1:5173/ から INRITSUKI を開いてください。",
    ];

    if (location.protocol === "file:") {
      hints.push("file:// 直開きではブラウザ制限で失敗することがあります。");
    }

    return `${hints.join("\n")}\n\n${error.message.replace("VOICEVOX_CONNECTION_FAILED\n", "")}`;
  }

  return error instanceof Error ? error.message : "エラーが発生しました。";
}

function downloadBlob(blob, fileName) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

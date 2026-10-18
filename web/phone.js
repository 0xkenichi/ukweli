// The owner's app: log sales by typing, a voice note or a photo of the book,
// in English, Kiswahili, Sheng, Gikuyu or Dholuo. Ukweli shows how it read
// every word, the owner confirms, and the agents check it against M-Pesa.

const S = {
  en: {
    closing: d => `Closing the books for ${d}`,
    chat: "Chat", issues: "Issues",
    say: "Type, or tap 🎤 / 📷…",
    hello: "Habari! Log today's money here: <b>send a photo</b> of your book page, <b>a voice note</b>, or just <b>type</b>. Any language: English, Kiswahili, Sheng, Gĩkũyũ or Dholuo. You can also forward the M-Pesa SMS.",
    tryOne: "Try one:",
    reading: "Reading…",
    readAs: lang => `Read as ${lang}`,
    who: "Who?", paid: "Paid", owes: "Owes", mpesa: "M-Pesa", cash: "Cash",
    save: "✓ Save", discard: "Discard", saved: id => `Saved as ${id}. Checking it against the M-Pesa statement…`,
    discarded: "Discarded.",
    settles: q => `✓ This settles: ${q}`,
    opens: q => `⚠ New issue: ${q}`,
    watch: "▶ Watch the agents debate",
    matches: "✓ Matches the M-Pesa statement. Nothing to debate.",
    cashOk: "✓ Saved as a cash sale. M-Pesa doesn't need to agree.",
    debtOk: "✓ Added to the credit book.",
    heard: lang => `I heard${lang ? ` (${lang})` : ""}:`,
    onPage: n => `I can read ${n} ${n === 1 ? "line" : "lines"} on the page:`,
    nothing: "I couldn't find an amount or a name in that. Try saying who paid and how much.",
    needKey: "Photos and voice notes need a free Gemini key. Get one at aistudio.google.com/apikey, put GEMINI_API_KEY=… in the .env file and restart the server. Until then, voice uses your browser's speech-to-text and you can always type.",
    noVoice: "This browser can't record. Try Chrome, or type instead.",
    recording: "Recording… tap 🎤 again to send.",
    listening: lang => `Listening (${lang})… speak now.`,
    issuesHead: (n, a) => `${n} things don't match. ${a ? `${a} ${a === 1 ? "needs" : "need"} you.` : "The agents settled them all."}`,
    statusSettled: amt => `Settled by the agents: ${amt}`,
    statusAsk: "Needs your answer",
    toBrain: "🧠 Watch the agents", toChat: "💬 Back to chat",
    meter: (a, b) => `${a}/${b}`,
    problemNote: "Check the highlighted parts before saving.",
  },
  sw: {
    closing: d => `Kufunga hesabu za ${d}`,
    chat: "Gumzo", issues: "Matatizo",
    say: "Andika, au gusa 🎤 / 📷…",
    hello: "Habari! Andika pesa za leo hapa: <b>tuma picha</b> ya ukurasa wa kitabu, <b>ujumbe wa sauti</b>, au <b>andika</b> tu. Lugha yoyote: Kiingereza, Kiswahili, Sheng, Gĩkũyũ au Dholuo. Unaweza pia kutuma SMS ya M-Pesa.",
    tryOne: "Jaribu moja:",
    reading: "Nasoma…",
    readAs: lang => `Nimesoma kama ${lang}`,
    who: "Nani?", paid: "Amelipa", owes: "Anadaiwa", mpesa: "M-Pesa", cash: "Taslimu",
    save: "✓ Hifadhi", discard: "Futa", saved: id => `Imehifadhiwa kama ${id}. Nalinganisha na taarifa ya M-Pesa…`,
    discarded: "Imefutwa.",
    settles: q => `✓ Hii inatatua: ${q}`,
    opens: q => `⚠ Tatizo jipya: ${q}`,
    watch: "▶ Tazama mawakala wakijadili",
    matches: "✓ Inalingana na taarifa ya M-Pesa. Hakuna la kujadili.",
    cashOk: "✓ Imehifadhiwa kama mauzo ya taslimu.",
    debtOk: "✓ Imeongezwa kwenye kitabu cha madeni.",
    heard: lang => `Nimesikia${lang ? ` (${lang})` : ""}:`,
    onPage: n => `Naweza kusoma mistari ${n} kwenye ukurasa:`,
    nothing: "Sikupata kiasi au jina. Jaribu kusema nani amelipa na kiasi gani.",
    needKey: "Picha na sauti zinahitaji ufunguo wa bure wa Gemini. Pata kwenye aistudio.google.com/apikey, weka GEMINI_API_KEY=… kwenye faili .env na uanzishe seva upya. Kwa sasa, sauti inatumia kivinjari chako na unaweza kuandika.",
    noVoice: "Kivinjari hiki hakiwezi kurekodi. Jaribu Chrome, au andika.",
    recording: "Narekodi… gusa 🎤 tena kutuma.",
    listening: lang => `Nasikiliza (${lang})… ongea sasa.`,
    issuesHead: (n, a) => `Vitu ${n} havilingani. ${a ? `${a} vinakuhitaji.` : "Mawakala wametatua vyote."}`,
    statusSettled: amt => `Imetatuliwa na mawakala: ${amt}`,
    statusAsk: "Inahitaji jibu lako",
    toBrain: "🧠 Tazama mawakala", toChat: "💬 Rudi kwenye gumzo",
    meter: (a, b) => `${a}/${b}`,
    problemNote: "Angalia sehemu zilizowekwa alama kabla ya kuhifadhi.",
  },
};

const SAMPLES = [
  { tag: "SMS", text: "QKA5Y7GJ4T Confirmed. Ksh1,200.00 received from BRIAN MWANGI 0722***415 on 15/10/26 at 6:05 PM" },
  { tag: "KISWAHILI", text: "Kevin amelipa elfu moja mia tano kwa M-Pesa" },
  { tag: "SHENG", text: "Peter ametuma thao moja mpesa" },
  { tag: "GĨKŨYŨ", text: "Mary niarihire magana mana" },
  { tag: "DHOLUO", text: "Akinyi ochulo mia abich" },
  { tag: "ENGLISH", text: "Grace owes one thousand two hundred fifty" },
];

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const money = n => "KES " + Number(n).toLocaleString("en-US");
const kes = s => String(s).replace(/KES (\d{4,})/g, (_, n) => "KES " + Number(n).toLocaleString("en-US"));
const lang = () => (window.ukweli ? window.ukweli.lang() : "en");
const s = () => S[lang()];
let config = { gemini: false, business_day: "", shop: "" };

async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  const out = await res.json();
  if (!res.ok) throw new Error(out.error || "Something went wrong.");
  return out;
}

// ---------- Chat bubbles ----------

function add(who, html) {
  const row = document.createElement("div");
  row.className = `row ${who}`;
  row.innerHTML = `<div class="bubble">${html}</div>`;
  $("p-chat").appendChild(row);
  $("p-chat").scrollTop = $("p-chat").scrollHeight;
  return row.firstElementChild;
}

function typing() {
  return add("bot", `<span class="typing-dots"><i></i><i></i><i></i></span> <span class="meta" style="display:inline">${s().reading}</span>`).parentElement;
}

function greet() {
  $("p-chat").innerHTML = "";
  add("bot", `${s().hello}<span class="meta">${s().tryOne}</span><div class="samples">${
    SAMPLES.map((x, i) => `<button type="button" data-i="${i}"><b>${x.tag}</b>${esc(x.text)}</button>`).join("")}</div>`);
  $("p-chat").querySelectorAll(".samples button").forEach(b => (b.onclick = () => sendText(SAMPLES[b.dataset.i].text)));
}

// ---------- Reading results ----------

function entryCard(e) {
  const box = document.createElement("div");
  const need = new Set(e.problems || []);
  const kind = { v: e.kind || "paid" };
  const method = { v: e.method };
  box.innerHTML = `
    <span class="lang-tag">${esc(s().readAs(e.language_name || e.language))}</span>
    <div class="toks">${e.chips.map((c, i) => `<span class="tok" style="animation-delay:${i * 60}ms"><b>${esc(c.text)}</b> <span>${esc(c.means)}</span></span>`).join("")}</div>
    <div class="entry">
      <input class="who-in ${need.has("customer") ? "need" : ""}" value="${esc(e.customer ? e.customer.name : "")}" placeholder="${s().who}">
      <div class="amt"><small>KES</small><input inputmode="numeric" value="${e.amount || ""}" class="${need.has("amount") ? "need" : ""}"></div>
      <div class="facts">
        <span class="seg2 kind"><button type="button" data-v="paid">${s().paid}</button><button type="button" data-v="owes">${s().owes}</button></span>
        <span class="seg2 method ${need.has("method") ? "need" : ""}"><button type="button" data-v="mpesa">${s().mpesa}</button><button type="button" data-v="cash">${s().cash}</button></span>
        <span>${esc(e.date)}</span>${e.code ? `<span>${esc(e.code)}</span>` : ""}
      </div>
      ${need.size ? `<span class="meta">${s().problemNote}</span>` : ""}
      <div class="acts"><button type="button" class="no">${s().discard}</button><button type="button" class="ok">${s().save}</button></div>
    </div>`;
  const ok = box.querySelector(".ok");
  const nameIn = box.querySelector(".who-in");
  const amtIn = box.querySelector(".amt input");
  const methodSeg = box.querySelector(".seg2.method");
  const refresh = () => {
    box.querySelectorAll(".seg2.kind button").forEach(b => b.classList.toggle("on", b.dataset.v === kind.v));
    box.querySelectorAll(".seg2.method button").forEach(b => b.classList.toggle("on", b.dataset.v === method.v));
    methodSeg.style.display = kind.v === "owes" ? "none" : "";
    const ready = Number(amtIn.value) > 0 && nameIn.value.trim() && (kind.v === "owes" || method.v === "mpesa" || method.v === "cash");
    ok.disabled = !ready;
  };
  box.querySelectorAll(".seg2.kind button").forEach(b => (b.onclick = () => { kind.v = b.dataset.v; refresh(); }));
  box.querySelectorAll(".seg2.method button").forEach(b => (b.onclick = () => { method.v = b.dataset.v; methodSeg.classList.remove("need"); refresh(); }));
  nameIn.oninput = refresh;
  amtIn.oninput = refresh;
  refresh();

  box.querySelector(".no").onclick = () => {
    box.querySelector(".entry").classList.add("done");
    box.querySelector(".acts").innerHTML = `<span class="meta">${s().discarded}</span>`;
  };
  ok.onclick = async () => {
    const name = nameIn.value.trim();
    const sameName = e.customer && e.customer.name === name;
    const entry = {
      ...e,
      kind: kind.v,
      method: method.v,
      amount: Number(amtIn.value),
      customer: sameName ? e.customer : { id: null, name, new: true },
    };
    box.querySelector(".entry").classList.add("done");
    box.querySelector(".acts").innerHTML = "";
    await save(entry);
  };
  return box;
}

function questionOf(data, kase) {
  const d = data && data.debates.find(x => x.case === kase);
  if (!d) return kase;
  return kes(lang() === "sw" ? d.question_sw : d.question);
}

async function save(entry) {
  const before = window.ukweli.data();
  const t = typing();
  try {
    const out = await api("/api/save", { entry });
    t.remove();
    window.ukweli.setData(out);
    const lines = [];
    out.settled.forEach(k => lines.push(`<div class="pill">${esc(s().settles(questionOf(before, k)))}</div>`));
    out.opened.forEach(k => lines.push(`<div class="pill new">${esc(s().opens(questionOf(out, k)))}</div><button type="button" class="watch" data-case="${esc(k)}">${s().watch}</button>`));
    if (!lines.length) lines.push(`<div class="pill">${entry.kind === "owes" ? s().debtOk : entry.method === "cash" ? s().cashOk : s().matches}</div>`);
    const b = add("bot", `${esc(s().saved(out.saved))}<div class="result">${lines.join("")}</div>`);
    b.querySelectorAll(".watch").forEach(w => (w.onclick = () => window.ukweli.play(w.dataset.case)));
    renderIssues();
  } catch (err) {
    t.remove();
    add("bot", esc(err.message));
  }
}

function showReadings(out, intro = "") {
  const entries = (out.entries || []).filter(e => e.chips && e.chips.length);
  if (!entries.length) {
    add("bot", (intro ? intro + "<br>" : "") + esc(s().nothing));
    return;
  }
  const bubble = add("bot", intro);
  entries.forEach(e => bubble.appendChild(entryCard(e)));
  $("p-chat").scrollTop = $("p-chat").scrollHeight;
}

// ---------- Typing ----------

async function sendText(text, prefix = "") {
  text = text.trim();
  if (!text) return;
  add("me", prefix + esc(text));
  const t = typing();
  try {
    const out = await api("/api/read", { text });
    t.remove();
    showReadings(out);
  } catch (err) {
    t.remove();
    add("bot", esc(err.message));
  }
}

$("composer").onsubmit = ev => {
  ev.preventDefault();
  const text = $("say").value;
  $("say").value = "";
  sendText(text);
};

// ---------- Photos ----------

function shrink(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k);
      c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      resolve(c.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

$("photo").onchange = async ev => {
  const file = ev.target.files[0];
  ev.target.value = "";
  if (!file) return;
  const url = await shrink(file);
  add("me", `<img src="${url}" alt="">`);
  if (!config.gemini) return add("bot", esc(s().needKey));
  const t = typing();
  try {
    const out = await api("/api/photo", { data: url.split(",")[1], mime: "image/jpeg" });
    t.remove();
    const lines = (out.transcript || []).map(l => `<span class="tok"><b>${esc(l)}</b></span>`).join("");
    showReadings(out, `${esc(s().onPage(out.transcript.length))}<div class="toks">${lines}</div>`);
  } catch (err) {
    t.remove();
    add("bot", esc(err.message));
  }
};

// ---------- Voice ----------

let recorder = null;
let chunks = [];
let started = 0;

// Gemini doesn't take WebM, so recordings are converted to 16 kHz mono WAV.
async function toWav(blob) {
  const ctx = new AudioContext();
  const audio = await ctx.decodeAudioData(await blob.arrayBuffer());
  ctx.close();
  const rate = 16000;
  const off = new OfflineAudioContext(1, Math.ceil(audio.duration * rate), rate);
  const src = off.createBufferSource();
  src.buffer = audio;
  src.connect(off.destination);
  src.start();
  const pcm = (await off.startRendering()).getChannelData(0);
  const buf = new ArrayBuffer(44 + pcm.length * 2);
  const v = new DataView(buf);
  const str = (o, x) => [...x].forEach((ch, i) => v.setUint8(o + i, ch.charCodeAt(0)));
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE"); str(12, "fmt ");
  v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * 2, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data");
  v.setUint32(40, pcm.length * 2, true);
  pcm.forEach((x, i) => v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, x)) * 0x7fff, true));
  let bin = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

function waveHtml(seconds) {
  const bars = Array.from({ length: 26 }, () => `<i style="height:${4 + Math.round(Math.random() * 16)}px"></i>`).join("");
  return `<div class="wave">🎤 ${bars} <span class="meta" style="display:inline;margin:0 0 0 6px">0:${String(Math.round(seconds)).padStart(2, "0")}</span></div>`;
}

async function startGeminiRecording() {
  if (!navigator.mediaDevices || !window.MediaRecorder) return add("bot", esc(s().noVoice));
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  chunks = [];
  recorder = new MediaRecorder(stream);
  recorder.ondataavailable = e => chunks.push(e.data);
  recorder.onstop = async () => {
    stream.getTracks().forEach(tr => tr.stop());
    const seconds = (Date.now() - started) / 1000;
    add("me", waveHtml(seconds));
    const t = typing();
    try {
      const wav = await toWav(new Blob(chunks, { type: recorder.mimeType }));
      const out = await api("/api/voice", { data: wav, mime: "audio/wav" });
      t.remove();
      showReadings(out, `${esc(s().heard(out.heard))} <i>“${esc(out.transcript[0])}”</i>`);
    } catch (err) {
      t.remove();
      add("bot", esc(err.message));
    }
    recorder = null;
  };
  started = Date.now();
  recorder.start();
  $("mic").classList.add("rec");
  $("rec-bar").textContent = s().recording;
  $("rec-bar").classList.add("on");
}

// Without a Gemini key, fall back to the browser's own speech-to-text.
function browserSpeech() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return add("bot", esc(s().noVoice + " " + s().needKey));
  const rec = new SR();
  rec.lang = lang() === "sw" ? "sw-KE" : "en-KE";
  rec.interimResults = false;
  $("mic").classList.add("rec");
  $("rec-bar").textContent = s().listening(lang() === "sw" ? "Kiswahili" : "English");
  $("rec-bar").classList.add("on");
  rec.onresult = e => sendText(e.results[0][0].transcript, "🎤 ");
  rec.onerror = e => add("bot", esc(`${s().noVoice} (${e.error})`));
  rec.onend = () => { $("mic").classList.remove("rec"); $("rec-bar").classList.remove("on"); };
  rec.start();
}

$("mic").onclick = async () => {
  if (recorder) {
    recorder.stop();
    $("mic").classList.remove("rec");
    $("rec-bar").classList.remove("on");
    return;
  }
  try {
    if (config.gemini) await startGeminiRecording();
    else browserSpeech();
  } catch (err) {
    add("bot", esc(err.message));
  }
};

// ---------- Issues tab and header ----------

function renderIssues() {
  const data = window.ukweli && window.ukweli.data();
  if (!data) return;
  const ds = data.debates;
  const asks = ds.filter(d => d.outcome !== "settled").length;
  const settled = ds.length - asks;
  $("tab-issues").innerHTML = `${s().issues}${asks ? `<span class="count">${asks}</span>` : ""}`;
  const c = 132;
  $("p-meter").querySelector(".b").style.strokeDashoffset = String(ds.length ? c * (1 - settled / ds.length) : 0);
  $("p-meter-text").textContent = s().meter(settled, ds.length);
  $("p-issues").innerHTML = `<div class="meta" style="color:var(--muted);font-size:13px">${esc(s().issuesHead(ds.length, asks))}</div>` +
    ds.map(d => `
      <button type="button" class="issue" data-case="${esc(d.case)}">
        <small>${esc(d.kind.replace(/-/g, " "))}</small>
        <span>${esc(kes(lang() === "sw" ? d.question_sw : d.question))}</span>
        <span class="st ${d.outcome === "settled" ? "" : "ask"}">${d.outcome === "settled" ? esc(s().statusSettled(money(d.agreed))) : s().statusAsk}</span>
      </button>`).join("");
  $("p-issues").querySelectorAll(".issue").forEach(b => (b.onclick = () => window.ukweli.play(b.dataset.case)));
}

function renderStatic() {
  const day = config.business_day
    ? new Date(config.business_day + "T12:00:00").toLocaleDateString(lang() === "sw" ? "sw-KE" : "en-GB", { weekday: "short", day: "numeric", month: "short" })
    : "";
  $("p-shop").textContent = `${config.shop} · ${s().closing(day)}`;
  $("tab-chat").textContent = s().chat;
  $("say").placeholder = s().say;
  $("switch").textContent = document.body.classList.contains("show-brain") ? s().toChat : s().toBrain;
  renderIssues();
}

document.querySelectorAll(".p-tabs button").forEach(b => (b.onclick = () => {
  document.querySelectorAll(".p-tabs button").forEach(x => x.classList.toggle("on", x === b));
  $("p-chat").hidden = b.dataset.tab !== "chat";
  $("p-issues").hidden = b.dataset.tab !== "issues";
}));

$("switch").onclick = () => {
  document.body.classList.toggle("show-brain");
  renderStatic();
  window.dispatchEvent(new Event("resize"));
};

window.addEventListener("ukweli:data", renderIssues);
window.addEventListener("ukweli:lang", () => { renderStatic(); greet(); });

(async () => {
  try { config = await api("/api/config"); } catch { /* keep defaults */ }
  renderStatic();
  greet();
})();

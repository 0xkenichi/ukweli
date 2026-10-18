// Plays each MeTTa debate on the 3D stage, with captions, a versus HUD and a log.

const T = {
  en: {
    tagline: "Two agents. One truth.",
    forget: "Reset owner's answers", log: "Debate log", logBtn: "Log",
    ledger: "Ledger agent", ledgerSees: "Knows only the shop book",
    mpesa: "M-Pesa agent", mpesaSees: "Knows only the M-Pesa statement",
    play: "▶ Play debate", replay: "↻ Replay", playing: "Debating…", skip: "Skip to verdict", speed: "Speed",
    states: "states its case", evidence: "new evidence", rebuts: "rebuts", concedes: "concedes", nothing: "nothing to add",
    concedeText: (who, amt) => `${who} accepts the other side's evidence and now believes ${amt}.`,
    passText: who => `${who} has nothing more to bring.`,
    status: { ready: "ready", debating: "debating", settled: "agreed", escalated: "needs owner" },
    agreed: amt => `Agreed: <em>${amt}</em>`, confidence: "confidence", whatToDo: "What the owner should do",
    cantAgree: "The agents can't agree", askOwner: "One question for the owner", yes: "Yes", no: "No",
    beliefSaved: "Belief change, saved in MeTTa",
    learned: "The owner answered. The answer is now a MeTTa fact in memory/learned.metta, so the agents debate again with it…",
    loading: "The agents are reading the shop book and the M-Pesa statement…",
    foot: "Every claim, rebuttal and verdict comes from MeTTa rules in <code>metta/ukweli.metta</code>. Sample data is made up.",
    hint: "Press play to watch the agents debate.",
    rule: (a, b) => `MeTTa rule: (defeats <em>${a}</em> ${b})`,
    truth: amt => `Both agents now believe ${amt}. One truth.`,
  },
  sw: {
    tagline: "Mawakala wawili. Ukweli mmoja.",
    forget: "Futa majibu ya mwenye duka", log: "Kumbukumbu ya mjadala", logBtn: "Kumbukumbu",
    ledger: "Wakala wa Kitabu", ledgerSees: "Anajua kitabu cha duka tu",
    mpesa: "Wakala wa M-Pesa", mpesaSees: "Anajua taarifa ya M-Pesa tu",
    play: "▶ Anza mjadala", replay: "↻ Rudia", playing: "Wanajadili…", skip: "Ruka hadi uamuzi", speed: "Kasi",
    states: "anaeleza", evidence: "ushahidi mpya", rebuts: "anapinga", concedes: "anakubali", nothing: "hana la kuongeza",
    concedeText: (who, amt) => `${who} anakubali ushahidi wa upande mwingine; sasa anaamini ${amt}.`,
    passText: who => `${who} hana zaidi ya kuleta.`,
    status: { ready: "tayari", debating: "wanajadili", settled: "wamekubaliana", escalated: "mwenye duka" },
    agreed: amt => `Wamekubaliana: <em>${amt}</em>`, confidence: "uhakika", whatToDo: "Kazi kwa mwenye duka",
    cantAgree: "Mawakala hawakubaliani", askOwner: "Swali moja kwa mwenye duka", yes: "Ndiyo", no: "Hapana",
    beliefSaved: "Imani iliyobadilika, imehifadhiwa kwenye MeTTa",
    learned: "Mwenye duka amejibu. Jibu sasa ni ukweli wa MeTTa katika memory/learned.metta; mawakala wanajadili tena…",
    loading: "Mawakala wanasoma kitabu cha duka na taarifa ya M-Pesa…",
    foot: "Kila dai, pingamizi na uamuzi unatoka kwenye kanuni za MeTTa katika <code>metta/ukweli.metta</code>. Data ni ya mfano.",
    hint: "Bonyeza kuanza kuona mawakala wakijadiliana.",
    rule: (a, b) => `Kanuni ya MeTTa: (defeats <em>${a}</em> ${b})`,
    truth: amt => `Mawakala wote sasa wanaamini ${amt}. Ukweli mmoja.`,
  },
};

// Short names for each kind of evidence, shown on the 3D tablets.
const KIND = {
  "book-entry": "Book entry", "customer-sms": "Customer SMS", "statement-reversal": "Reversal",
  "statement-amount": "Exact amount", "book-entries-sum": "Two entries", "single-code": "One code",
  "no-book-entry": "No entry", "statement-received": "Money in", "own-number": "Owner's phone",
  "no-payment-from-number": "No payment", "same-day-payment": "Same-day KES", "unknown-payer": "Unknown no.",
  "owner-confirmed": "Owner: yes", "owner-denied": "Owner: no",
};
const OWNER_KINDS = new Set(["owner-confirmed", "owner-denied"]);
const CANCEL = Symbol("cancel");

const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const kes = s => String(s).replace(/KES (\d{4,})/g, (_, n) => "KES " + Number(n).toLocaleString("en-US"));
const money = n => "KES " + Number(n).toLocaleString("en-US");
const other = a => (a === "ledger" ? "mpesa" : "ledger");

const state = { lang: "en", data: null, current: 0, run: 0, playing: false, done: false, banner: "" };
const t = () => T[state.lang];
const name = a => (a === "ledger" ? t().ledger : t().mpesa);
const debate = () => state.data.debates[state.current];
let stage = null;
let COLORS = { ledger: 0xf2a33a, mpesa: 0x2fd27a, owner: 0x7b93ff };

// ---------- Small helpers ----------

function sleep(ms, run) {
  return new Promise((resolve, reject) => setTimeout(() => (run === state.run ? resolve() : reject(CANCEL)), ms));
}
async function step(promise, run) {
  await promise;
  if (run !== state.run) throw CANCEL;
}
const speed = () => Number($("speed").value);
const readTime = text => Math.min(4200, Math.max(1500, String(text).length * 32)) / speed();

async function api(path, body) {
  const res = await fetch(path, body ? { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : undefined);
  return res.json();
}

// ---------- HUD ----------

const hud = { ledger: { tabs: [] }, mpesa: { tabs: [] } };

function setBelief(side, amount, was = null) {
  const el = $(`belief-${side}`);
  const wasHtml = was == null ? "" : `<span class="was">${money(was)}</span>`;
  if (was == null) { el.innerHTML = money(amount); return; }
  const c = { v: was };
  window.gsap.to(c, {
    v: amount, duration: 1.4, ease: "power3.out",
    onUpdate: () => {
      const now = money(Math.round(c.v));
      el.innerHTML = side === "mpesa" ? `${now}${wasHtml}` : `${wasHtml}${now}`;
    },
  });
}

function renderPips() {
  for (const side of ["ledger", "mpesa"]) {
    $(`pips-${side}`).innerHTML = hud[side].tabs
      .map(tab => `<span class="pip ${tab.owner ? "owner" : ""} ${tab.standing ? "" : "down"}" title="${esc(tab.label)}"></span>`)
      .join("");
  }
}

function setStatus(key) { $("status").textContent = t().status[key]; }

function speaking(side) {
  const el = $(`hud-${side}`);
  el.classList.remove("speaking");
  void el.offsetWidth;
  el.classList.add("speaking");
}

// ---------- Captions with a typewriter ----------

let typing = null;
function caption(kind, who, text, rule = "") {
  clearInterval(typing);
  $("cap-who").className = `who ${kind}`;
  $("cap-who").textContent = who;
  $("cap-rule").innerHTML = rule;
  const el = $("cap-text");
  const full = kes(text);
  let i = 0;
  const per = Math.max(8, 22 / speed());
  el.innerHTML = '<span class="cursor">&nbsp;</span>';
  typing = setInterval(() => {
    i += 2;
    el.innerHTML = esc(full.slice(0, i)) + (i < full.length ? '<span class="cursor">&nbsp;</span>' : "");
    if (i >= full.length) clearInterval(typing);
  }, per);
}

function finishCaption(kind, who, text, rule = "") {
  clearInterval(typing);
  $("cap-who").className = `who ${kind}`;
  $("cap-who").textContent = who;
  $("cap-text").innerHTML = esc(kes(text));
  $("cap-rule").innerHTML = rule;
}

function logMove(side, title, text, rule = "") {
  const li = document.createElement("li");
  li.className = side;
  li.innerHTML = `<b>${esc(title)}</b>${esc(kes(text))}${rule ? `<span class="rule">${rule}</span>` : ""}`;
  $("log-list").appendChild(li);
  li.scrollIntoView({ block: "nearest" });
}

// ---------- Question reveal ----------

function showQuestion() {
  const d = debate();
  const q = kes(state.lang === "sw" ? d.question_sw : d.question);
  $("question").innerHTML = q.split(" ").map(w => `<span class="w">${esc(w)}</span>`).join(" ");
  [...$("question").querySelectorAll(".w")].forEach((w, i) => setTimeout(() => w.classList.add("in"), 40 * i));
}

// ---------- Cases ----------

function renderCases() {
  $("cases").innerHTML = state.data.debates.map((d, i) => `
    <button class="case ${i === state.current ? "on" : ""}" data-i="${i}" title="${esc(kes(state.lang === "sw" ? d.question_sw : d.question))}">
      <span class="num">0${i + 1}</span><span class="dot ${d.outcome === "settled" ? "" : "ask"}"></span>
    </button>`).join("");
  $("cases").querySelectorAll(".case").forEach(b => (b.onclick = () => select(Number(b.dataset.i))));
}

// ---------- Evidence bookkeeping (mirrors the debate protocol) ----------

function makeBook() {
  const beatenBy = new Map();
  const standing = (key, seen = new Set()) => {
    if (!beatenBy.has(key)) return true;
    if (seen.has(key)) return false;
    seen.add(key);
    return !standing(beatenBy.get(key), seen);
  };
  return { beatenBy, standing };
}

const keyOf = (agent, kind) => `${agent}:${kind}`;

function addTab(agent, kind) {
  const owner = OWNER_KINDS.has(kind);
  hud[agent].tabs.push({ key: keyOf(agent, kind), label: KIND[kind] || kind, owner, standing: true });
  renderPips();
  return { label: KIND[kind] || kind, color: owner ? COLORS.owner : COLORS[agent], owner };
}

function syncStanding(book) {
  for (const side of ["ledger", "mpesa"]) {
    for (const tab of hud[side].tabs) {
      const now = book.standing(tab.key);
      if (now && !tab.standing && stage) stage.restore(tab.key);
      tab.standing = now;
    }
  }
  renderPips();
  stage?.weigh();
}

// ---------- Playback ----------

function resetCase() {
  const d = debate();
  hud.ledger.tabs = [];
  hud.mpesa.tabs = [];
  renderPips();
  setBelief("ledger", d.claims.ledger);
  setBelief("mpesa", d.claims.mpesa);
  $("verdict").innerHTML = "";
  $("log-list").innerHTML = "";
  $("banner").innerHTML = state.banner ? `<div class="learned glass">${esc(state.banner)}</div>` : "";
  stage?.reset(d.claims);
  setStatus("ready");
  finishCaption("gold", "Ukweli", t().hint);
  state.done = false;
}

async function play() {
  const run = ++state.run;
  state.playing = true;
  updateButtons();
  resetCase();
  setStatus("debating");
  const d = debate();
  const book = makeBook();
  try {
    await sleep(500, run);
    for (const m of d.moves) await playMove(m, d, book, run);
    await finish(d, run);
  } catch (e) {
    if (e !== CANCEL) throw e;
    return;
  }
  state.playing = false;
  state.done = true;
  updateButtons();
}

async function playMove(m, d, book, run) {
  const who = name(m.agent);
  const side = m.agent;

  // Bring a piece of evidence onto the scale.
  const present = async (title, kind, says) => {
    caption(side, `${who} · ${title}`, says);
    speaking(side);
    logMove(side, `${who} · ${title}`, says);
    const tab = addTab(side, kind);
    if (stage) {
      stage.speak(side);
      await step(stage.addEvidence(side, keyOf(side, kind), tab.label, tab.color), run);
      stage.weigh();
    }
    await sleep(readTime(says), run);
  };

  if (m.act === "open" || m.act === "present") {
    const title = m.act === "open" ? `${t().states} · ${money(m.claim)}` : t().evidence;
    await present(title, m.kind, m.says);
  } else if (m.act === "rebut") {
    if (m.says) await present(m.claim != null ? `${t().states} · ${money(m.claim)}` : t().evidence, m.kind, m.says);
    const rule = t().rule(esc(m.kind), esc(m.target));
    caption(side, `${who} · ${t().rebuts}`, m.why, rule);
    speaking(side);
    logMove(side, `${who} · ${t().rebuts}`, m.why, rule);
    const attacker = keyOf(side, m.kind);
    const target = keyOf(other(side), m.target);
    book.beatenBy.set(target, attacker);
    if (stage) await step(stage.rebut(attacker, target), run);
    syncStanding(book);
    await sleep(readTime(m.why), run);
  } else if (m.act === "concede") {
    const text = t().concedeText(who, money(m.claim));
    caption(side, `${who} · ${t().concedes}`, text);
    logMove(side, `${who} · ${t().concedes}`, text);
    setBelief(side, m.claim, d.claims[side]);
    if (stage) await step(stage.concede(side, d.claims[side], m.claim), run);
    await sleep(900 / speed(), run);
  } else {
    const text = t().passText(who);
    caption(side, `${who} · ${t().nothing}`, text);
    logMove(side, `${who} · ${t().nothing}`, text);
    stage?.pass(side);
    await sleep(1300 / speed(), run);
  }
}

async function finish(d, run) {
  if (d.outcome === "settled") {
    setStatus("settled");
    if (stage) stage.agree();
    finishCaption("gold", "Ukweli", t().truth(money(d.agreed)));
    showVerdict(d);
  } else {
    setStatus("escalated");
    const q = state.lang === "sw" ? d.owner_question_sw : d.owner_question;
    caption("owner", t().askOwner, q);
    showVerdict(d);
    if (stage) await step(stage.escalate(), run);
  }
}

function showVerdict(d) {
  if (d.outcome === "settled") {
    const pct = Math.round(d.confidence * 100);
    const c = 2 * Math.PI * 36;
    const b = d.belief_change;
    $("verdict").innerHTML = `
      <div class="verdict glass">
        <div class="ring"><svg viewBox="0 0 86 86"><circle class="track" cx="43" cy="43" r="36"/>
          <circle class="bar" cx="43" cy="43" r="36" stroke-dasharray="${c}" stroke-dashoffset="${c}"/></svg><span>${pct}%</span></div>
        <h3>${t().agreed(money(d.agreed))}</h3>
        <div class="label">${t().whatToDo} · ${t().confidence} ${pct}%</div>
        <p class="action">${esc(kes(state.lang === "sw" ? d.action_sw : d.action))}</p>
        <div class="diff"><span class="label">${t().beliefSaved}</span><br>(belief ${b.agent} ${esc(d.case)} <span class="old">(kes ${b.old})</span> → <span class="new">(kes ${b.new})</span>)</div>
      </div>`;
    requestAnimationFrame(() => {
      const bar = $("verdict").querySelector(".bar");
      if (bar) bar.style.strokeDashoffset = String(c * (1 - d.confidence));
    });
  } else {
    $("verdict").innerHTML = `
      <div class="verdict ask glass">
        <div class="orb"></div>
        <h3>${t().cantAgree}</h3>
        <div class="label">${t().askOwner}</div>
        <p class="action">${esc(kes(state.lang === "sw" ? d.owner_question_sw : d.owner_question))}</p>
        ${d.ask && d.ask.customer ? `<div class="answers"><button class="yes" id="yes">${t().yes}</button><button class="no" id="no">${t().no}</button></div>` : ""}
      </div>`;
    if (d.ask && d.ask.customer) {
      $("yes").onclick = () => answer(true);
      $("no").onclick = () => answer(false);
    }
  }
}

// Skip straight to the end state without the animations.
function skip() {
  const run = ++state.run;
  resetCase();
  const d = debate();
  const book = makeBook();
  for (const m of d.moves) {
    const side = m.agent;
    if ((m.act === "open" || m.act === "present" || m.act === "rebut") && m.says) {
      const tab = addTab(side, m.kind);
      stage?.addEvidenceInstant(side, keyOf(side, m.kind), tab.label, tab.color);
    }
    if (m.act === "rebut") {
      const target = keyOf(other(side), m.target);
      book.beatenBy.set(target, keyOf(side, m.kind));
      stage?.knock(target);
    }
    const text = m.act === "concede" ? t().concedeText(name(side), money(m.claim))
      : m.act === "pass" ? t().passText(name(side)) : m.act === "rebut" ? m.why : m.says;
    logMove(side, name(side), text);
  }
  syncStanding(book);
  const c = d.moves.find(m => m.act === "concede");
  if (c) setBelief(c.agent, c.claim, d.claims[c.agent]);
  if (stage && c) stage.setBelief(c.agent, c.claim, false);
  finish(d, run).catch(() => {});
  state.playing = false;
  state.done = true;
  updateButtons();
}

function updateButtons() {
  $("play").textContent = state.playing ? t().playing : state.done ? t().replay : t().play;
  $("play").disabled = state.playing;
}

function select(i) {
  state.run++;
  state.playing = false;
  state.banner = "";
  state.current = i;
  renderCases();
  showQuestion();
  resetCase();
  updateButtons();
}

async function answer(yes) {
  const d = debate();
  const kase = d.case;
  state.data = await api("/api/answer", { customer: d.ask.customer, phone: d.ask.phone, answer: yes });
  state.current = Math.max(0, state.data.debates.findIndex(x => x.case === kase));
  renderCases();
  stage?.hideLantern();
  state.banner = t().learned;
  showQuestion();
  play();
}

function renderStatic() {
  document.documentElement.lang = state.lang;
  $("tagline").textContent = t().tagline;
  $("forget").textContent = t().forget;
  $("logBtn").textContent = t().logBtn;
  $("skip").textContent = t().skip;
  $("foot").innerHTML = t().foot;
  $("loading-text").textContent = t().loading;
  document.querySelectorAll("[data-t]").forEach(el => (el.textContent = t()[el.dataset.t]));
  document.querySelectorAll(".seg button").forEach(b => b.classList.toggle("on", b.dataset.lang === state.lang));
  updateButtons();
}

// ---------- Start ----------

$("play").onclick = play;
$("skip").onclick = skip;
$("logBtn").onclick = () => $("log").classList.toggle("open");
$("forget").onclick = async () => { state.data = await api("/api/forget", {}); select(state.current); };
document.querySelectorAll(".seg button").forEach(b => (b.onclick = () => {
  state.lang = b.dataset.lang;
  renderStatic();
  renderCases();
  showQuestion();
  if (!state.playing && !state.done) finishCaption("gold", "Ukweli", t().hint);
  if (state.done) showVerdict(debate());
}));

(async () => {
  renderStatic();
  const fonts = document.fonts
    ? Promise.all([document.fonts.load('700 40px "Space Grotesk"'), document.fonts.load('600 30px "Space Grotesk"')]).catch(() => {})
    : Promise.resolve();
  try {
    await fonts;
    const mod = await import("./stage.js");
    COLORS = mod.COLORS;
    stage = new mod.Stage($("stage"));
  } catch (e) {
    console.warn("3D stage unavailable, running without it.", e);
    stage = null;
  }
  state.data = await api("/api/debates");
  select(0);
  $("loading").classList.add("gone");
})();

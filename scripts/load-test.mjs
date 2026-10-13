const base = process.env.BASE_URL || "http://127.0.0.1:3000";

function cookieFrom(response) {
  const raw = response.headers.getSetCookie?.() ?? [];
  const single = response.headers.get("set-cookie");
  const all = raw.length ? raw : single ? [single] : [];
  const sid = all.map((item) => item.split(";")[0]).find((item) => item.startsWith("sid="));
  if (!sid) throw new Error("Session tidak terbentuk.");
  return sid;
}

async function api(path, { cookie, body, method = "POST" } = {}) {
  const started = performance.now();
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-ujian-request": "1",
      origin: base,
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const elapsed = performance.now() - started;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(`${path} ${response.status} ${data.error || ""}`);
  }
  return { data, elapsed, response };
}

function percentile(values, ratio) {
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1);
  return sorted[Math.max(0, index)];
}

const identity = process.env.LOAD_IDENTITY;
const password = process.env.LOAD_PASSWORD;
if (!identity || !password) {
  console.error("Isi LOAD_IDENTITY dan LOAD_PASSWORD peserta OMBN sebelum mengukur beban login.");
  process.exit(1);
}
const login = await fetch(`${base}/api/auth/login`, {
  method: "POST",
  headers: { "content-type": "application/json", "x-ujian-request": "1", origin: base },
  body: JSON.stringify({ identity, password }),
});
if (!login.ok) {
  console.error(await login.text());
  process.exit(1);
}
const cookie = cookieFrom(login);
const home = await fetch(`${base}/peserta`, { headers: { cookie } });
const html = await home.text();
const sessionMatch = html.match(/\/peserta\/sesi\/(\d+)/);
if (!sessionMatch) throw new Error("Sesi peserta tidak ditemukan. Jalankan db:seed.");
const sessionId = Number(sessionMatch[1]);
await api("/api/peserta/absen", { cookie, body: { sessionId } }).catch((error) => {
  if (!String(error.message).includes("409")) throw error;
});
const started = await api("/api/peserta/mulai", { cookie, body: { sessionId } });
const attemptId = started.data.attemptId;
const state = await api(`/api/peserta/attempt/${attemptId}/state`, { cookie, method: "GET" });
const leaked = JSON.stringify(state.data);
if (/"isCorrect"|answerKey|rubric/.test(leaked)) {
  throw new Error("Kunci jawaban terkirim ke peserta.");
}
const question = state.data.questions[0];
const optionId = question.options?.[1]?.id ?? question.options?.[0]?.id ?? null;
const total = Number(process.env.LOAD_REQUESTS || 40);
const concurrency = Number(process.env.LOAD_CONCURRENCY || 8);
const samples = [];
let cursor = 0;
async function worker() {
  while (cursor < total) {
    const current = cursor;
    cursor += 1;
    const result = await api(`/api/peserta/attempt/${attemptId}/jawaban`, {
      cookie,
      body: {
        questionId: question.id,
        selectedOptionId: question.type === "MULTIPLE_CHOICE" ? optionId : null,
        essayText: question.type === "ESSAY" ? `jawaban ${current}` : null,
        isDoubtful: false,
        lastQuestionIndex: 0,
      },
    });
    samples.push(result.elapsed);
  }
}
await Promise.all(Array.from({ length: concurrency }, () => worker()));
const p95 = percentile(samples, 0.95);
console.log(JSON.stringify({ requests: samples.length, p95Ms: Math.round(p95), maxMs: Math.round(Math.max(...samples)) }, null, 2));
if (p95 > 500) {
  console.error("p95 melebihi 500 ms pada mesin ini.");
  process.exitCode = 2;
}

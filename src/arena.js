import qrcode from "qrcode-generator";
import {
  MatchConnection,
  roomRequest,
  validateEndpoint,
  SESSION_KEY,
} from "./arena-client.js";
import { MAPS } from "./maps.js";
import "./cloud.css";
let active = null;
export function setupArena(content, { openGame }) {
  content.innerHTML = `<div class="cloud-page arena-page"><span class="eyebrow">COMMAND HORIZON · ONLINE 1V1</span><h2>مواجهة عبر الويب لشخصين</h2><p>أنشئ غرفة وشارك رابط الدعوة، أو أدخل رمز غرفة صديقك. يبدأ القتال بعد اتصال الطرفين والضغط على «جاهز للمواجهة». كل لاعب يقود جيشه ويتحكم بموارده ومقرّه.</p><details class="arena-config"><summary>عنوان خادم اللعب</summary><label>خادم المواجهة<input type="url" aria-label="عنوان خادم اللعب" placeholder="https://myos-arena.example.workers.dev"></label><p>يحتاج هذا الوضع خادم Cloudflare Workers مستقلًا. موقع GitHub Pages وحده لا يشغّل الغرف. <a href="https://github.com/MagdyAqel/MyOS/blob/main/multiplayer/README.md" target="_blank" rel="noopener noreferrer">دليل الربط</a></p></details><label>اسم القائد<input aria-label="اسم القائد" maxlength="32" autocomplete="nickname" placeholder="اسمك في المواجهة"></label><label>المال لكل لاعب في غرفة جديدة<input type="number" min="1000" max="100000" step="100" value="2400" aria-label="مال بداية المواجهة"></label><label>خريطة غرفة جديدة<select aria-label="خريطة المواجهة">${MAPS.map((m) => `<option value="${m.id}">${m.name}</option>`).join("")}</select></label><button data-arena="create">إنشاء غرفة خاصة</button><label>رمز الغرفة أو رابط الدعوة<input aria-label="رمز الغرفة أو رابط الدعوة" autocomplete="off" spellcheck="false"></label><button data-arena="join">الانضمام إلى الغرفة</button><button data-arena="resume">استئناف الاتصال السابق</button><section class="arena-room hidden"><label>رابط دعوة صديقك<input readonly aria-label="رابط دعوة صديقك"></label><button data-arena="copy">نسخ الدعوة</button><div class="arena-qr" aria-label="رمز QR للدعوة"></div><p class="arena-players"></p><p class="arena-latency"></p><button data-arena="ready">جاهز للمواجهة</button><button data-arena="play">فتح ساحة المواجهة</button><button data-arena="surrender">استسلام</button><button data-arena="rematch">طلب إعادة المواجهة</button><button data-arena="leave">مغادرة الغرفة</button></section><p class="arena-status" role="status"></p><p>الغرفة لمقعدين فقط وتنتهي بعد ساعتين. تبقى المعركة متوقفة عند انقطاع أحد اللاعبين، ويُحسب الانسحاب بعد مهلة 60 ثانية. لا يحتاج اللاعبان إلى حساب؛ يُحفظ رمز استئناف المقعد في جلسة هذا المتصفح فقط. لا تشارك رمز الاستئناف. الحملة الفردية وحفظها منفصلان عن المواجهة.</p></div>`;
  const endpoint = content.querySelector('[aria-label="عنوان خادم اللعب"]'),
    code = content.querySelector('[aria-label="رمز الغرفة أو رابط الدعوة"]'),
    status = content.querySelector(".arena-status"),
    room = content.querySelector(".arena-room");
  let connection = null,
    closed = false,
    busy = false,
    endpointEdited = false;
  endpoint.oninput = () => {
    endpointEdited = true;
  };
  const tell = (text) => {
    if (!closed) status.textContent = text;
  };
  const lock = (value) => {
    busy = value;
    for (const name of ["create", "join", "resume"])
      content.querySelector(`[data-arena=${name}]`).disabled = value;
  };
  let invitation = new URLSearchParams(location.hash.slice(1));
  if (invitation.has("myos-room")) {
    code.value = invitation.get("myos-room");
    if (invitation.get("server")) endpoint.value = invitation.get("server");
  }
  try {
    if (!endpoint.value)
      endpoint.value = validateEndpoint(
        localStorage.getItem("myos-multiplayer-endpoint-v1"),
      );
  } catch {}
  const preferredEndpoint = Boolean(endpoint.value);
  if (!endpoint.value) {
    try {
      endpoint.value = validateEndpoint(
        import.meta.env.VITE_MYOS_MULTIPLAYER_ENDPOINT,
      );
    } catch {
      /* A custom installation can still configure its server below. */
    }
  }
  const initialEndpoint = endpoint.value;
  const configController = new AbortController();
  const configTimeout = setTimeout(() => configController.abort(), 6000);
  const configUrl = new URL(
    `${import.meta.env.BASE_URL}multiplayer.json`,
    document.baseURI,
  );
  // Old workers cache the exact asset URL; this also reaches fresh settings before an update activates.
  configUrl.searchParams.set("config", "current");
  fetch(configUrl, { cache: "no-store", signal: configController.signal })
    .then((r) => {
      if (!r.ok) throw Error("تعذّر تحميل إعداد خادم اللعب");
      return r.json();
    })
    .then((config) => {
      if (
        closed ||
        preferredEndpoint ||
        endpointEdited ||
        connection ||
        busy ||
        endpoint.value !== initialEndpoint
      )
        return;
      if (config.endpoint) endpoint.value = validateEndpoint(config.endpoint);
      else if (!endpoint.value) {
        content.querySelector(".arena-config").open = true;
        tell(
          "خادم المواجهة لم يُربط بهذا الموقع بعد. أدخل عنوانه بعد نشره على Cloudflare.",
        );
      }
    })
    .catch(() => {
      if (!closed && !endpoint.value) {
        content.querySelector(".arena-config").open = true;
        tell("تعذّر تحميل إعداد خادم اللعب؛ أدخل عنوان الخادم في الخانة أعلاه");
      }
    })
    .finally(() => clearTimeout(configTimeout));
  function observe() {
    if (!connection || closed) return;
    room.classList.remove("hidden");
    tell(connection.status);
    const state = connection.state;
    if (state) {
      content.querySelector(".arena-players").textContent =
        `أنت: ${connection.session.side === "blue" ? "الجهة اليسرى" : "الجهة اليمنى"} · اللاعب الأول ${state.players.blue.connected ? "متصل" : "غير متصل"} ${state.players.blue.ready ? "وجاهز" : ""} · اللاعب الثاني ${state.players.red.connected ? "متصل" : "غير متصل"} ${state.players.red.ready ? "وجاهز" : ""}`;
      content.querySelector("[data-arena=play]").disabled = false;
      content.querySelector("[data-arena=ready]").disabled =
        state.players[connection.session.side].ready || state.phase === "ended";
      content.querySelector(".arena-latency").textContent =
        `${state.players.blue.name || "اللاعب الأول"} × ${state.players.red.name || "اللاعب الثاني"} · المال الأولي $${state.battle?.startingCash || 2400} · ${connection.latency === null ? "قياس الاتصال…" : `${connection.latency} ms · ${connection.latency < 120 ? "اتصال جيد" : connection.latency < 300 ? "اتصال متوسط" : "اتصال بطيء"}`}`;
      content.querySelector("[data-arena=surrender]").disabled = ![
        "playing",
        "paused",
        "countdown",
      ].includes(state.phase);
      const rematch = content.querySelector("[data-arena=rematch]");
      rematch.disabled =
        state.phase !== "ended" ||
        state.players[connection.session.side].rematch;
      rematch.textContent = state.players[connection.session.side].rematch
        ? "بانتظار موافقة الخصم"
        : "طلب إعادة المواجهة";
    } else content.querySelector("[data-arena=play]").disabled = true;
  }
  function detach() {
    if (connection) {
      connection.removeEventListener("state", observe);
      connection.removeEventListener("status", observe);
      connection.release();
      connection = null;
    }
  }
  function attach(session) {
    detach();
    session.name ||=
      content
        .querySelector('[aria-label="اسم القائد"]')
        .value.trim()
        .slice(0, 32) || "";
    if (
      active &&
      !active.closed &&
      active.session.room === session.room &&
      active.session.side === session.side
    )
      connection = active;
    else {
      connection = new MatchConnection(session);
      active = connection;
    }
    connection.retain();
    sessionStorage.setItem(SESSION_KEY, JSON.stringify(session));
    try {
      localStorage.setItem("myos-multiplayer-endpoint-v1", session.endpoint);
    } catch {}
    connection.addEventListener("state", observe);
    connection.addEventListener("status", observe);
    const link = new URL(location.href);
    link.hash = new URLSearchParams({
      "myos-room": session.room,
      server: session.endpoint,
    }).toString();
    content.querySelector('[aria-label="رابط دعوة صديقك"]').value = link.href;
    const qr = qrcode(0, "M");
    qr.addData(link.href);
    qr.make();
    content.querySelector(".arena-qr").innerHTML = qr.createSvgTag({
      cellSize: 3,
      margin: 12,
      scalable: true,
    });
    observe();
  }
  async function run(operation) {
    if (busy) return;
    lock(true);
    try {
      await operation();
    } catch (error) {
      try {
        validateEndpoint(endpoint.value);
      } catch {
        content.querySelector(".arena-config").open = true;
      }
      tell(error.message || "تعذّر الاتصال");
    } finally {
      lock(false);
    }
  }
  content.querySelector("[data-arena=create]").onclick = () =>
    run(async () => {
      const map = MAPS.find(
        (m) =>
          m.id === content.querySelector('[aria-label="خريطة المواجهة"]').value,
      );
      const session = await roomRequest(endpoint.value, "/rooms", {
        stage: map.stage,
        map: map.id,
        startingCash: Number(
          content.querySelector('[aria-label="مال بداية المواجهة"]').value,
        ),
      });
      if (!closed) attach(session);
    });
  content.querySelector("[data-arena=join]").onclick = () =>
    run(async () => {
      let id = code.value.trim(),
        server = endpoint.value;
      if (id.includes("://")) {
        let link;
        try {
          link = new URL(id);
        } catch {
          throw Error("أدخل رمز الغرفة الكامل أو رابط دعوة صالحًا");
        }
        const params = new URLSearchParams(link.hash.slice(1));
        id = params.get("myos-room") || "";
        server = params.get("server") || server;
        endpoint.value = server;
      }
      if (!/^[a-f0-9]{32}$/.test(id))
        throw Error("أدخل رمز الغرفة الكامل أو رابط الدعوة");
      const session = await roomRequest(server, "/rooms/" + id + "/join");
      if (!closed) attach(session);
    });
  content.querySelector("[data-arena=resume]").onclick = () =>
    run(async () => {
      const session = JSON.parse(sessionStorage.getItem(SESSION_KEY));
      if (
        !session ||
        !/^[a-f0-9]{32}$/.test(session.room) ||
        !/^[a-f0-9]{32}$/.test(session.token) ||
        !["blue", "red"].includes(session.side)
      )
        throw Error("لا توجد جلسة غرفة محفوظة في هذا التبويب");
      session.endpoint = validateEndpoint(session.endpoint);
      attach(session);
    });
  content.querySelector("[data-arena=ready]").onclick = () =>
    connection?.ready();
  content.querySelector("[data-arena=play]").onclick = () => {
    if (connection?.state) openGame(connection);
  };
  content.querySelector("[data-arena=surrender]").onclick = () =>
    connection?.send({ type: "surrender" });
  content.querySelector("[data-arena=rematch]").onclick = () =>
    connection?.send({ type: "rematch" });
  content.querySelector("[data-arena=leave]").onclick = () => {
    connection?.close();
    detach();
    sessionStorage.removeItem(SESSION_KEY);
    room.classList.add("hidden");
    tell("غادرت الغرفة. يمكنك إنشاء غرفة جديدة.");
  };
  content.querySelector("[data-arena=copy]").onclick = async () => {
    const input = content.querySelector('[aria-label="رابط دعوة صديقك"]');
    try {
      await navigator.clipboard.writeText(input.value);
      tell("نُسخ رابط الدعوة");
    } catch {
      input.focus();
      input.select();
      tell("حدّد الرابط وانسخه لمشاركته");
    }
  };
  if (active && !active.closed) attach(active.session);
  return () => {
    closed = true;
    clearTimeout(configTimeout);
    configController.abort();
    detach();
  };
}

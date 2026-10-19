import { restoreBattle } from "./battle-save.js";
export function bindNetworkGame(
  content,
  connection,
  { getBattle, onBattle, refresh },
) {
  let received = 0,
    baseTime = 0,
    closed = false;
  connection.retain();
  const header = document.createElement("p");
  header.className = "online-match-status";
  header.setAttribute("role", "status");
  content.querySelector(".rts-app").prepend(header);
  const fields = [
    '[aria-label="اختيار المرحلة"]',
    '[aria-label="اختيار الخريطة"]',
    '[aria-label="نوع المهمة"]',
    '[aria-label="مستوى الصعوبة"]',
    "[data-game=restart]",
    "[data-game=next]",
    "[data-game=pause]",
    "[data-game=save]",
    "[data-game=resume]",
    "[data-game=fog]",
    "[data-game=configure]",
    "[data-game=campaign]",
  ];
  const controls = connection.controls;
  let match = 0;
  const actions = document.createElement("div");
  actions.className = "online-match-actions";
  for (const [type, label] of [
    ["surrender", "استسلام"],
    ["rematch", "إعادة المواجهة"],
  ]) {
    const button = document.createElement("button");
    button.dataset.online = type;
    button.textContent = label;
    button.onclick = () => connection.send({ type });
    actions.append(button);
  }
  content.querySelector(".rts-app").classList.add("network-match");
  content.querySelector(".rts-header").append(actions);
  function request(action) {
    const b = getBattle();
    return connection.action({ ...action, selected: [...(b?.selected || [])] });
  }
  function load() {
    if (closed || !connection.state) return;
    try {
      const data = connection.state,
        old = getBattle(),
        b = restoreBattle(data.battle);
      if (match !== data.match) {
        if (old) old.selected.clear();
        controls.groups = {};
        match = data.match;
      }
      b.paused = data.phase !== "playing";
      b.selected = new Set(
        [...(old?.selected || [])].filter((id) =>
          b.entities.some(
            (e) => e.id === id && e.team === "blue" && !e.carriedBy,
          ),
        ),
      );
      b.groups = controls.groups;
      for (const name of ["formation", "commandMode"])
        Object.defineProperty(b, name, {
          configurable: true,
          get: () => controls[name],
          set: (value) => (controls[name] = value),
        });
      for (const e of b.entities) {
        const before = old?.entities.find((a) => a.id === e.id);
        e.fromX = before?.x ?? e.x;
        e.fromY = before?.y ?? e.y;
        e.toX = e.x;
        e.toY = e.y;
        e.aim = before?.aim;
      }
      b.events = Array.isArray(data.events) ? data.events : [];
      for (const event of b.events)
        if (event.kind === "shot") {
          const unit = b.entities.find((e) => e.id === event.unit);
          if (unit) {
            unit.firing = 0.2;
            unit.aim = Math.atan2(event.tx - event.x, event.ty - event.y);
          }
        }
      b.message =
        Date.now() < connection.noticeUntil
          ? connection.notice
          : connection.status;
      b.purchase = (unit, x, y, design) =>
        request({ kind: "purchase", unit, x, y, design });
      b.command = (x, y) => request({ kind: "command", x, y });
      b.serviceSelected = () => request({ kind: "service" });
      b.requestNetwork = request;
      received = performance.now();
      baseTime = b.time;
      onBattle(b, !old);
      refresh();
    } catch {
      header.textContent =
        "تعذّر قراءة حالة المواجهة؛ أعد الاتصال من نافذة اللعب عبر الويب";
    }
  }
  function ack() {
    const b = getBattle();
    if (b) {
      b.message = connection.notice;
      refresh();
    }
  }
  function hud() {
    const b = getBattle();
    if (!b) return;
    for (const selector of fields) {
      const element = content.querySelector(selector);
      if (element) element.disabled = true;
    }
    content.querySelector(".career-details")?.classList.add("hidden");
    content.querySelector(".rts-instructions")?.classList.add("hidden");
    content.querySelector(".campaign-save").textContent =
      "المواجهة تديرها الغرفة على الخادم؛ حفظ الحملة الفردية منفصل";
    content.querySelector(".battle-save-status").textContent =
      "غرفة " +
      connection.session.room.slice(0, 8) +
      " · لا يُحفظ هذا الوضع فوق معاركك الفردية";
    const wave = content.querySelector("[data-stat=wave]");
    wave.textContent = "مواجهة شخصين";
    wave.dataset.short = "عبر الويب";
    actions.querySelector("[data-online=surrender]").disabled =
      b.status !== "playing" || connection.state?.phase === "waiting";
    actions.querySelector("[data-online=rematch]").disabled =
      b.status === "playing" ||
      !!connection.state?.players[connection.session.side].rematch;
    header.textContent = `${connection.state?.players.blue.name || "اللاعب الأول"} × ${connection.state?.players.red.name || "اللاعب الثاني"} · ${connection.latency === null ? "قياس الاتصال" : connection.latency + " ms"} · ${connection.session.side === "blue" ? "مقرك في اليسار" : "مقرك في اليمين"} · ${connection.status}`;
    if (connection.socket?.readyState !== WebSocket.OPEN) b.paused = true;
    if (b.status === "playing" && b.paused) {
      const result = content.querySelector(".rts-result");
      result.classList.remove("hidden");
      result.textContent = connection.status;
    }
  }
  function status() {
    hud();
  }
  connection.addEventListener("state", load);
  connection.addEventListener("ack", ack);
  connection.addEventListener("status", status);
  load();
  hud();
  return {
    hud,
    request,
    frame(time) {
      const b = getBattle();
      if (!b) return;
      const t = Math.min(1, (time - received) / 200);
      if (!b.paused) {
        const elapsed = Math.min(0.25, (time - received) / 1000);
        for (const s of b.shells) s.visualRemaining ??= s.remaining;
        for (const s of b.shells)
          s.remaining = Math.max(0, s.visualRemaining - elapsed);
        b.time = baseTime + Math.min(0.25, (time - received) / 1000);
        for (const e of b.entities) {
          e.x = e.fromX + (e.toX - e.fromX) * t;
          e.y = e.fromY + (e.toY - e.fromY) * t;
        }
      }
    },
    close() {
      closed = true;
      connection.removeEventListener("state", load);
      connection.removeEventListener("ack", ack);
      connection.removeEventListener("status", status);
      connection.release();
    },
  };
}

import {
  FORMATIONS,
  relocateHQ,
  suggestedHQDestination,
  saveGroup,
  selectGroup,
} from "./tactics.js";
import {
  CAREER_KEY,
  OPERATIONS,
  UPGRADE_NAMES,
  loadCareer,
  nextOperation,
  awardOperation,
  buyUpgrade,
} from "./career.js";
import "./upgrade.css";
export function setupCommandCenter(
  content,
  { getBattle, start, storage, refresh, arm },
) {
  const panel = document.createElement("section");
  panel.className = "command-center";
  panel.innerHTML = `<h3>مركز القيادة المتنقل</h3><p class="hq-status" role="status"></p><div class="command-pair"><button data-tactic="relocate">نقل القيادة: اختر موقعًا</button><button data-tactic="suggest-hq">نقل إلى موضع مقترح</button></div><button data-tactic="rally">نقل نقطة تجمع الجيش</button><details class="tactical-details"><summary>التشكيلات والأوامر والمجموعات</summary><label>تشكيل الجيش<select aria-label="تشكيل الجيش">${Object.entries(
    FORMATIONS,
  )
    .map(([k, v]) => `<option value="${k}">${v}</option>`)
    .join("")}</select></label><div class="tactic-modes">${[
    ["move", "تحرك"],
    ["patrol", "دورية"],
    ["guard", "حماية هدف"],
  ]
    .map(([k, v]) => `<button data-order-mode="${k}">${v}</button>`)
    .join(
      "",
    )}</div><p>حدد الجيش ثم اختر الأمر وانقر الوجهة أو الهدف الصديق. الدورية تعود إلى نقطة الانطلاق تلقائيًا.</p><button data-tactic="depth">تبديل غوص الغواصات المحددة</button><div class="army-groups">${[1, 2, 3].map((i) => `<button data-group-save="${i}">حفظ ${i}</button><button data-group="${i}">مجموعة ${i}</button>`).join("")}</div><p>لوحة المفاتيح: Ctrl+1..3 حفظ مجموعة، 1..3 استدعاء، P دورية، G حماية، M تحرك، H نقل القيادة، Space إيقاف.</p></details><details class="career-details"><summary>الحملة والترقيات وتقارير المعارك</summary><p class="career-story"></p><button data-career="start">بدء / متابعة الحملة</button><p class="career-progress"></p><div class="career-upgrades">${Object.entries(
    UPGRADE_NAMES,
  )
    .map(([k, v]) => `<button data-upgrade="${k}">${v}</button>`)
    .join(
      "",
    )}</div><p class="battle-report"></p><div class="career-history"></div><p class="career-feedback" role="status"></p><p>قائمة المراحل العادية تدريب حر. ترقيات الحملة تنطبق عند بدء مهمتها التالية؛ كل انتصار جديد يمنح نقطة ترقية.</p></details>`;
  content.querySelector(".rts-panel").prepend(panel);
  const quality = document.createElement("label");
  quality.innerHTML =
    'جودة الرسومات <select aria-label="جودة الرسومات"><option value="auto">تلقائي</option><option value="low">اقتصادية للجوال</option><option value="medium">متوازنة</option><option value="high">عالية</option></select>';
  content.querySelector(".campaign-bar").append(quality);
  let career = loadCareer(storage);
  const awarded = new WeakSet();
  function feedback(text) {
    panel.querySelector(".career-feedback").textContent = text;
  }
  function persist(change) {
    try {
      const next = structuredClone(career);
      change(next);
      storage.setItem(CAREER_KEY, JSON.stringify(next));
      career = next;
      feedback("حُفظ تقدم الحملة على هذا الجهاز ✓");
      return true;
    } catch {
      feedback("تعذّر حفظ الحملة؛ التخزين ممتلئ أو غير متاح.");
      return false;
    }
  }
  function runOperation() {
    const op = nextOperation(career);
    if (op)
      start(op.stage, undefined, null, {
        operationId: op.id,
        mission: op.mission,
        upgrades: career.upgrades,
      });
  }
  panel.querySelector("[data-career=start]").onclick = runOperation;
  panel.querySelector("[data-tactic=relocate]").onclick = () => {
    arm("relocate");
    getBattle().message =
      "انقر الموقع الجديد أو استخدم النقل المقترح. سيجهّز المركز نفسه ثم يتحرك وينتشر.";
    if (
      matchMedia("(max-width:650px),(max-width:950px) and (max-height:500px)")
        .matches
    ) {
      content.querySelector(".rts-app").classList.remove("commands-open");
      content
        .querySelector("[data-game=commands]")
        .setAttribute("aria-expanded", "false");
    }
    refresh();
  };
  panel.querySelector("[data-tactic=rally]").onclick = () => {
    arm("rally");
    getBattle().message =
      "انقر موضع نقطة التجمع الجديدة؛ الوحدات التي تُدرّب لاحقًا تتجه إليها.";
    content.querySelector(".rts-app").classList.remove("commands-open");
    content
      .querySelector("[data-game=commands]")
      .setAttribute("aria-expanded", "false");
    refresh();
  };
  panel.querySelector("[data-tactic=suggest-hq]").onclick = () => {
    suggestedHQDestination(getBattle());
    arm(null);
    refresh();
  };
  panel.querySelector('[aria-label="تشكيل الجيش"]').onchange = (e) => {
    getBattle().formation = e.target.value;
  };
  panel.querySelectorAll("[data-order-mode]").forEach(
    (button) =>
      (button.onclick = () => {
        getBattle().commandMode = button.dataset.orderMode;
        arm(null);
        getBattle().message = "حدد الجيش ثم انقر الوجهة أو الهدف";
        refresh();
      }),
  );
  panel.querySelector("[data-tactic=depth]").onclick = () => {
    const b = getBattle();
    if (b.requestNetwork) {
      b.requestNetwork({ kind: "depth" });
      return;
    }
    let count = 0;
    for (const e of b.entities)
      if (e.type === "submarine" && b.selected.has(e.id)) {
        e.depthTarget = (e.depthTarget ?? 1) > 0.5 ? 0 : 1;
        count++;
      }
    b.message = count
      ? "تغيير عمق الغواصات؛ يتغير انكشافها لأسلحة السطح"
      : "حدّد غواصات أولًا";
    refresh();
  };
  for (const button of panel.querySelectorAll("[data-group-save]"))
    button.onclick = () => {
      saveGroup(getBattle(), button.dataset.groupSave);
      refresh();
    };
  for (const button of panel.querySelectorAll("[data-group]"))
    button.onclick = () => {
      selectGroup(getBattle(), button.dataset.group);
      refresh();
    };
  for (const button of panel.querySelectorAll("[data-upgrade]"))
    button.onclick = () => {
      persist((next) => {
        if (!buyUpgrade(next, button.dataset.upgrade)) throw Error();
      });
      update();
    };
  const modes = {
    deployed: "منتشر وجاهز",
    packing: "تجهيز للنقل",
    moving: "يتحرك؛ الإنتاج متوقف",
    deploying: "ينتشر في الموقع الجديد",
  };
  function update() {
    const b = getBattle();
    if (!b) return;
    const hq = b.entities.find((e) => e.type === "hq" && e.team === "blue");
    panel.querySelector(".hq-status").textContent = hq
      ? `${modes[hq.hqMode] || modes.deployed} · ${Math.round(hq.x)}, ${Math.round(hq.y)}`
      : "مركز القيادة مفقود";
    for (const button of panel.querySelectorAll(
      "[data-tactic=relocate],[data-tactic=suggest-hq]",
    ))
      button.disabled =
        b.paused || b.status !== "playing" || !hq || hq.hqMode !== "deployed";
    panel.querySelector('[aria-label="تشكيل الجيش"]').value = b.formation;
    for (const button of panel.querySelectorAll("[data-order-mode]"))
      button.setAttribute(
        "aria-pressed",
        String(b.commandMode === button.dataset.orderMode),
      );
    if (b.status === "won" && b.operationId && !awarded.has(b)) {
      awarded.add(b);
      persist((next) => awardOperation(next, b));
      window.dispatchEvent(
        new CustomEvent("myos:notice", {
          detail: { text: "اكتملت مهمة في الحملة. راجع التقرير والترقيات." },
        }),
      );
    }
    const history = panel.querySelector(".career-history");
    history.replaceChildren();
    for (const report of career.reports || []) {
      const p = document.createElement("p");
      p.textContent = `${OPERATIONS.find((o) => o.id === report.id)?.title || "تقرير"} · ${report.time} ث · أهداف ${report.kills} · خسائر ${report.losses}`;
      history.append(p);
    }
    const op = nextOperation(career);
    panel.querySelector(".career-story").textContent = op
      ? `${career.completed.length + 1}/8 · ${op.title}: ${op.story}`
      : "أتممت الحملة. يمكن إعادة تجربة الخرائط في التدريب الحر.";
    panel.querySelector(".career-progress").textContent =
      `خبرة: ${career.xp} · نقاط ترقية: ${career.points} · عمليات مكتملة: ${career.completed.length}/8`;
    panel.querySelector("[data-career=start]").disabled = !op;
    for (const button of panel.querySelectorAll("[data-upgrade]")) {
      const key = button.dataset.upgrade;
      button.textContent = `${UPGRADE_NAMES[key]} ${career.upgrades[key]}/3`;
      button.disabled = career.points < 1 || career.upgrades[key] >= 3;
    }
    panel.querySelector(".battle-report").textContent =
      `المعركة الحالية: إصابات ${b.stats.shots} · أهداف مدمرة ${b.stats.kills} · خسائر ${b.stats.losses} · ${Math.floor(b.time)} ث`;
  }
  return {
    restart() {
      const b = getBattle();
      start(b.stageIndex, b.map.id, null, {
        operationId: b.operationId,
        mission: b.mission.id,
        upgrades: career.upgrades,
      });
    },
    refresh: update,
    point(x, y) {
      return relocateHQ(getBattle(), x, y);
    },
    advance: runOperation,
    key(event) {
      if (
        event.altKey ||
        event.metaKey ||
        event.target.closest("input,select,textarea,[contenteditable]")
      )
        return false;
      const b = getBattle();
      if (["1", "2", "3"].includes(event.key)) {
        event.preventDefault();
        if (event.ctrlKey) saveGroup(b, event.key);
        else selectGroup(b, event.key);
      } else if (
        !event.ctrlKey &&
        ["p", "g", "m", "h"].includes(event.key.toLowerCase())
      ) {
        const key = event.key.toLowerCase();
        if (key === "h") panel.querySelector("[data-tactic=relocate]").click();
        else b.commandMode = { p: "patrol", g: "guard", m: "move" }[key];
      } else if (event.code === "Space") {
        event.preventDefault();
        content.querySelector("[data-game=pause]").click();
      } else return false;
      refresh();
      return true;
    },
  };
}

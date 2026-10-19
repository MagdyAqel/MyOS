import { COMPACT_QUERY } from "./mobile.js";
import { SECONDARY_GOALS } from "./career.js";
import { advancedOrder, selectInRectangle } from "./battle-expansion.js";
export class PerformanceGovernor {
  constructor() {
    this.samples = [];
    this.since = 0;
    this.quality = "medium";
  }
  sample(milliseconds, now) {
    if (milliseconds > 0 && milliseconds < 250) this.samples.push(milliseconds);
    if (this.samples.length > 180) this.samples.shift();
    if (now - this.since < 8000 || this.samples.length < 90) return null;
    this.since = now;
    const mean = this.samples.reduce((a, b) => a + b, 0) / this.samples.length;
    const next = mean > 30 ? "low" : mean < 19 ? "medium" : this.quality;
    this.samples = [];
    if (next === this.quality) return null;
    return (this.quality = next);
  }
}
export function setupBattleOptions(
  content,
  { getBattle, start, refresh, audio, storage, onPerformanceChange },
) {
  const button = document.createElement("button");
  button.textContent = "إعداد معركة جديدة";
  button.dataset.game = "configure";
  const compact = matchMedia(COMPACT_QUERY);
  const positionButton = () =>
    content
      .querySelector(compact.matches ? ".campaign-bar" : ".rts-header")
      .append(button);
  positionButton();
  compact.addEventListener("change", positionButton);
  const dialog = document.createElement("dialog");
  dialog.className = "battle-setup";
  dialog.innerHTML = `<form method="dialog"><h2>قبل بدء المعركة</h2><p class="briefing-story"></p><p class="briefing-goals"></p><label>المال لكل جيش عند البداية<input name="cash" aria-label="المال قبل بدء المعركة" type="number" min="1000" max="100000" step="100" value="2400" required></label><p>من 1,000 إلى 100,000. يطبق المبلغ عند بدء معركة جديدة.</p><button value="start">بدء المعركة</button><button value="cancel" formnovalidate>إلغاء</button></form>`;
  content.append(dialog);
  let launch;
  function briefing(run) {
    const b = getBattle();
    dialog.querySelector(".briefing-story").textContent =
      run?.story || `${b.stage.name}: ${b.mission.description}`;
    dialog.querySelector(".briefing-goals").textContent =
      `النجوم: إكمال المهمة ★ · ${SECONDARY_GOALS[run?.operationId || b.operationId]?.[0] || "إنهاؤها خلال 8 دقائق"} ★ · خسارة 3 وحدات أو أقل ★`;
    dialog.querySelector("input").value = b.startingCash || b.stage.cash;
    launch =
      run?.launch ||
      ((startingCash) =>
        start(b.stageIndex, b.map.id, null, {
          mission: b.mission.id,
          difficulty: b.difficulty,
          startingCash,
        }));
    dialog.showModal();
  }
  button.onclick = () => briefing();
  dialog.addEventListener("close", () => {
    if (dialog.returnValue === "start")
      launch?.(Number(dialog.querySelector("input").value));
  });
  const settings = document.createElement("details");
  settings.className = "battle-preferences";
  settings.innerHTML = `<summary>الصوت والأداء والتحكم</summary><label>المؤثرات <input aria-label="مستوى المؤثرات" type="range" min="0" max="100" value="85"></label><label>الأجواء والمحركات <input aria-label="مستوى الأجواء" type="range" min="0" max="100" value="40"></label><label>إخراج الصوت<select aria-label="إخراج الصوت"><option value="headphones">سماعات · صوت مجسم</option><option value="speakers">مكبرات · صوت متوازن</option></select></label><label><input type="checkbox" aria-label="توفير البطارية">توفير البطارية · رسم 30 إطارًا في الثانية</label><p>اسحب بالفأرة لتحديد الجنود والمعدات. Shift يضيف إلى التحديد. على الجوال اضغط مطولًا وحدة لإظهار أوامرها.</p><p class="performance-status" role="status"></p>`;
  content.querySelector(".rts-panel").append(settings);
  let preferences = {
    effects: 0.85,
    ambience: 0.4,
    profile: "headphones",
    battery: false,
  };
  try {
    const p = JSON.parse(storage.getItem("myos-battle-preferences-v1"));
    if (p) {
      for (const k of ["effects", "ambience"])
        if (Number.isFinite(p[k]))
          preferences[k] = Math.max(0, Math.min(1, p[k]));
      if (["headphones", "speakers"].includes(p.profile))
        preferences.profile = p.profile;
      preferences.battery = p.battery === true;
    }
  } catch {}
  const inputs = [...settings.querySelectorAll("input,select")];
  inputs[0].value = preferences.effects * 100;
  inputs[1].value = preferences.ambience * 100;
  inputs[2].value = preferences.profile;
  inputs[3].checked = preferences.battery;
  function apply() {
    audio.configure?.(preferences);
    onPerformanceChange?.(preferences.battery);
    try {
      storage.setItem(
        "myos-battle-preferences-v1",
        JSON.stringify(preferences),
      );
    } catch {}
  }
  inputs.forEach(
    (input, i) =>
      (input.oninput = () => {
        preferences[["effects", "ambience", "profile", "battery"][i]] =
          i < 2
            ? Number(input.value) / 100
            : i === 2
              ? input.value
              : input.checked;
        apply();
      }),
  );
  apply();
  const box = document.createElement("div");
  box.className = "selection-box";
  box.hidden = true;
  content.querySelector(".battlefield").append(box);
  const menu = document.createElement("div");
  menu.className = "touch-orders";
  menu.hidden = true;
  for (const [kind, label] of [
    ["hold", "ثبات"],
    ["retreat", "انسحاب"],
    ["attackMove", "تقدم هجومي"],
    ["close", "إغلاق"],
  ]) {
    const btn = document.createElement("button");
    btn.textContent = label;
    btn.onclick = () => {
      const b = getBattle();
      if (kind === "attackMove") b.commandMode = "attackMove";
      else if (kind !== "close") advancedOrder(b, { kind });
      menu.hidden = true;
      refresh();
    };
    menu.append(btn);
  }
  content.querySelector(".battlefield").append(menu);
  return {
    briefing,
    preferences,
    selectBox(rect, done, additive, project) {
      if (!rect) {
        box.hidden = true;
        return;
      }
      Object.assign(box.style, {
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        width: `${rect.right - rect.left}px`,
        height: `${rect.bottom - rect.top}px`,
      });
      box.hidden = done;
      if (done) {
        selectInRectangle(getBattle(), project, rect, additive);
        refresh();
      }
    },
    touchMenu() {
      menu.hidden = false;
    },
    performance(text) {
      settings.querySelector(".performance-status").textContent = text;
    },
    close() {
      compact.removeEventListener("change", positionButton);
      dialog.remove();
    },
  };
}

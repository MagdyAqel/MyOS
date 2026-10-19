import "./desktop-extras.css";
import {
  APPEARANCE_KEY,
  NOTICES_KEY,
  parseAppearance,
  parseNotices,
} from "./desktop-preferences.js";
export function applyAppearance() {
  let data = { accent: "#73bdff", iconSize: 32, textScale: 1 };
  try {
    const raw = localStorage.getItem(APPEARANCE_KEY);
    if (raw) data = parseAppearance(raw);
  } catch {}
  const root = document.documentElement;
  root.style.setProperty("--accent", data.accent);
  root.style.setProperty("--desktop-icon-size", data.iconSize + "px");
  root.style.setProperty("--desktop-text-scale", data.textScale);
  return data;
}
export function setupAppearance(content) {
  let value = applyAppearance();
  const section = document.createElement("section");
  section.className = "appearance-options";
  section.innerHTML = `<h3>الألوان والأيقونات</h3><label>لون التمييز<input type="color" aria-label="لون التمييز" value="${value.accent}"></label><label>حجم أيقونات سطح المكتب<input type="range" aria-label="حجم أيقونات سطح المكتب" min="28" max="52" value="${value.iconSize}"></label><label>حجم تسميات التطبيقات<input type="range" aria-label="حجم تسميات التطبيقات" min="90" max="115" value="${Math.round(value.textScale * 100)}"></label><button data-appearance="reset">استعادة أحجام العرض الأصلية</button><p class="appearance-status" role="status"></p><h3>اختصارات لوحة المفاتيح</h3><p>Ctrl+Alt+F الملفات · Ctrl+Alt+M المفكرة · Ctrl+Alt+G اللعبة · Ctrl+Alt+N الإشعارات · Ctrl+Alt+L القفل · Alt+السهمين ←/→ للتنقل بين النوافذ. Escape يغلق اللوحات.</p>`;
  content.querySelector(".settings-page").append(section);
  const inputs = section.querySelectorAll("input");
  const save = () => {
    value = {
      accent: inputs[0].value,
      iconSize: Number(inputs[1].value),
      textScale: Number(inputs[2].value) / 100,
    };
    try {
      localStorage.setItem(
        APPEARANCE_KEY,
        JSON.stringify(parseAppearance(value)),
      );
      applyAppearance();
      section.querySelector(".appearance-status").textContent =
        "حُفظت تفضيلات سطح المكتب ✓";
    } catch {
      section.querySelector(".appearance-status").textContent =
        "تعذّر حفظ تفضيلات العرض";
    }
  };
  inputs.forEach((i) => (i.oninput = save));
  section.querySelector("button").onclick = () => {
    inputs[0].value = "#73bdff";
    inputs[1].value = "32";
    inputs[2].value = "100";
    save();
  };
}
export function setupDesktopExtras({ openApp, windows, raise, lock }) {
  applyAppearance();
  let notices = [];
  try {
    const raw = localStorage.getItem(NOTICES_KEY);
    if (raw) notices = parseNotices(raw);
  } catch {}
  const panel = document.createElement("aside");
  panel.id = "notification-center";
  panel.className = "glass hidden";
  panel.setAttribute("aria-label", "مركز الإشعارات");
  panel.innerHTML =
    '<header><h2>الإشعارات</h2><button data-notice="clear">مسح الكل</button><button data-notice="close" aria-label="إغلاق الإشعارات">×</button></header><div class="notification-list"></div><p>إشعارات محلية داخل MyOS، دون إذن إشعارات الجهاز.</p>';
  document.querySelector("#desktop").append(panel);
  const button = document.createElement("button");
  button.id = "notifications-button";
  button.setAttribute("aria-label", "فتح مركز الإشعارات");
  button.setAttribute("aria-expanded", "false");
  button.textContent = "🔔";
  document.querySelector("#taskbar").append(button);
  function persist() {
    try {
      localStorage.setItem(NOTICES_KEY, JSON.stringify(notices));
    } catch {
      /* Notifications remain in memory without masking application save errors. */
    }
  }
  function render() {
    const list = panel.querySelector(".notification-list");
    list.replaceChildren();
    for (const notice of notices) {
      const item = document.createElement("article"),
        p = document.createElement("p"),
        time = document.createElement("small");
      p.textContent = notice.text;
      time.textContent = new Date(notice.time).toLocaleString("ar");
      item.append(p, time);
      list.append(item);
    }
    if (!notices.length) list.textContent = "لا توجد إشعارات جديدة";
    button.dataset.unread = String(notices.filter((n) => !n.read).length);
  }
  function toggle(force) {
    const visible = force ?? panel.classList.contains("hidden");
    panel.classList.toggle("hidden", !visible);
    button.setAttribute("aria-expanded", String(visible));
    if (visible) {
      notices.forEach((n) => (n.read = true));
      persist();
      render();
      document.querySelector("#quick").classList.add("hidden");
      document.querySelector("#start").classList.add("hidden");
    }
  }
  window.addEventListener("myos:preferences-restored", () => {
    applyAppearance();
    try {
      notices = parseNotices(localStorage.getItem(NOTICES_KEY) || "[]");
    } catch {
      notices = [];
    }
    render();
  });
  button.onclick = () => toggle();
  panel.querySelector("[data-notice=close]").onclick = () => toggle(false);
  panel.querySelector("[data-notice=clear]").onclick = () => {
    notices = [];
    persist();
    render();
  };
  window.addEventListener("myos:notice", (event) => {
    const text = event.detail?.text;
    if (typeof text !== "string" || !text.trim()) return;
    notices = [
      {
        text: text.slice(0, 500),
        time: Date.now(),
        read: !panel.classList.contains("hidden"),
      },
      ...notices,
    ].slice(0, 40);
    persist();
    render();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      toggle(false);
      return;
    }
    if (event.altKey && ["ArrowRight", "ArrowLeft"].includes(event.key)) {
      event.preventDefault();
      const opened = [...windows.values()].filter((w) => w.isConnected);
      if (!opened.length) return;
      const top = opened.reduce((a, b) =>
        Number(a.style.zIndex) > Number(b.style.zIndex) ? a : b,
      );
      const target =
        opened[
          (opened.indexOf(top) +
            (event.key === "ArrowLeft" ? -1 : 1) +
            opened.length) %
            opened.length
        ];
      target.classList.remove("hidden");
      raise(target);
      return;
    }
    if (!event.ctrlKey || !event.altKey || event.metaKey) return;
    const key = event.key.toLowerCase();
    if (!["f", "m", "g", "n", "l"].includes(key)) return;
    event.preventDefault();
    if (key === "n") toggle();
    else if (key === "l") lock();
    else openApp({ f: "files", m: "notes", g: "strategy" }[key]);
  });
  render();
}

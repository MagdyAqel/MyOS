import "./cloud.css";
let promptEvent = null,
  registration = null,
  offlineReady = false,
  waiting = null,
  reloading = false;
const changes = new EventTarget();
const notify = () => changes.dispatchEvent(new Event("change"));
export function setupPWA() {
  if (!import.meta.env.PROD || !("serviceWorker" in navigator)) return;
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    promptEvent = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    promptEvent = null;
    notify();
  });
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  if (navigator.serviceWorker.controller) offlineReady = true;
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (reloading) location.reload();
  });
  const url = new URL(`${import.meta.env.BASE_URL}sw.js`, document.baseURI);
  navigator.serviceWorker
    .register(url)
    .then((reg) => {
      registration = reg;
      waiting = reg.waiting;
      notify();
      reg.addEventListener("updatefound", () => {
        const worker = reg.installing;
        worker?.addEventListener("statechange", () => {
          if (worker.state === "installed") {
            setTimeout(() => {
              waiting = reg.waiting;
              notify();
            }, 0);
          }
        });
      });
      return navigator.serviceWorker.ready;
    })
    .then(() => {
      offlineReady = true;
      notify();
    })
    .catch(() => {
      offlineReady = Boolean(navigator.serviceWorker.controller);
      notify();
    });
}
export function setupInstall(content) {
  content.innerHTML = `<div class="cloud-page"><span class="eyebrow">MYOS · INSTALL & OFFLINE</span><h2>MyOS على شاشتك الرئيسية</h2><p>ثبّت التطبيق لفتحه كنافذة مستقلة. بعد اكتمال التحضير تتوفر الملاحظات والملفات واللعبة والخرائط محليًا دون إنترنت. المواقع الخارجية والمزامنة السحابية تحتاج اتصالًا.</p><p class="pwa-status" role="status"></p><button data-pwa="install">تثبيت التطبيق</button><button data-pwa="update" hidden>تطبيق التحديث المتاح</button><div class="pwa-help"><h3>التثبيت اليدوي</h3><p>على Android افتح قائمة المتصفح واختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية». على iPhone وiPad افتح الموقع في Safari، ثم «مشاركة» ← «إضافة إلى الشاشة الرئيسية».</p><p>افتح الموقع متصلًا وانتظر رسالة جاهزية العمل دون إنترنت قبل الاعتماد عليه أثناء انقطاع الشبكة. البيانات تبقى على هذا المتصفح؛ احتفظ بنسخ خارجية للملفات المهمة.</p></div><p class="pwa-feedback" role="status"></p></div>`;
  const status = content.querySelector(".pwa-status"),
    button = content.querySelector('[data-pwa="install"]'),
    update = content.querySelector('[data-pwa="update"]');
  const render = () => {
    status.textContent = offlineReady
      ? navigator.onLine
        ? "المحتوى المحلي جاهز للعمل دون إنترنت ✓"
        : "تعمل الآن دون إنترنت؛ المحتوى المحلي جاهز ✓"
      : !import.meta.env.PROD
        ? "التحضير دون إنترنت يتوفر في نسخة النشر."
        : "جارٍ تحضير المحتوى المحلي. انتظر الجاهزية وأنت متصل.";
    button.textContent = matchMedia("(display-mode: standalone)").matches
      ? "التطبيق مفتوح بوضع مستقل"
      : promptEvent
        ? "تثبيت التطبيق"
        : "عرض خطوات التثبيت";
    update.hidden = !waiting;
  };
  button.onclick = async () => {
    if (promptEvent) {
      const event = promptEvent;
      promptEvent = null;
      await event.prompt();
      const answer = await event.userChoice;
      content.querySelector(".pwa-feedback").textContent =
        answer.outcome === "accepted"
          ? "تم قبول طلب التثبيت من المتصفح."
          : "أُلغي طلب التثبيت؛ يمكنك المحاولة لاحقًا.";
    } else {
      content
        .querySelector(".pwa-help")
        .scrollIntoView({ block: "nearest", behavior: "smooth" });
      content.querySelector(".pwa-feedback").textContent =
        "اتبع خطوات المتصفح أعلاه؛ لا يمكن للموقع فرض التثبيت على الجهاز.";
    }
    render();
  };
  update.onclick = () => {
    if (waiting) {
      reloading = true;
      waiting.postMessage({ type: "SKIP_WAITING" });
    }
  };
  changes.addEventListener("change", render);
  render();
  return () => changes.removeEventListener("change", render);
}

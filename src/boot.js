import "./experience.css";

export const DEVELOPER = "Develped by:Pro. Magdy S. Aqel";
export function bootDesktop() {
  const desktop = document.querySelector("#app");
  desktop.inert = true;
  const overlay = document.createElement("section");
  overlay.id = "boot-screen";
  overlay.setAttribute("aria-label", "بدء تشغيل MyOS");
  overlay.innerHTML = `<div class="boot-center"><div class="boot-logo" aria-hidden="true"><i></i><i></i><i></i><i></i></div><h1>MyOS <span>11</span></h1><div class="boot-spinner" aria-hidden="true"></div><p class="boot-status" role="status">جارٍ بدء التشغيل</p></div><footer><p dir="ltr">${DEVELOPER}</p><button id="skip-boot">الدخول الآن</button><small>محاكاة تفاعلية لسطح مكتب داخل المتصفح</small></footer>`;
  document.body.append(overlay);
  let finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    clearTimeout(welcomeTimer);
    clearTimeout(finishTimer);
    desktop.inert = false;
    overlay.remove();
    document.querySelector("#start-button").focus({ preventScroll: true });
  }
  const welcomeTimer = setTimeout(() => {
    overlay.classList.add("boot-welcome");
    overlay.querySelector(".boot-status").textContent =
      "مرحبًا بك، جارٍ إعداد سطح المكتب";
  }, 1400);
  const finishTimer = setTimeout(finish, 2800);
  overlay.querySelector("button").onclick = finish;
}

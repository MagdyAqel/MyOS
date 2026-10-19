import "./wallpapers.css";
export const WALLPAPERS = [
  { id: "blue", name: "الأزرق الأصلي" },
  { id: "purple", name: "البنفسجي الأصلي" },
  { id: "green", name: "الأخضر الأصلي" },
  { id: "alpine", name: "ليلة في الجبال", file: "alpine.svg" },
  { id: "coast", name: "شاطئ هادئ", file: "coast.svg" },
  { id: "dunes", name: "كثبان الغروب", file: "dunes.svg" },
];
// Public URLs are relative to Vite's configured deployment base.
const source = (wall) => `${import.meta.env.BASE_URL}wallpapers/${wall.file}`;
function imageStore(mode, action) {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("myos-personalization", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("images");
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      const db = request.result,
        tx = db.transaction("images", mode);
      let result;
      try {
        const req = action(tx.objectStore("images"));
        req.onsuccess = () => (result = req.result);
      } catch (error) {
        db.close();
        reject(error);
        return;
      }
      tx.oncomplete = () => {
        db.close();
        resolve(result);
      };
      tx.onerror = () => {
        db.close();
        reject(tx.error);
      };
      tx.onabort = () => {
        db.close();
        reject(tx.error || Error("Storage aborted"));
      };
    };
  });
}
export function createWallpaperManager() {
  let url = null,
    revision = 0;
  const status = new EventTarget();
  const read = () => {
    try {
      return localStorage.getItem("myos-wallpaper") || "blue";
    } catch {
      return "blue";
    }
  };
  function apply(id, image) {
    const desktop = document.querySelector("#desktop");
    document.documentElement.dataset.wallpaper = id;
    document.documentElement.toggleAttribute(
      "data-wallpaper-image",
      Boolean(image),
    );
    if (image)
      desktop.style.setProperty(
        "--desktop-image",
        `url(${JSON.stringify(image)})`,
      );
    else desktop.style.removeProperty("--desktop-image");
    status.dispatchEvent(new Event("change"));
  }
  async function restore() {
    const request = ++revision,
      id = read(),
      wall = WALLPAPERS.find((w) => w.id === id);
    if (wall) {
      apply(id, wall.file ? source(wall) : null);
      return;
    }
    if (id === "custom") {
      try {
        const blob = await imageStore("readonly", (store) =>
          store.get("custom"),
        );
        if (request !== revision) return;
        if (blob instanceof Blob) {
          if (url) URL.revokeObjectURL(url);
          url = URL.createObjectURL(blob);
          apply("custom", url);
          return;
        }
      } catch {
        /* Fall back without claiming the photo was restored. */
      }
    }
    if (request === revision) apply("blue", null);
  }
  async function choose(id) {
    const wall = WALLPAPERS.find((w) => w.id === id);
    if (!wall) throw Error("خلفية غير معروفة");
    revision++;
    localStorage.setItem("myos-wallpaper", id);
    apply(id, wall.file ? source(wall) : null);
  }
  async function upload(file) {
    const operation = ++revision;
    if (!file || !["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw Error("اختر صورة PNG أو JPG أو WebP.");
    if (file.size > 12 * 1024 * 1024)
      throw Error("حجم الصورة يجب ألا يتجاوز 12 ميغابايت.");
    let image;
    try {
      image = await createImageBitmap(file);
    } catch {
      throw Error("تعذّر قراءة الصورة. جرّب ملفًا آخر.");
    }
    if (image.width > 16000 || image.height > 16000) {
      image.close();
      throw Error("أبعاد الصورة كبيرة جدًا.");
    }
    const scale = Math.min(1, 2048 / Math.max(image.width, image.height)),
      canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#10233b";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
    image.close();
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.87),
    );
    if (!blob) throw Error("تعذّر تجهيز الصورة.");
    if (operation !== revision) return false;
    try {
      await imageStore("readwrite", (store) => store.put(blob, "custom"));
      if (operation !== revision) return false;
      localStorage.setItem("myos-wallpaper", "custom");
    } catch {
      throw Error("تعذّر حفظ الصورة. قد يكون التخزين ممتلئًا أو غير متاح.");
    }
    revision++;
    if (url) URL.revokeObjectURL(url);
    url = URL.createObjectURL(blob);
    apply("custom", url);
    return true;
  }
  restore();
  window.addEventListener("storage", (event) => {
    if (event.key === "myos-wallpaper") restore();
  });
  return { choose, upload, status };
}
export function setupPersonalization(content, manager, setTheme) {
  content.innerHTML = `<div class="settings-page"><span class="eyebrow">MAKE IT YOURS</span><h2>مساحة تشبهك</h2><h3>المظهر</h3><div class="theme-options"><button data-theme="dark">🌙 ليلي</button><button data-theme="light">☀ نهاري</button></div><h3>صور سطح المكتب</h3><div class="wallpaper-gallery">${WALLPAPERS.map((w) => `<button data-wall="${w.id}" aria-label="${{ blue: "خلفية زرقاء", purple: "خلفية بنفسجية", green: "خلفية خضراء" }[w.id] || w.name}"><span class="wallpaper-thumb ${w.id}" ${w.file ? `style="background-image:url('${source(w)}')"` : ""}></span><span>${w.name}</span></button>`).join("")}</div><label class="wallpaper-upload">＋ اختر صورة من جهازك<input type="file" accept="image/png,image/jpeg,image/webp" aria-label="رفع صورة خلفية"></label><p class="wallpaper-status" role="status">تُحفظ الخلفية على هذا المتصفح. الصور الشخصية لا تُرفع إلى خادم.</p><p class="muted">PNG / JPG / WebP · حتى 12 ميغابايت · تُحفظ صورة شخصية واحدة، واستبدالها يغيّر النسخة السابقة.</p></div>`;
  const feedback = content.querySelector(".wallpaper-status");
  const refresh = () =>
    content
      .querySelectorAll("[data-wall]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(document.documentElement.dataset.wallpaper === b.dataset.wall),
        ),
      );
  content
    .querySelectorAll("[data-theme]")
    .forEach((b) => (b.onclick = () => setTheme(b.dataset.theme)));
  content.querySelectorAll("[data-wall]").forEach(
    (b) =>
      (b.onclick = async () => {
        try {
          await manager.choose(b.dataset.wall);
          feedback.textContent = "تم حفظ الخلفية ✓";
        } catch {
          feedback.textContent = "تعذّر حفظ الاختيار في هذا المتصفح.";
        }
      }),
  );
  content.querySelector("input").onchange = async (event) => {
    const input = event.target;
    if (!input.files[0]) return;
    input.disabled = true;
    feedback.textContent = "جارٍ تجهيز الصورة وحفظها…";
    try {
      const applied = await manager.upload(input.files[0]);
      feedback.textContent = applied
        ? "تم حفظ صورتك كخلفية ✓"
        : "تم الاحتفاظ باختيار الخلفية الأحدث";
    } catch (error) {
      feedback.textContent = error.message;
    } finally {
      input.disabled = false;
      input.value = "";
    }
  };
  manager.status.addEventListener("change", refresh);
  refresh();
  return () => manager.status.removeEventListener("change", refresh);
}

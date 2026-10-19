import { saveMedia, readMedia, mediaFile } from "./media-store.js";
export function setupMedia(content, { target = null } = {}) {
  content.innerHTML = `<div class="media-app"><header><h2>عارض الصور والوسائط وPDF</h2><label class="media-picker">اختر ملفًا من جهازك<input type="file" accept="image/png,image/jpeg,image/webp,image/gif,application/pdf,audio/*,video/*" aria-label="فتح صورة أو ملف وسائط أو PDF"></label><p>تُعرض الملفات محليًا دون رفعها. احفظ نسخة في «ملفاتي» لفتحها لاحقًا؛ حد الملف المحفوظ 12 ميغابايت والمكتبة 18 ميغابايت.</p></header><button data-save-media disabled>حفظ نسخة في ملفاتي</button><nav class="media-tools"><button data-media="zoom-in">تكبير الصورة</button><button data-media="zoom-out">تصغير الصورة</button><button data-media="rotate">تدوير الصورة</button><button data-media="fit">ملاءمة</button><a class="media-open hidden" target="_blank" rel="noopener noreferrer">فتح الملف في تبويب مستقل</a></nav><section class="media-stage"><p>صور · PDF · صوت · فيديو</p></section><p class="media-status" role="status"></p></div>`;
  const stage = content.querySelector(".media-stage"),
    status = content.querySelector(".media-status"),
    link = content.querySelector(".media-open");
  let currentFile = null;
  let url = null,
    closed = false,
    rotation = 0,
    scale = 1,
    kind = "",
    revision = 0;
  function release() {
    stage.querySelectorAll("audio,video").forEach((e) => {
      e.pause();
      e.removeAttribute("src");
      e.load();
    });
    stage.replaceChildren();
    if (url) URL.revokeObjectURL(url);
    url = null;
  }
  function transform() {
    const image = stage.querySelector("img");
    if (image) image.style.transform = `rotate(${rotation}deg) scale(${scale})`;
  }
  function controls() {
    for (const b of content.querySelectorAll("[data-media]"))
      b.disabled = kind !== "image";
  }
  async function showFile(file) {
    if (!file) return;
    const request = ++revision;
    try {
      if (file.size > 100 * 1024 * 1024)
        throw Error("الحد الأقصى 100 ميغابايت");
      const header = new Uint8Array(await file.slice(0, 16).arrayBuffer());
      if (closed || request !== revision) return;
      const isPDF = String.fromCharCode(...header.slice(0, 5)) === "%PDF-",
        isImage = /^image\/(png|jpeg|webp|gif)$/.test(file.type);
      kind = isPDF
        ? "pdf"
        : isImage
          ? "image"
          : file.type.startsWith("audio/")
            ? "audio"
            : file.type.startsWith("video/")
              ? "video"
              : "";
      if (!kind)
        throw Error(
          "اختر صورة PNG/JPG/WebP/GIF أو PDF أو صوتًا أو فيديو مدعومًا",
        );
      release();
      currentFile = file;
      content.querySelector("[data-save-media]").disabled = false;
      url = URL.createObjectURL(
        new Blob([file], {
          type: kind === "pdf" ? "application/pdf" : file.type,
        }),
      );
      rotation = 0;
      scale = 1;
      link.href = url;
      link.classList.remove("hidden");
      let el;
      if (kind === "image") {
        el = document.createElement("img");
        el.alt = file.name;
        el.onload = () =>
          (status.textContent = `${file.name} · ${el.naturalWidth} × ${el.naturalHeight}`);
        el.onerror = () =>
          (status.textContent = "تعذّر قراءة الصورة؛ جرّب ملفًا صالحًا آخر.");
        el.src = url;
      } else if (kind === "pdf") {
        el = document.createElement("object");
        el.type = "application/pdf";
        el.data = url;
        el.setAttribute("aria-label", "مستند PDF");
        el.textContent =
          "استخدم فتح الملف في تبويب مستقل إذا لم يدعم المتصفح عرض PDF هنا.";
      } else {
        el = document.createElement(kind);
        el.controls = true;
        el.preload = "metadata";
        el.src = url;
        el.onloadedmetadata = () =>
          (status.textContent = `${file.name} · المدة ${Number.isFinite(el.duration) ? Math.round(el.duration) + " ث" : "غير محددة"}`);
        el.onerror = () =>
          (status.textContent =
            "ترميز الملف غير مدعوم في هذا المتصفح؛ جرّب MP3 أو MP4/H.264.");
      }
      stage.append(el);
      status.textContent =
        file.name +
        (kind === "pdf"
          ? " · PDF؛ استخدم الفتح المستقل إذا لم يظهر العرض."
          : "");
      controls();
    } catch (error) {
      status.textContent = error.message;
    }
  }
  content.querySelector("[type=file]").onchange = async (event) => {
    await showFile(event.target.files[0]);
    event.target.value = "";
  };
  content.querySelector("[data-save-media]").onclick = async () => {
    if (!currentFile) return;
    try {
      await saveMedia(currentFile);
      status.textContent =
        "حُفظ الملف في ملفاتي ويظل متاحًا بعد إعادة فتح MyOS ✓";
    } catch (error) {
      status.textContent = error.message;
    }
  };
  async function openSaved(event) {
    try {
      const record = await readMedia(event.detail.id);
      if (!closed && record && !record.deleted)
        await showFile(mediaFile(record));
    } catch (error) {
      status.textContent = error.message;
    }
  }
  content.addEventListener("myos:open-item", openSaved);
  if (target) openSaved({ detail: target });
  for (const b of content.querySelectorAll("[data-media]"))
    b.onclick = () => {
      if (b.dataset.media === "rotate") rotation = (rotation + 90) % 360;
      else if (b.dataset.media === "fit") {
        rotation = 0;
        scale = 1;
      } else
        scale = Math.max(
          0.25,
          Math.min(4, scale * (b.dataset.media === "zoom-in" ? 1.2 : 1 / 1.2)),
        );
      transform();
    };
  controls();
  return () => {
    closed = true;
    content.removeEventListener("myos:open-item", openSaved);
    revision++;
    release();
  };
}

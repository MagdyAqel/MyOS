import {
  collectBackup,
  validateBackup,
  backupSummary,
  writeBackupDatasets,
} from "./backup-data.js";
import { readWallpaper, writeWallpaper } from "./wallpaper-storage.js";
import "./cloud.css";
async function encodeImage(blob) {
  if (!blob) return null;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(Error("تعذّر قراءة الخلفية"));
    reader.onload = () =>
      resolve({ type: blob.type, base64: reader.result.split(",")[1] });
    reader.readAsDataURL(blob);
  });
}
async function decodeImage(wall) {
  if (!wall) return null;
  const bytes = Uint8Array.from(atob(wall.base64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: wall.type });
  let bitmap;
  try {
    bitmap = await createImageBitmap(blob);
    if (bitmap.width > 4096 || bitmap.height > 4096) throw Error();
  } catch {
    throw Error("تعذّر قراءة خلفية النسخة أو أبعادها كبيرة");
  } finally {
    bitmap?.close();
  }
  return blob;
}
const capture = async () => {
  window.dispatchEvent(new Event("myos:flush-data"));
  return collectBackup(localStorage, await encodeImage(await readWallpaper()));
};
function download(snapshot, name) {
  const url = URL.createObjectURL(
      new Blob([JSON.stringify(snapshot)], { type: "application/json" }),
    ),
    a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function setupBackup(content) {
  content.innerHTML = `<div class="cloud-page backup-page"><span class="eyebrow">MYOS · LOCAL BACKUP</span><h2>بياناتك في ملف واحد</h2><p>الملاحظات والملفات والمستندات وحفظ المعارك والحملة والتفضيلات والخلفية الشخصية. يمكنك نقلها إلى جهاز آخر دون حساب أو خدمة سحابية. لا تُضمّن جلسات الدخول أو كلمات المرور أو إعداد ربط السحابة، ولا الملفات التي فتحتها مؤقتًا في عارض الوسائط.</p><button data-backup="export">تنزيل نسخة احتياطية كاملة</button><label>اختر نسخة للاستعادة<input type="file" accept="application/json,.json" aria-label="اختيار نسخة احتياطية"></label><p class="backup-summary"></p><section class="backup-review hidden"><p>ستستبدل بيانات هذا المتصفح ببيانات النسخة، وتُغلق التطبيقات الأخرى. نزّل النسخة الحالية أولًا إذا أردت الاحتفاظ بها.</p><button data-backup="confirm">تأكيد استعادة النسخة</button><button data-backup="cancel">إلغاء</button></section><button data-backup="undo" disabled>تراجع عن الاستعادة في هذه الجلسة</button><button data-backup="reload" class="hidden">إعادة فتح MyOS لتطبيق التفضيلات</button><p class="backup-status" role="status">ملفات النسخ تحتوي بياناتك؛ احتفظ بها في مكان خاص بك.</p></div>`;
  const status = content.querySelector(".backup-status"),
    review = content.querySelector(".backup-review"),
    input = content.querySelector("[type=file]");
  let pending = null,
    previous = null,
    busy = false,
    closed = false;
  const tell = (text) => {
    if (!closed) status.textContent = text;
  };
  const lock = (value) => {
    busy = value;
    for (const b of content.querySelectorAll("button")) b.disabled = value;
    content.querySelector("[data-backup=undo]").disabled = value || !previous;
    input.disabled = value;
  };
  content.querySelector("[data-backup=export]").onclick = async () => {
    if (busy) return;
    lock(true);
    try {
      const snapshot = await capture();
      if (closed) return;
      download(
        snapshot,
        "MyOS-backup-" + new Date().toISOString().slice(0, 10) + ".json",
      );
      tell("جُهّز ملف النسخة الكاملة للتنزيل ✓");
    } catch (error) {
      tell("تعذّر إنشاء نسخة كاملة: " + error.message);
    } finally {
      lock(false);
    }
  };
  input.onchange = async () => {
    const file = input.files[0];
    if (!file || busy) return;
    lock(true);
    try {
      if (file.size > 32000000) throw Error("الحد الأقصى للنسخة 32 ميغابايت");
      const data = validateBackup(await file.text());
      await decodeImage(data.wallpaper);
      if (closed) return;
      pending = data;
      const n = backupSummary(data);
      content.querySelector(".backup-summary").textContent =
        `معاينة: ${n.notes} ملاحظات · ${n.files} عناصر ملفات · ${n.documents} مستندات · ${n.battles} حفظ معارك · ${n.operations} عمليات حملة · ${data.wallpaper ? "مع خلفية شخصية" : "خلفية مرفقة غير موجودة"}`;
      review.classList.remove("hidden");
      tell("النسخة صالحة. راجع التفاصيل ثم أكد الاستعادة.");
    } catch (error) {
      pending = null;
      review.classList.add("hidden");
      tell(error.message);
    } finally {
      input.value = "";
      lock(false);
    }
  };
  async function apply(data) {
    const blob = await decodeImage(data.wallpaper);
    window.dispatchEvent(new Event("myos:before-data-restore"));
    previous = await capture();
    try {
      await writeWallpaper(blob);
      writeBackupDatasets(localStorage, data.datasets);
      window.dispatchEvent(new Event("myos:preferences-restored"));
    } catch (error) {
      try {
        await writeWallpaper(await decodeImage(previous.wallpaper));
        writeBackupDatasets(localStorage, previous.datasets);
        window.dispatchEvent(new Event("myos:preferences-restored"));
      } catch {
        download(previous, "MyOS-recovery-before-restore.json");
        throw Error(
          "تعذّر إتمام الاستعادة والتراجع. نُزّلت بيانات ما قبل العملية للاسترداد.",
        );
      }
      throw Error("تعذّرت الاستعادة؛ أُعيدت بياناتك السابقة.");
    }
  }
  content.querySelector("[data-backup=confirm]").onclick = async () => {
    if (!pending || busy) return;
    lock(true);
    try {
      await apply(pending);
      pending = null;
      review.classList.add("hidden");
      content.querySelector("[data-backup=reload]").classList.remove("hidden");
      tell("تمت استعادة البيانات ✓ يمكنك التراجع ما دامت هذه النافذة مفتوحة.");
      window.dispatchEvent(
        new CustomEvent("myos:notice", {
          detail: {
            text: "استُعيدت نسخة احتياطية محلية. أعد فتح MyOS لتطبيق التفضيلات.",
          },
        }),
      );
    } catch (error) {
      tell(error.message);
    } finally {
      lock(false);
    }
  };
  content.querySelector("[data-backup=cancel]").onclick = () => {
    pending = null;
    review.classList.add("hidden");
    tell("أُلغيت الاستعادة دون تغيير البيانات.");
  };
  content.querySelector("[data-backup=undo]").onclick = async () => {
    if (!previous || busy) return;
    const target = previous;
    lock(true);
    try {
      await apply(target);
      previous = null;
      tell("أُعيدت بيانات ما قبل الاستعادة. أعد فتح MyOS.");
    } catch (error) {
      tell(error.message);
    } finally {
      lock(false);
    }
  };
  content.querySelector("[data-backup=reload]").onclick = () =>
    location.reload();
  return () => {
    closed = true;
  };
}

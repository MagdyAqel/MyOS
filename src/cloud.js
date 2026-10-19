import { CloudClient } from "./cloud-client.js";
import {
  exportSyncSnapshot,
  validateSyncSnapshot,
  snapshotSummary,
  applySyncSnapshot,
  undoSyncRestore,
} from "./sync-data.js";
import "./cloud.css";
export function setupCloud(content) {
  let client = null,
    remote = null,
    pending = null,
    closed = false,
    epoch = 0;
  const storage = localStorage;
  content.innerHTML = `<div class="cloud-page"><span class="eyebrow">MYOS CLOUD · OPTIONAL</span><h2>ملاحظاتك وتقدّمك بين أجهزتك</h2><p>المزامنة اختيارية وتحتاج مشروع Supabase خاصًا بك. التطبيق المحلي يعمل دون حساب. يمكن ربط خدمتك من الإعدادات أدناه.</p><details open><summary>إعداد الخدمة</summary><p>أنشئ مشروعًا مجانيًا من لوحة Supabase، ونفّذ ملف <code>supabase/schema.sql</code> المرفق بالمستودع في SQL Editor. فعّل تسجيل الدخول بالبريد وكلمة المرور. <a href="https://github.com/MagdyAqel/MyOS/blob/main/supabase/README.md" target="_blank" rel="noopener noreferrer">افتح دليل الإعداد خطوة بخطوة</a>. أدخل عنوان المشروع والمفتاح العام فقط؛ لا تستخدم service_role أو أي مفتاح سري.</p><form class="cloud-config"><label>عنوان المشروع<input type="url" name="url" placeholder="https://project.supabase.co" required></label><label>مفتاح publishable أو anon العام<input name="key" type="password" autocomplete="off" required></label><button>حفظ إعداد الخدمة</button></form></details><form class="cloud-auth"><h3>تسجيل الدخول</h3><label>البريد الإلكتروني<input type="email" name="email" autocomplete="email" required></label><label>كلمة المرور<input type="password" name="password" autocomplete="current-password" minlength="8" required></label><div><button name="login">دخول</button><button type="button" data-cloud="signup">إنشاء حساب</button><button type="button" data-cloud="logout">خروج</button></div></form><p class="cloud-status" role="status">أدخل إعداد المشروع لبدء الربط. لا تُخزّن كلمات المرور أو رموز الجلسة في النسخ السحابية.</p><section class="cloud-actions"><button data-cloud="inspect">فحص النسخة السحابية</button><button data-cloud="push">رفع نسخة هذا الجهاز</button><button data-cloud="pull">استعادة نسخة السحابة</button><button data-cloud="undo">تراجع عن آخر استعادة</button></section><div class="cloud-confirm hidden"><p></p><button data-cloud="confirm">تأكيد العملية</button><button data-cloud="cancel">إلغاء</button></div><p class="cloud-summary"></p><p class="muted">تُزامَن الملاحظات والملفات النصية والمستندات المنسقة وحفظ المعارك وتقدّم الحملة والمراحل. صور الخلفيات والجلسات وكلمات المرور لا تُرفع. المزامنة يدوية لتتمكن من مراجعة ما سترفعه أو تستعيده. إغلاق هذه النافذة ينهي الجلسة المحلية.</p><button data-cloud="reload" class="hidden">إعادة فتح التطبيق لعرض البيانات المستعادة</button></div>`;
  const config = content.querySelector(".cloud-config"),
    auth = content.querySelector(".cloud-auth"),
    status = content.querySelector(".cloud-status"),
    confirm = content.querySelector(".cloud-confirm");
  const tell = (text) => {
    if (!closed) status.textContent = text;
  };
  try {
    const saved = JSON.parse(storage.getItem("myos-cloud-config-v1"));
    if (saved) {
      config.elements.url.value = saved.url || "";
      config.elements.key.value = saved.key || "";
      client = new CloudClient(saved);
      tell("الإعداد محفوظ. سجّل الدخول لبدء المزامنة.");
    }
  } catch {
    /* An invalid configuration never starts requests. */
  }
  let busy = false;
  function controls() {
    for (const b of content.querySelectorAll("button")) b.disabled = busy;
    for (const name of ["inspect", "push", "pull", "logout"])
      content.querySelector(`[data-cloud="${name}"]`).disabled =
        busy || !client?.session;
  }
  const run = async (operation) => {
    if (busy) return;
    busy = true;
    controls();
    const token = epoch;
    try {
      await operation(token);
    } catch (error) {
      if (token === epoch) tell(error.message || "تعذّر إتمام العملية");
    } finally {
      busy = false;
      if (!closed) controls();
    }
  };
  const summary = (row) => {
    if (!row) {
      content.querySelector(".cloud-summary").textContent =
        "لا توجد نسخة سحابية لهذا الحساب بعد.";
      return;
    }
    const count = snapshotSummary(validateSyncSnapshot(row.data));
    content.querySelector(".cloud-summary").textContent =
      `السحابة: ${count.notes} ملاحظات · ${count.files} ملفات · ${count.documents} مستندات · ${count.battles} حفظ معارك · الإصدار ${row.revision}`;
  };
  config.onsubmit = (event) => {
    event.preventDefault();
    if (busy) return;
    try {
      const next = new CloudClient({
        url: config.elements.url.value.trim(),
        key: config.elements.key.value.trim(),
      });
      epoch++;
      client = next;
      remote = null;
      pending = null;
      confirm.classList.add("hidden");
      storage.setItem("myos-cloud-config-v1", JSON.stringify(next.config));
      tell("تم حفظ الإعداد العام. سجّل الدخول.");
      controls();
    } catch (error) {
      tell(error.message);
    }
  };
  auth.onsubmit = (event) => {
    event.preventDefault();
    run(async (token) => {
      if (!client) throw Error("احفظ إعداد الخدمة أولًا");
      const user = await client.login(
        auth.elements.email.value,
        auth.elements.password.value,
      );
      auth.elements.password.value = "";
      if (token !== epoch || closed) return;
      tell(`تم الدخول: ${user.email}. افحص النسخة قبل المزامنة.`);
    });
  };
  content.querySelector('[data-cloud="signup"]').onclick = () => {
    if (!auth.reportValidity()) return;
    run(async () => {
      if (!client) throw Error("احفظ إعداد الخدمة أولًا");
      const signed = await client.signup(
        auth.elements.email.value,
        auth.elements.password.value,
      );
      auth.elements.password.value = "";
      tell(
        signed
          ? "تم إنشاء الحساب وتسجيل الدخول."
          : "تحقق من رسالة تأكيد البريد، ثم سجّل الدخول.",
      );
    });
  };
  content.querySelector('[data-cloud="logout"]').onclick = () =>
    run(async () => {
      await client.logout();
      remote = null;
      pending = null;
      confirm.classList.add("hidden");
      tell("تم الخروج؛ البيانات المحلية باقية.");
    });
  content.querySelector('[data-cloud="inspect"]').onclick = () =>
    run(async () => {
      remote = await client.inspect();
      if (closed) return;
      summary(remote);
      tell("تم فحص النسخة دون تغيير بيانات الجهاز.");
    });
  content.querySelector('[data-cloud="push"]').onclick = () =>
    run(async () => {
      if (client.revision === null) throw Error("افحص النسخة السحابية أولًا");
      const snapshot = exportSyncSnapshot(storage),
        count = snapshotSummary(snapshot);
      if (!Object.keys(snapshot.datasets).length)
        throw Error("لا توجد بيانات محلية للرفع");
      pending = { kind: "push", snapshot };
      confirm.querySelector("p").textContent =
        `سترفع نسخة هذا الجهاز: ${count.notes} ملاحظات و${count.files} ملفات و${count.documents} مستندات. ستُستبدل بيانات النسخة السحابية عند نجاح الرفع؛ لن تُدمج الملاحظات تلقائيًا.`;
      confirm.classList.remove("hidden");
    });
  content.querySelector('[data-cloud="pull"]').onclick = () =>
    run(async () => {
      remote = await client.inspect();
      if (!remote) throw Error("لا توجد نسخة لاستعادتها");
      const snapshot = validateSyncSnapshot(remote.data),
        count = snapshotSummary(snapshot);
      pending = { kind: "pull", snapshot };
      confirm.querySelector("p").textContent =
        `ستستعيد ${count.notes} ملاحظات و${count.files} ملفات و${count.documents} مستندات و${count.battles} حفظ معارك. ستُستبدل مجموعات البيانات الموجودة في هذه النسخة، مع الاحتفاظ بنسخة تراجع محلية.`;
      confirm.classList.remove("hidden");
    });
  content.querySelector('[data-cloud="confirm"]').onclick = () =>
    run(async () => {
      if (!pending) return;
      const operation = pending;
      pending = null;
      confirm.classList.add("hidden");
      if (operation.kind === "push") {
        await client.push(operation.snapshot);
        tell("أكدت السحابة حفظ النسخة ✓");
      } else {
        applySyncSnapshot(storage, operation.snapshot);
        tell(
          "تمت الاستعادة على هذا الجهاز. أعد فتح التطبيق لعرض البيانات الجديدة.",
        );
        content
          .querySelector('[data-cloud="reload"]')
          .classList.remove("hidden");
      }
    });
  content.querySelector('[data-cloud="cancel"]').onclick = () => {
    pending = null;
    confirm.classList.add("hidden");
    tell("أُلغيت العملية؛ لم تتغير البيانات.");
  };
  content.querySelector('[data-cloud="undo"]').onclick = () => {
    try {
      undoSyncRestore(storage);
      tell("تم التراجع عن الاستعادة. أعد فتح التطبيق.");
      content.querySelector('[data-cloud="reload"]').classList.remove("hidden");
    } catch (error) {
      tell(error.message);
    }
  };
  content.querySelector('[data-cloud="reload"]').onclick = () =>
    location.reload();
  controls();
  return () => {
    closed = true;
    epoch++;
    if (client) client.session = null;
  };
}

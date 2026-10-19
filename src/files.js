import { listMedia, saveMedia, changeMedia } from "./media-store.js";
import {
  FILES_KEY,
  loadFiles,
  mutateFiles,
  createFile,
  trashFile,
  removeFile,
  parseFiles,
} from "./file-store.js";
import "./files.css";
export function setupFiles(
  content,
  { openMedia = () => {}, target = null } = {},
) {
  let storage;
  try {
    storage = localStorage;
  } catch {
    storage = {
      getItem: () => null,
      setItem: () => {
        throw Error("التخزين غير متاح");
      },
    };
  }
  let mediaRecords = [],
    closed = false;
  let data = loadFiles(storage),
    folder = "root",
    active = null,
    query = "",
    pending = null;
  content.innerHTML = `<div class="files-app"><div class="files-toolbar"><button data-files="new-file">ملف جديد</button><button data-files="new-folder">مجلد جديد</button><label>استيراد ملف<input type="file" accept=".txt,.md,.json,.csv,text/*,application/json,image/png,image/jpeg,image/webp,image/gif,application/pdf,audio/*,video/*" aria-label="استيراد ملف نصي"></label><input type="search" aria-label="البحث في الملفات" placeholder="البحث في الملفات"></div><form class="file-create hidden"><input aria-label="اسم العنصر الجديد" maxlength="120" required><button>إنشاء</button><button type="button" data-files="cancel">إلغاء</button></form><div class="file-layout"><aside><button data-folder="root">⌂ الرئيسية</button><button data-folder="documents">📁 المستندات</button><button data-folder="pictures">📁 الصور</button><button data-folder="downloads">📁 التنزيلات</button><button data-folder="trash">♻ سلة المحذوفات</button></aside><div class="file-main"><div class="file-path"></div><div class="file-items"></div><div class="media-file-items"></div><section class="file-editor hidden"><header><input aria-label="اسم الملف" maxlength="120"><button data-files="download">تنزيل الملف</button><button data-files="trash">نقل للسلة</button><button data-files="back">عودة للمجلد</button></header><textarea aria-label="محتوى الملف"></textarea></section><div class="trash-confirm hidden"><span>الحذف الدائم يزيل العنصر من هذا المتصفح. نزّل نسخة أولًا إن احتجتها.</span><button data-files="confirm-delete">تأكيد الحذف الدائم</button><button data-files="cancel-delete">إلغاء</button></div><div class="file-status" role="status"></div></div></div></div>`;
  const status = content.querySelector(".file-status"),
    items = content.querySelector(".file-items"),
    editor = content.querySelector(".file-editor"),
    form = content.querySelector(".file-create");
  const tell = (text) => (status.textContent = text);
  function change(fn) {
    try {
      data = mutateFiles(storage, fn);
      tell("تم الحفظ على هذا المتصفح ✓");
      return true;
    } catch (error) {
      tell(`لم يُحفظ: ${error.message}`);
      return false;
    }
  }
  function render() {
    content
      .querySelector(".files-app")
      .classList.toggle("editing", Boolean(active));
    content.querySelectorAll("[data-folder]").forEach((b) => {
      b.classList.toggle("selected", b.dataset.folder === folder);
      b.disabled =
        !["root", "trash"].includes(b.dataset.folder) &&
        !data.entries.some((e) => e.id === b.dataset.folder && !e.deleted);
    });
    content.querySelector(".file-path").textContent =
      "هذا الكمبيوتر / " +
      (folder === "root"
        ? "الرئيسية"
        : folder === "trash"
          ? "سلة المحذوفات"
          : data.entries.find((e) => e.id === folder)?.name || "مجلد");
    items.replaceChildren();
    editor.classList.toggle("hidden", !active);
    items.classList.toggle("hidden", Boolean(active));
    let entries = data.entries.filter((e) =>
      folder === "trash"
        ? e.deleted && !data.entries.some((p) => p.id === e.parent && p.deleted)
        : !e.deleted && (query || e.parent === folder),
    );
    if (query)
      entries = entries.filter((e) =>
        e.name.toLocaleLowerCase().includes(query),
      );
    for (const entry of entries) {
      const wrapper = document.createElement("div");
      wrapper.className = "real-file-item";
      const button = document.createElement("button");
      button.setAttribute("aria-label", entry.name);
      const icon = document.createElement("span");
      icon.textContent = entry.kind === "folder" ? "📁" : "📄";
      const name = document.createElement("span");
      name.textContent = entry.name;
      button.append(icon, name);
      button.onclick = () => {
        if (folder === "trash") return;
        if (entry.kind === "folder") {
          folder = entry.id;
          query = "";
          content.querySelector("[type=search]").value = "";
          render();
        } else open(entry.id);
      };
      wrapper.append(button);
      if (folder === "trash") {
        for (const [action, label] of [
          ["restore", "استعادة"],
          ["delete", "حذف دائم"],
        ]) {
          const b = document.createElement("button");
          b.textContent = label;
          b.className = "file-row-action";
          b.setAttribute("aria-label", label + " " + entry.name);
          b.onclick = () => {
            if (action === "restore") {
              if (change((d) => trashFile(d, entry.id, true))) render();
            } else {
              pending = entry.id;
              content
                .querySelector(".trash-confirm")
                .classList.remove("hidden");
            }
          };
          wrapper.append(b);
        }
      } else if (entry.kind === "folder") {
        const b = document.createElement("button");
        b.textContent = "نقل للسلة";
        b.className = "file-row-action";
        b.setAttribute("aria-label", "نقل " + entry.name + " للسلة");
        b.onclick = () => {
          if (change((d) => trashFile(d, entry.id))) render();
        };
        wrapper.append(b);
      }
      items.append(wrapper);
    }
    renderMedia();
    if (
      !entries.length &&
      !mediaRecords.some((r) =>
        folder === "trash"
          ? r.deleted
          : !r.deleted && ["root", "pictures", "downloads"].includes(folder),
      )
    ) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent =
        folder === "trash"
          ? "السلة فارغة"
          : query
            ? "لا توجد نتائج"
            : "هذا المجلد فارغ";
      items.append(p);
    }
  }
  function renderMedia() {
    const root = content.querySelector(".media-file-items");
    root.replaceChildren();
    root.hidden = Boolean(active);
    const records = mediaRecords.filter(
      (r) =>
        (folder === "trash"
          ? r.deleted
          : !r.deleted &&
            (["root", "downloads"].includes(folder) ||
              (folder === "pictures" && r.type.startsWith("image/")))) &&
        (!query || r.name.toLocaleLowerCase().includes(query)),
    );
    for (const r of records) {
      const row = document.createElement("div");
      row.className = "real-file-item";
      const button = document.createElement("button");
      button.textContent = `${r.type.startsWith("image/") ? "🖼" : "▶"} ${r.name}`;
      button.setAttribute("aria-label", r.name);
      button.onclick = () => {
        if (!r.deleted) openMedia({ app: "media", id: r.id });
      };
      row.append(button);
      for (const [operation, label] of r.deleted
        ? [
            ["restore", "استعادة"],
            ["delete", "حذف دائم"],
          ]
        : [["trash", "نقل للسلة"]]) {
        const action = document.createElement("button");
        action.className = "file-row-action";
        action.textContent = label;
        action.setAttribute("aria-label", label + " " + r.name);
        action.onclick = async () => {
          if (operation === "delete" && action.dataset.confirm !== "yes") {
            action.dataset.confirm = "yes";
            action.textContent = "تأكيد الحذف الدائم";
            return;
          }
          try {
            await changeMedia(r.id, operation);
            await reloadMedia();
          } catch (error) {
            tell(error.message);
          }
        };
        row.append(action);
      }
      root.append(row);
    }
  }
  async function reloadMedia() {
    try {
      const records = await listMedia();
      if (closed) return;
      mediaRecords = records;
      renderMedia();
    } catch (error) {
      tell(error.message);
    }
  }
  function openItem(event) {
    data = loadFiles(storage);
    open(event.detail.id);
  }
  content.addEventListener("myos:open-item", openItem);
  window.addEventListener("myos:media-changed", reloadMedia);
  function open(id) {
    const entry = data.entries.find((e) => e.id === id && !e.deleted);
    if (!entry) return;
    active = id;
    content.querySelector('[aria-label="اسم الملف"]').value = entry.name;
    content.querySelector("textarea").value = entry.text;
    render();
  }
  content.querySelectorAll("[data-folder]").forEach(
    (b) =>
      (b.onclick = () => {
        folder = b.dataset.folder;
        active = null;
        pending = null;
        query = "";
        content.querySelector("[type=search]").value = "";
        content.querySelector(".trash-confirm").classList.add("hidden");
        render();
      }),
  );
  for (const [id, kind] of [
    ["new-file", "file"],
    ["new-folder", "folder"],
  ])
    content.querySelector(`[data-files="${id}"]`).onclick = () => {
      if (folder === "trash") folder = "root";
      form.dataset.kind = kind;
      form.classList.remove("hidden");
      form.querySelector("input").value =
        kind === "file" ? "ملف جديد.txt" : "مجلد جديد";
      form.querySelector("input").focus();
    };
  form.onsubmit = (event) => {
    event.preventDefault();
    const id = crypto.randomUUID();
    if (
      change((d) =>
        createFile(d, {
          id,
          name: form.querySelector("input").value,
          parent: folder,
          kind: form.dataset.kind,
        }),
      )
    ) {
      form.classList.add("hidden");
      if (form.dataset.kind === "file") open(id);
      else render();
    }
  };
  content.querySelector('[data-files="cancel"]').onclick = () =>
    form.classList.add("hidden");
  content.querySelector("[type=search]").oninput = (event) => {
    query = event.target.value.trim().toLocaleLowerCase();
    active = null;
    render();
  };
  content.querySelector("textarea").oninput = (event) =>
    change((d) => {
      d.entries.find((e) => e.id === active).text = event.target.value;
    });
  content.querySelector('[aria-label="اسم الملف"]').onchange = (event) => {
    const name = event.target.value.trim();
    if (
      change((d) => {
        const e = d.entries.find((e) => e.id === active);
        if (
          d.entries.some(
            (other) =>
              !other.deleted &&
              other.id !== e.id &&
              other.parent === e.parent &&
              other.name === name,
          )
        )
          throw Error("الاسم مستخدم");
        e.name = name;
      })
    )
      render();
  };
  content.querySelector('[data-files="back"]').onclick = () => {
    active = null;
    render();
  };
  content.querySelector('[data-files="trash"]').onclick = () => {
    if (change((d) => trashFile(d, active))) {
      active = null;
      render();
    }
  };
  content.querySelector('[data-files="download"]').onclick = () => {
    const e = data.entries.find((e) => e.id === active);
    if (!e) return;
    const url = URL.createObjectURL(
        new Blob([content.querySelector("textarea").value], {
          type: "text/plain;charset=utf-8",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download = e.name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  content.querySelector('[data-files="confirm-delete"]').onclick = () => {
    if (pending && change((d) => removeFile(d, pending))) {
      pending = null;
      content.querySelector(".trash-confirm").classList.add("hidden");
      render();
    }
  };
  content.querySelector('[data-files="cancel-delete"]').onclick = () => {
    pending = null;
    content.querySelector(".trash-confirm").classList.add("hidden");
  };
  content.querySelector("[type=file]").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (
        /^(image|audio|video)\//.test(file.type) ||
        file.type === "application/pdf"
      ) {
        const record = await saveMedia(file);
        await reloadMedia();
        openMedia({ app: "media", id: record.id });
        tell("حُفظ ملف الوسائط في المكتبة ✓");
        return;
      }
      if (file.size > 500000)
        throw Error("الحد الأقصى للملف النصي 500 كيلوبايت");
      if (
        !/\.(txt|md|json|csv)$/i.test(file.name) &&
        !file.type.startsWith("text/")
      )
        throw Error("استورد ملفًا نصيًا TXT أو MD أو JSON أو CSV");
      const text = await file.text();
      if (text.includes("\0")) throw Error("هذا الملف ليس نصًا قابلًا للتحرير");
      const id = crypto.randomUUID();
      if (
        change((d) =>
          createFile(d, {
            id,
            name: file.name,
            parent: folder === "trash" ? "root" : folder,
            text,
          }),
        )
      ) {
        if (folder === "trash") folder = "root";
        open(id);
      }
    } catch (error) {
      tell(error.message);
    } finally {
      event.target.value = "";
    }
  };
  const sync = (event) => {
    if (event.key === FILES_KEY) {
      try {
        data = parseFiles(event.newValue);
        active = null;
        render();
        tell("تم التحديث من تبويب آخر");
      } catch {
        tell("تعذّر قراءة تحديث الملفات");
      }
    }
  };
  window.addEventListener("storage", sync);
  render();
  try {
    if (storage.getItem(FILES_KEY)) parseFiles(storage.getItem(FILES_KEY));
  } catch {
    tell("تعذّر قراءة الملفات المحفوظة؛ لم يتم استبدالها.");
  }
  reloadMedia();
  if (target) open(target.id);
  return () => {
    closed = true;
    window.removeEventListener("storage", sync);
    window.removeEventListener("myos:media-changed", reloadMedia);
    content.removeEventListener("myos:open-item", openItem);
  };
}

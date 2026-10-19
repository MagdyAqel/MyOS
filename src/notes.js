import "./features.css";
import { loadNotebook, persistNotebook, NOTEBOOK_KEY } from "./notebook.js";

export function setupNotes(content, {target=null}={}) {
  let storage;
  try {
    storage = window.localStorage;
  } catch {
    storage = {
      getItem: () => null,
      setItem: () => {
        throw Error("Storage unavailable");
      },
    };
  }
  const loaded = loadNotebook(storage);
  let data = loaded.data;
  if(target && data.notes.some(n=>n.id===target.id))data.activeId=target.id;
  content.innerHTML = `<div class="notebook"><aside class="notes-sidebar"><div><strong>دفتر ملاحظاتي</strong><button data-note="new" aria-label="ملاحظة جديدة">＋</button></div><input class="notes-search" aria-label="البحث في الملاحظات" placeholder="ابحث في العناوين والنصوص"><nav aria-label="الملاحظات المحفوظة"></nav><p>محفوظة على هذا المتصفح.<br>نزّل نسخة للاحتفاظ بها خارج الجهاز.</p></aside><div class="notes-editor"><header><input aria-label="عنوان الملاحظة" maxlength="120" placeholder="عنوان الملاحظة"><button data-note="download">تنزيل نص</button></header><textarea aria-label="نص الملاحظة" placeholder="كل فكرة رائعة تبدأ بكلمة…" spellcheck="true"></textarea><footer><span class="notes-save-state" role="status"></span><span class="notes-count"></span></footer></div></div>`;
  const area = content.querySelector("textarea"),
    title = content.querySelector('[aria-label="عنوان الملاحظة"]');
  const status = content.querySelector(".notes-save-state");
  const active = () => data.notes.find((n) => n.id === data.activeId);
  function list() {
    const nav = content.querySelector("nav");
    nav.replaceChildren();
    const query=content.querySelector(".notes-search").value.trim().toLocaleLowerCase();
    for (const note of data.notes.filter(n=>(n.title+" "+n.text).toLocaleLowerCase().includes(query))) {
      const button = document.createElement("button");
      button.textContent = note.title || "بدون عنوان";
      button.setAttribute("aria-current", String(note.id === data.activeId));
      button.onclick = () => {
        data.activeId = note.id;
        render();
        save();
      };
      nav.append(button);
    }
  }
  content.querySelector(".notes-search").oninput=list;
  function count() {
    content.querySelector(".notes-count").textContent =
      `${area.value.length} حرف`;
  }
  function save() {
    try {
      persistNotebook(storage, data);
      status.textContent = "تم الحفظ على هذا المتصفح ✓";
      status.dataset.saved = "true";
    } catch {
      status.textContent =
        "لم يُحفظ: التخزين غير متاح أو ممتلئ. نزّل نسخة نصية الآن.";
      status.dataset.saved = "false";
    }
  }
  function render() {
    title.value = active().title;
    area.value = active().text;
    list();
    count();
  }
  area.oninput = () => {
    active().text = area.value;
    count();
    save();
  };
  title.oninput = () => {
    active().title = title.value;
    list();
    save();
  };
  content.querySelector('[data-note="new"]').onclick = () => {
    const note = {
      id: crypto.randomUUID(),
      title: `ملاحظة ${data.notes.length + 1}`,
      text: "",
    };
    data.notes.push(note);
    data.activeId = note.id;
    render();
    save();
    area.focus();
  };
  content.querySelector('[data-note="download"]').onclick = () => {
    const url = URL.createObjectURL(
      new Blob([active().text], { type: "text/plain;charset=utf-8" }),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download =
      (active().title || "ملاحظة").replace(/[\\/:*?"<>|]/g, "_") + ".txt";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const sync = (event) => {
    if (event.key !== NOTEBOOK_KEY || !event.newValue) return;
    data = loadNotebook(storage).data;
    render();
    status.textContent = "تم تحديث الملاحظات من تبويب آخر";
  };
  function openItem(event){if(data.notes.some(n=>n.id===event.detail.id)){data.activeId=event.detail.id;content.querySelector(".notes-search").value="";render();}}
  content.addEventListener("myos:open-item",openItem);
  window.addEventListener("storage", sync);
  render();
  save();
  if (loaded.recovered)
    status.textContent = "استُعيدت الملاحظات من النسخة المحلية الاحتياطية";
  return () => {window.removeEventListener("storage", sync);content.removeEventListener("myos:open-item",openItem);};
}

export const DOCUMENTS_KEY = "myos-documents-v1";
export function parseDocuments(raw) {
  const d = typeof raw === "string" ? JSON.parse(raw) : raw;
  if (
    !d ||
    d.version !== 1 ||
    !Array.isArray(d.documents) ||
    d.documents.length < 1 ||
    d.documents.length > 30 ||
    !d.documents.some((x) => x.id === d.activeId) ||
    new Set(d.documents.map((x) => x.id)).size !== d.documents.length ||
    d.documents.some(
      (x) =>
        !x ||
        typeof x.id !== "string" ||
        x.id.length > 100 ||
        typeof x.title !== "string" ||
        x.title.length > 120 ||
        typeof x.html !== "string" ||
        x.html.length > 400000,
    ) ||
    JSON.stringify(d).length > 1500000
  )
    throw Error("سجل المستندات غير صالح أو كبير");
  return d;
}
export function initialDocuments() {
  return {
    version: 1,
    activeId: "first",
    documents: [
      { id: "first", title: "مستندي الأول", html: "<p>ابدأ الكتابة هنا…</p>" },
    ],
  };
}
export function sanitizeDocument(html) {
  const source = new DOMParser().parseFromString(html, "text/html"),
    root = document.createElement("div"),
    tags = new Set([
      "P",
      "DIV",
      "STRONG",
      "B",
      "I",
      "EM",
      "U",
      "BR",
      "UL",
      "OL",
      "LI",
      "H1",
      "H2",
      "BLOCKQUOTE",
      "SPAN",
    ]);
  function walk(node, parent) {
    if (node.nodeType === 3) {
      parent.append(document.createTextNode(node.textContent));
      return;
    }
    if (
      node.nodeType !== 1 ||
      [
        "SCRIPT",
        "STYLE",
        "IFRAME",
        "OBJECT",
        "EMBED",
        "SVG",
        "MATH",
        "IMG",
        "VIDEO",
        "AUDIO",
        "LINK",
        "META",
      ].includes(node.tagName)
    )
      return;
    let next = parent;
    if (tags.has(node.tagName)) {
      next = document.createElement(node.tagName.toLowerCase());
      if (["left", "right", "center", "justify"].includes(node.style.textAlign))
        next.style.textAlign = node.style.textAlign;
      parent.append(next);
    }
    for (const child of node.childNodes) walk(child, next);
  }
  for (const child of source.body.childNodes) walk(child, root);
  return root.innerHTML;
}
export function setupWriter(content, { target = null } = {}) {
  let data = initialDocuments(),
    damaged = false;
  try {
    const raw = localStorage.getItem(DOCUMENTS_KEY);
    if (raw) data = parseDocuments(raw);
  } catch {
    damaged = true;
  }
  if (target && data.documents.some((d) => d.id === target.id))
    data.activeId = target.id;
  content.innerHTML = `<div class="writer-app"><header class="writer-header"><select aria-label="المستند المحفوظ"></select><button data-doc="new">مستند جديد</button><label>استيراد نص أو HTML<input type="file" accept=".txt,.md,.html" aria-label="استيراد مستند"></label></header><input class="document-title" maxlength="120" aria-label="عنوان المستند"><nav class="writer-tools" aria-label="تنسيق المستند"><button data-format="bold" aria-label="خط عريض"><b>B</b></button><button data-format="italic" aria-label="خط مائل"><i>I</i></button><button data-format="underline" aria-label="تسطير"><u>U</u></button><button data-block="h2">عنوان</button><button data-block="p">فقرة</button><button data-format="insertUnorderedList">قائمة</button><button data-format="justifyCenter">توسيط</button><button data-doc="undo">تراجع</button><button data-doc="redo">إعادة</button><button data-doc="html">تنزيل مستند منسق</button><button data-doc="text">تنزيل TXT</button></nav><div class="document-paper" contenteditable="true" role="textbox" aria-label="نص المستند المنسق" aria-multiline="true" spellcheck="true"></div><footer class="document-status" role="status"></footer></div>`;
  const editor = content.querySelector(".document-paper"),
    title = content.querySelector(".document-title"),
    select = content.querySelector("select"),
    status = content.querySelector(".document-status");
  let history = [],
    cursor = 0,
    closed = false;
  const active = () => data.documents.find((x) => x.id === data.activeId);
  function list() {
    select.replaceChildren();
    for (const d of data.documents) {
      const o = document.createElement("option");
      o.value = d.id;
      o.textContent = d.title || "بدون عنوان";
      select.append(o);
    }
    select.value = data.activeId;
  }
  function save() {
    try {
      if (damaged) throw Error();
      active().html = sanitizeDocument(editor.innerHTML);
      active().title = title.value;
      parseDocuments(data);
      localStorage.setItem(DOCUMENTS_KEY, JSON.stringify(data));
      status.textContent = "تم حفظ المستند على هذا المتصفح ✓";
      list();
    } catch {
      status.textContent =
        "لم يُحفظ المستند؛ نزّل نسخة. التخزين غير متاح أو السجل تالف أو ممتلئ.";
    }
  }
  function checkpoint() {
    const html = sanitizeDocument(editor.innerHTML);
    if (history[cursor] !== html) {
      history = history.slice(0, cursor + 1);
      history.push(html);
      if (history.length > 60) history.shift();
      cursor = history.length - 1;
    }
    save();
  }
  function render() {
    title.value = active().title;
    editor.innerHTML = sanitizeDocument(active().html);
    history = [editor.innerHTML];
    cursor = 0;
    list();
    status.textContent = damaged
      ? "السجل المحلي غير قابل للقراءة؛ لم يتم استبداله."
      : "المستند محفوظ محليًا؛ يمكنك تنزيل نسخة منسقة.";
  }
  function undo(delta) {
    const next = cursor + delta;
    if (next < 0 || next >= history.length) return;
    cursor = next;
    editor.innerHTML = history[cursor];
    save();
  }
  editor.oninput = checkpoint;
  title.oninput = () => {
    save();
  };
  editor.onkeydown = (event) => {
    if (
      (event.ctrlKey || event.metaKey) &&
      ["z", "y"].includes(event.key.toLowerCase())
    ) {
      event.preventDefault();
      undo(event.key.toLowerCase() === "y" || event.shiftKey ? 1 : -1);
    }
  };
  editor.ondrop = (event) => {
    event.preventDefault();
    document.execCommand(
      "insertText",
      false,
      event.dataTransfer.getData("text/plain"),
    );
    checkpoint();
  };
  editor.onpaste = (event) => {
    event.preventDefault();
    document.execCommand(
      "insertText",
      false,
      event.clipboardData.getData("text/plain"),
    );
    checkpoint();
  };
  for (const button of content.querySelectorAll("[data-format],[data-block]")) {
    button.onmousedown = (e) => e.preventDefault();
    button.onclick = () => {
      editor.focus();
      document.execCommand(
        button.dataset.format || "formatBlock",
        false,
        button.dataset.block || null,
      );
      checkpoint();
    };
  }
  select.onchange = () => {
    data.activeId = select.value;
    render();
    save();
  };
  content.querySelector("[data-doc=new]").onclick = () => {
    if (data.documents.length >= 30) {
      status.textContent = "الحد الأقصى 30 مستندًا؛ نزّل المستندات المهمة.";
      return;
    }
    const doc = {
      id: crypto.randomUUID(),
      title: "مستند جديد",
      html: "<p><br></p>",
    };
    data.documents.push(doc);
    data.activeId = doc.id;
    render();
    save();
    editor.focus();
  };
  content.querySelector("[data-doc=undo]").onclick = () => undo(-1);
  content.querySelector("[data-doc=redo]").onclick = () => undo(1);
  function download(rich) {
    const text = rich
      ? '<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>MyOS Document</title><body>' +
        sanitizeDocument(editor.innerHTML) +
        "</body></html>"
      : editor.innerText;
    const url = URL.createObjectURL(
        new Blob([text], {
          type: rich ? "text/html;charset=utf-8" : "text/plain;charset=utf-8",
        }),
      ),
      a = document.createElement("a");
    a.href = url;
    a.download =
      (title.value || "مستند").replace(/[\\/:*?"<>|]/g, "_") +
      (rich ? ".html" : ".txt");
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  content.querySelector("[data-doc=html]").onclick = () => download(true);
  content.querySelector("[data-doc=text]").onclick = () => download(false);
  content.querySelector("[type=file]").onchange = async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 300000 || data.documents.length >= 30)
        throw Error("اختر مستندًا حتى 300 كيلوبايت، ضمن حد 30 مستندًا");
      const text = await file.text();
      if (closed) return;
      const div = document.createElement("div");
      div.textContent = text;
      const html = /\.html$/i.test(file.name)
        ? sanitizeDocument(text)
        : "<p>" + div.innerHTML.replaceAll("\n", "<br>") + "</p>";
      data.documents.push({
        id: crypto.randomUUID(),
        title: file.name.slice(0, 120),
        html,
      });
      data.activeId = data.documents.at(-1).id;
      render();
      save();
    } catch (error) {
      status.textContent = error.message;
    } finally {
      event.target.value = "";
    }
  };
  function openItem(event) {
    if (data.documents.some((d) => d.id === event.detail.id)) {
      data.activeId = event.detail.id;
      render();
    }
  }
  content.addEventListener("myos:open-item", openItem);
  render();
  return () => {
    content.removeEventListener("myos:open-item", openItem);
    closed = true;
  };
}

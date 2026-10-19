import { loadNotebook } from "./notebook.js";
import { loadFiles } from "./file-store.js";
import { listMedia } from "./media-store.js";
export function setupGlobalSearch(openItem) {
  const input = document.querySelector("#search"),
    results = document.createElement("div");
  results.className = "global-search-results";
  results.setAttribute("aria-label", "نتائج البحث في الملفات والمحتوى");
  document.querySelector("#app-grid").after(results);
  input.placeholder = "ابحث في التطبيقات والملاحظات والملفات";
  let revision = 0,
    timer;
  const text = (html) =>
    new DOMParser().parseFromString(html, "text/html").body.textContent || "";
  input.addEventListener("input", () => {
    clearTimeout(timer);
    const current = ++revision,
      query = input.value.trim().toLocaleLowerCase();
    results.replaceChildren();
    if (!query) return;
    timer = setTimeout(async () => {
      let all = [];
      try {
        all.push(
          ...loadNotebook(localStorage).data.notes.map((n) => ({
            app: "notes",
            id: n.id,
            name: n.title,
            body: n.text,
            kind: "ملاحظة",
          })),
        );
        all.push(
          ...loadFiles(localStorage)
            .entries.filter((e) => !e.deleted && e.kind === "file")
            .map((e) => ({
              app: "files",
              id: e.id,
              name: e.name,
              body: e.text,
              kind: "ملف",
            })),
        );
        const docs = JSON.parse(localStorage.getItem("myos-documents-v1"));
        if (Array.isArray(docs?.documents))
          all.push(
            ...docs.documents.map((d) => ({
              app: "writer",
              id: d.id,
              name: d.title,
              body: text(d.html),
              kind: "مستند",
            })),
          );
      } catch {}
      try {
        all.push(
          ...(await listMedia())
            .filter((r) => !r.deleted)
            .map((r) => ({
              app: "media",
              id: r.id,
              name: r.name,
              body: "",
              kind: "وسائط محفوظة",
            })),
        );
      } catch {}
      if (current !== revision) return;
      all = all
        .filter((e) =>
          (e.name + " " + e.body).toLocaleLowerCase().includes(query),
        )
        .slice(0, 20);
      for (const item of all) {
        const button = document.createElement("button");
        button.className = "global-search-result";
        button.textContent = `${item.kind} · ${item.name}`;
        const excerpt = document.createElement("small");
        const index = item.body.toLocaleLowerCase().indexOf(query);
        excerpt.textContent = item.body.slice(
          Math.max(0, index - 25),
          Math.max(0, index - 25) + 90,
        );
        button.append(excerpt);
        button.onclick = () => openItem(item);
        results.append(button);
      }
      if (!all.length) {
        const p = document.createElement("p");
        p.textContent = "لا توجد نتائج في المحتوى المحفوظ";
        results.append(p);
      }
    }, 120);
  });
}

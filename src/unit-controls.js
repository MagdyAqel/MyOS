import { APC_DESIGNS, specialAction } from "./unit-abilities.js";
export function setupUnitControls(content, { getBattle, arm, refresh }) {
  const panel = document.createElement("section");
  panel.className = "unit-abilities";
  panel.innerHTML = `<h3>النقل والاستطلاع</h3><label>تجهيز الناقلة الجديدة<select aria-label="تصميم ناقلة الجند">${Object.entries(
    APC_DESIGNS,
  )
    .map(([id, d]) => `<option value="${id}">${d.name}</option>`)
    .join(
      "",
    )}</select></label><p>يطبق التصميم عند الإنتاج من مصنع المدرعات.</p><div class="unit-selectors">${[
    ["soldier", "المشاة"],
    ["apc", "الناقلات"],
    ["recon", "الاستطلاع"],
    ["drone", "الانتحارية"],
    ["artillery", "المدفعية"],
  ]
    .map(
      ([type, label]) =>
        `<button data-select-type="${type}">تحديد ${label}</button>`,
    )
    .join(
      "",
    )}</div><label>الناقلة المستهدفة<select aria-label="الناقلة المستهدفة"></select></label><div class="command-pair"><button data-ability="board">ركوب الجنود المحددين</button><button data-ability="unload">إنزال الجنود</button></div><button data-ability="recon">استطلاع: اختر منطقة</button><p class="unit-status" role="status"></p><details><summary>القدرات والمدى</summary><p>حدّد المشاة واختر ناقلة ثم اضغط الركوب؛ يقترب الجنود منها قبل الاختفاء داخلها. تبقى صحتهم وذخيرتهم محفوظة، ويفقدون إذا دُمرت الناقلة.</p><p>طائرة الاستطلاع غير مسلحة وتكشف دائرة صغيرة (110). حدّدها واضغط الاستطلاع ثم اختر وجهة على الميدان أو Shift مع الخريطة المصغرة.</p><p>الطائرة الانتحارية تضرب مرة واحدة عند الوصول إلى هدف مكشوف تختاره. المدفعية تقصف حتى 410 وبحد أدنى 100، وتحتاج كشفًا من الجيش أو الاستطلاع. القذائف متأخرة ويمكن تفاديها بالحركة.</p></details>`;
  content.querySelector(".rts-panel").append(panel);
  const carrier = panel.querySelector('[aria-label="الناقلة المستهدفة"]');
  const design = panel.querySelector('[aria-label="تصميم ناقلة الجند"]');
  const designLabel = design.closest("label"),
    designNote = designLabel.nextElementSibling;
  designLabel.className = "transport-design";
  designNote.className = "transport-design-note";
  content.querySelector(".train-buttons").before(designLabel, designNote);
  panel
    .querySelector("h3")
    .after(
      carrier.closest("label"),
      panel.querySelector(".command-pair"),
      panel.querySelector(".unit-status"),
    );
  design.onchange = refresh;
  for (const button of panel.querySelectorAll("[data-select-type]"))
    button.onclick = () => {
      const b = getBattle();
      b.selected = new Set(
        b.entities
          .filter(
            (e) =>
              e.team === "blue" &&
              !e.carriedBy &&
              e.type === button.dataset.selectType,
          )
          .map((e) => e.id),
      );
      b.message = b.selected.size
        ? `تم تحديد ${b.selected.size} وحدة`
        : "درّب وحدات من هذا النوع أولًا";
      refresh();
    };
  for (const kind of ["board", "unload"])
    panel.querySelector(`[data-ability=${kind}]`).onclick = () => {
      specialAction(getBattle(), { kind, carrier: Number(carrier.value) });
      refresh();
    };
  panel.querySelector("[data-ability=recon]").onclick = () => {
    const b = getBattle();
    if (!b.entities.some((e) => b.selected.has(e.id) && e.type === "recon")) {
      b.message = "حدّد طائرة استطلاع أولًا";
      refresh();
      return;
    }
    arm("recon");
    b.message = "اختر منطقة استطلاع على الميدان، أو Shift مع الخريطة المصغرة";
    content.querySelector(".rts-app").classList.remove("commands-open");
    content
      .querySelector("[data-game=commands]")
      .setAttribute("aria-expanded", "false");
    refresh();
  };
  let roster = "";
  return {
    design: () => design.value,
    refresh() {
      const b = getBattle();
      if (!b) return;
      designLabel.classList.toggle("hidden", !b.allowed("apc"));
      designNote.classList.toggle("hidden", !b.allowed("apc"));
      const apcs = b.entities.filter(
        (e) => e.team === "blue" && e.type === "apc",
      );
      const html = apcs
        .map(
          (e) =>
            `<option value="${e.id}">#${e.id} · ${APC_DESIGNS[e.design || "standard"].name} · ${b.entities.filter((a) => a.carriedBy === e.id).length}/${e.capacity}</option>`,
        )
        .join("");
      if (html !== roster) {
        const id = carrier.value;
        carrier.innerHTML = html;
        if (apcs.some((e) => String(e.id) === id)) carrier.value = id;
        roster = html;
      }
      const passengers = b.entities.filter(
        (e) => e.team === "blue" && e.carriedBy,
      ).length;
      const pending = b.entities.filter(
        (e) => e.team === "blue" && e.boarding,
      ).length;
      panel.querySelector(".unit-status").textContent =
        `داخل الناقلات: ${passengers} · يتجهون للركوب: ${pending} · المحدد: ${b.selected.size}`;
      for (const button of panel.querySelectorAll("[data-ability]"))
        button.disabled = b.paused || b.status !== "playing";
      const train = content.querySelector("[data-train=apc]");
      if (train) {
        const price = 600 + APC_DESIGNS[design.value].extra;
        train.querySelector("small").textContent = `$${price}`;
        train.disabled ||= b.cash < price;
      }
    },
  };
}

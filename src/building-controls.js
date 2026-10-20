import { repairBuilding } from "./battle-orders.js";

export function setupBuildingRepairs(content, getBattle, refresh) {
  const panel = document.createElement("details");
  panel.className = "building-repair";
  panel.innerHTML =
    '<summary>تصليح المباني</summary><label>المبنى<select aria-label="المبنى المراد تصليحه"></select></label><p class="repair-status" role="status"></p><button data-repair="toggle">بدء التصليح</button><small>حتى 20 صحة/ثانية مقابل $5. يتوقف عند اكتمال الصحة أو نفاد المال. المهندس الميداني يصلح المباني القريبة أيضًا.</small>';
  content.querySelector("[data-game=autoplace]").after(panel);
  const select = panel.querySelector("select"),
    button = panel.querySelector("button"),
    status = panel.querySelector(".repair-status");
  let previous = "";
  select.onchange = refresh;
  button.onclick = () => {
    repairBuilding(getBattle(), Number(select.value));
    refresh();
  };
  const update = () => {
    const b = getBattle();
    if (!b) return;
    const buildings = b.entities.filter(
      (e) => e.team === "blue" && !e.speed && e.hp > 0,
    );
    const current = select.value;
    const signature = buildings
      .map((e) => `${e.id}:${Math.ceil(e.hp)}:${e.repairing === true}`)
      .join(",");
    if (signature !== previous) {
      select.replaceChildren(
        ...buildings.map((e) => {
          const option = document.createElement("option");
          option.value = String(e.id);
          option.textContent = `${e.name} #${e.id} · ${Math.ceil((e.hp / e.maxHp) * 100)}%${e.repairing ? " · قيد التصليح" : ""}`;
          return option;
        }),
      );
      const chosen =
        buildings.find((e) => String(e.id) === current) ||
        buildings.find((e) => e.hp < e.maxHp) ||
        buildings[0];
      select.value = chosen ? String(chosen.id) : "";
      previous = signature;
    }
    const building = buildings.find((e) => String(e.id) === select.value);
    const damaged = buildings.filter((e) => e.hp < e.maxHp).length;
    panel.querySelector("summary").textContent =
      `تصليح المباني${damaged ? ` · ${damaged} متضرر` : ""}`;
    button.textContent = building?.repairing ? "إيقاف التصليح" : "بدء التصليح";
    button.disabled =
      b.paused ||
      b.status !== "playing" ||
      !building ||
      (!building.repairing &&
        (building.hp >= building.maxHp ||
          b.cash < 1 ||
          (building.type === "hq" &&
            building.hqMode &&
            building.hqMode !== "deployed")));
    status.textContent = building
      ? `الصحة ${Math.ceil(building.hp)}/${building.maxHp}${building.repairing ? " · جارٍ التصليح" : building.hp >= building.maxHp ? " · سليم" : ` · تكلفة الإكمال نحو $${Math.ceil((building.maxHp - building.hp) / 4)}`}`
      : "لا توجد مبانٍ";
  };
  return {
    refresh: update,
    inspect(id) {
      update();
      select.value = String(id);
      panel.open = true;
      content.querySelector(".rts-app").classList.add("commands-open");
      content
        .querySelector("[data-game=commands]")
        .setAttribute("aria-expanded", "true");
      update();
      panel.scrollIntoView({ block: "nearest", behavior: "smooth" });
    },
  };
}

import { bindNetworkGame } from "./network-game.js";
import { setupCommandCenter } from "./command-center.js";
import { Battle, TYPES } from "./battle.js";
import { STAGES, loadCampaign } from "./campaign.js";
import { createBattleScene } from "./scene3d.js";
import { MAPS, mapSvg } from "./maps.js";
import { BattleAudio } from "./audio.js";
import "./realism.css";
import "./apps.css";
import "./campaign.css";
import "./mobile-game.css";
import { COMPACT_QUERY } from "./mobile.js";
import { DIFFICULTIES, MISSIONS, missionStatus } from "./systems.js";
import {
  saveBattle,
  readBattle,
  restoreBattle,
  BATTLE_AUTO,
} from "./battle-save.js";
import "./features.css";

export function setupGame(content, { network = null } = {}) {
  let storage;
  try {
    storage = localStorage;
  } catch {
    storage = {
      getItem: () => null,
      setItem: () => {
        throw Error();
      },
    };
  }
  const progress = loadCampaign(storage);
  const audio = new BattleAudio(storage);
  let chosenMaps = {};
  try {
    const saved = JSON.parse(storage.getItem("myos-map-choice-v1"));
    if (saved && typeof saved === "object" && !Array.isArray(saved))
      chosenMaps = saved;
  } catch {
    /* Defaults are always available. */
  }
  content.innerHTML = `<div class="rts-app">
    <header class="rts-header"><div><span class="eyebrow">COMMAND HORIZON · 3D</span><strong>قيادة الأفق</strong></div><div class="rts-stats" aria-live="off"><span data-stat="cash"></span><span data-stat="wave"></span><span data-stat="army"></span></div><div class="sound-controls"><button data-sound="toggle" aria-pressed="false">تشغيل الأصوات</button><label>الصوت <input type="range" min="0" max="100" aria-label="مستوى صوت اللعبة" value="${Math.round(audio.volume * 100)}"></label></div><button data-game="pause">إيقاف مؤقت</button><button data-game="restart">إعادة المرحلة</button></header>
    <div class="campaign-bar" id="game-maps"><label>المراحل <select aria-label="اختيار المرحلة">${STAGES.map((s, i) => `<option value="${i}">${i + 1}. ${s.name} — ${s.category}</option>`).join("")}</select></label><label>الخريطة <select aria-label="اختيار الخريطة"></select></label><label>المهمة <select aria-label="نوع المهمة"></select></label><label>الصعوبة <select aria-label="مستوى الصعوبة">${Object.entries(
      DIFFICULTIES,
    )
      .map(
        ([id, d]) =>
          `<option value="${id}" ${id === "normal" ? "selected" : ""}>${d.name}</option>`,
      )
      .join(
        "",
      )}</select></label><div class="save-controls"><button data-game="save">حفظ المعركة</button><button data-game="resume">استئناف آخر حفظ</button><button data-game="fog" aria-pressed="true">ضباب الحرب</button><span class="battle-save-status" role="status"></span></div><label class="mobile-game-only mobile-volume">مستوى الصوت <input type="range" min="0" max="100" value="${Math.round(audio.volume * 100)}" aria-label="مستوى الصوت للجوال"></label><span class="campaign-progress"></span><button data-game="next">المرحلة التالية ←</button><small>تغيير المرحلة أو الخريطة أو المهمة أو الصعوبة يبدأ معركة جديدة</small></div>
    <div class="rts-layout"><div class="battlefield"><canvas tabindex="0" aria-label="ساحة المعركة ثلاثية الأبعاد"></canvas><div class="scene-badge">3D · WEBGL</div><span class="mobile-game-only touch-hint">اسحب للتحريك · إصبعان للتقريب والتدوير</span><button class="mobile-game-only mobile-placement" data-game="place-touch">تأكيد البناء المقترح</button><button class="battle-minimap" aria-label="الخريطة المصغرة: انقر لتحريك الكاميرا" title="انقر لتحريك الكاميرا، Shift لإصدار أمر للجيش المحدد"></button><div class="camera-tools" aria-label="التحكم بالكاميرا"><button data-camera="in" aria-label="تقريب الكاميرا">＋</button><button data-camera="out" aria-label="إبعاد الكاميرا">−</button><button data-camera="left" aria-label="تدوير الكاميرا لليسار">↶</button><button data-camera="right" aria-label="تدوير الكاميرا لليمين">↷</button><button data-camera="focus" aria-label="التركيز على الجيش">◎</button><button data-camera="home" aria-label="إعادة ضبط الكاميرا">⌂</button></div><div class="rts-result hidden" role="status"></div></div>
    <aside class="rts-panel" id="game-commands"><button class="mobile-game-only" data-game="multiselect" aria-pressed="false">تحديد متعدد باللمس</button><div class="map-preview"></div><div class="rts-mission"><span></span><h2></h2><p></p></div><h3>إنشاء مبانٍ</h3><div class="build-buttons"></div><button data-game="autoplace">بناء في مكان مقترح</button><div class="mission-objective"></div><p class="selected-logistics"></p><button data-game="service">عودة للصيانة والتسليح</button><h3>تدريب الوحدات</h3><div class="train-buttons"></div><p class="rts-help">اختر مبنى ثم انقر الأرض، أو استخدم المكان المقترح. حدد الوحدات ثم انقر للتحرك أو الهجوم. عجلة الفأرة للتقريب، والزر الأوسط لتدوير الكاميرا، وإصبعان على الهاتف.</p></aside></div>
    <nav class="battle-actions" aria-label="أوامر المعركة"><button class="mobile-game-only" data-game="commands" aria-expanded="false" aria-controls="game-commands">بناء وتدريب</button><button data-game="select">تحديد الجيش</button><button data-game="attack">هجوم على مقر العدو</button><button class="mobile-game-only" data-game="maps" aria-expanded="false" aria-controls="game-maps">الخرائط والصوت</button></nav>
    <footer class="rts-footer"><span class="rts-message" role="status"></span><span>أزرق: أنت · أحمر: العدو</span></footer><p class="campaign-save" role="status"></p><p class="sound-status" role="status">الصوت متوقف حتى تضغط «تشغيل الأصوات».</p>
    <details class="rts-instructions"><summary>طريقة اللعب وحفظ التقدم</summary><p>كل مرحلة لها وحداتها وساحة مختلفة. مراكز الإمداد تمنح $180 كل ٥ ثوانٍ. الثكنة والمصنع والمطار والميناء تتطلب طاقة. الغواصات تستخدم الطوربيدات ضد السفن والغواصات؛ المقاتلات لا تهاجم الغواصات. انقر وحدة لتحديدها وShift لإضافة وحدات. أكمل الهدف الموضح للمهمة للفوز وفتح زر المرحلة التالية. جميع المراحل متاحة للتجربة من القائمة. تُحفظ المعركة تلقائيًا، ويمكنك حفظها يدويًا واستعادتها بزر «استئناف آخر حفظ». تعود المحفوظة متوقفة حتى تضغط متابعة. ضباب الحرب يخفي العدو حتى تستكشفه؛ الوحدات تحتاج ذخيرة ويمكن إعادتها للصيانة والتسليح قرب القاعدة. اللعبة أصلية ولا تستخدم ملفات Generals.</p></details></div>`;
  const canvas = content.querySelector("canvas"),
    message = content.querySelector(".rts-message"),
    result = content.querySelector(".rts-result"),
    select = content.querySelector('[aria-label="اختيار المرحلة"]');
  const mapSelect = content.querySelector('[aria-label="اختيار الخريطة"]'),
    minimap = content.querySelector(".battle-minimap");
  let multiSelect = false;
  const shell = content.querySelector(".rts-app");
  function drawer(kind) {
    const shouldOpen = !shell.classList.contains(`${kind}-open`);
    shell.classList.remove("commands-open", "maps-open");
    if (shouldOpen) shell.classList.add(`${kind}-open`);
    syncDrawers();
  }
  function syncDrawers() {
    for (const kind of ["commands", "maps"])
      content
        .querySelector(`[data-game="${kind}"]`)
        .setAttribute(
          "aria-expanded",
          String(shell.classList.contains(`${kind}-open`)),
        );
  }
  content.querySelector('[data-game="commands"]').onclick = () =>
    drawer("commands");
  content.querySelector('[data-game="maps"]').onclick = () => drawer("maps");
  content.querySelector('[data-game="multiselect"]').onclick = (event) => {
    multiSelect = !multiSelect;
    event.currentTarget.setAttribute("aria-pressed", String(multiSelect));
  };
  content.querySelector('[aria-label="مستوى الصوت للجوال"]').oninput = (
    event,
  ) => {
    audio.setVolume(Number(event.target.value) / 100);
    content.querySelector('[aria-label="مستوى صوت اللعبة"]').value =
      event.target.value;
  };
  content.querySelector('[data-game="place-touch"]').onclick = () =>
    content.querySelector('[data-game="autoplace"]').click();
  let availableSave = readBattle(storage);
  let lastAuto = 0;
  const missionSelect = content.querySelector('[aria-label="نوع المهمة"]'),
    difficultySelect = content.querySelector('[aria-label="مستوى الصعوبة"]');
  function persist(automatic = false) {
    if (network) return;
    if (!battle) return;
    try {
      saveBattle(storage, battle, automatic ? BATTLE_AUTO : undefined);
      availableSave = readBattle(storage);
      text(
        content.querySelector(".battle-save-status"),
        automatic ? "حُفظت المعركة تلقائيًا" : "تم حفظ المعركة ✓",
      );
    } catch {
      text(
        content.querySelector(".battle-save-status"),
        "تعذّر حفظ المعركة. التخزين ممتلئ أو غير متاح.",
      );
    }
  }
  let networkUI;
  let tacticalUI,
    orderIntent = null,
    qualityChoice = "auto";
  try {
    qualityChoice = storage.getItem("myos-quality-v1") || "auto";
  } catch {}
  let battle,
    view,
    building = null,
    last = 0,
    lastHud = 0,
    animation,
    stopped = false,
    recorded = false,
    graphicsFailed = false;
  const text = (element, value) => {
    if (element.textContent !== value) element.textContent = value;
  };
  function saveProgress() {
    if (network) return;
    content.querySelector(".campaign-save").removeAttribute("data-error");
    try {
      storage.setItem("myos-campaign-v1", JSON.stringify(progress));
      text(
        content.querySelector(".campaign-save"),
        "المراحل المكتملة محفوظة على هذا المتصفح",
      );
    } catch {
      content.querySelector(".campaign-save").dataset.error = "true";
      text(
        content.querySelector(".campaign-save"),
        "تعذّر حفظ تقدم المراحل: التخزين المحلي غير متاح أو ممتلئ",
      );
    }
  }
  function refresh() {
    tacticalUI?.refresh();
    content.querySelector('[data-game="resume"]').disabled =
      !availableSave || availableSave.status !== "playing";
    content
      .querySelector('[data-game="fog"]')
      .setAttribute("aria-pressed", String(battle.fog));
    text(content.querySelector(".mission-objective"), missionStatus(battle));
    const squad = battle.entities.filter(
      (e) => battle.selected.has(e.id) && e.maxAmmo,
    );
    text(
      content.querySelector(".selected-logistics"),
      squad.length
        ? `ذخيرة المحدد: ${squad.reduce((n, e) => n + e.ammo, 0)}/${squad.reduce((n, e) => n + e.maxAmmo, 0)} · الصيانة قرب القاعدة`
        : "اختر وحدات لعرض الذخيرة والصيانة",
    );
    const soundButton = content.querySelector('[data-sound="toggle"]');
    text(soundButton, audio.enabled ? "كتم الأصوات" : "تشغيل الأصوات");
    soundButton.setAttribute(
      "aria-label",
      audio.enabled ? "كتم الأصوات" : "تشغيل الأصوات",
    );
    shell.classList.toggle("is-placing", Boolean(building));
    content
      .querySelector('[data-game="pause"]')
      .setAttribute("aria-label", battle.paused ? "متابعة" : "إيقاف مؤقت");
    content
      .querySelector('[data-game="pause"]')
      .setAttribute("aria-pressed", String(battle.paused));
    content.querySelector('[data-stat="wave"]').dataset.short =
      `${battle.wave}/${battle.stage.waves} · ${Math.max(0, Math.ceil(battle.nextWave - battle.time))}ث`;
    soundButton.setAttribute("aria-pressed", String(audio.enabled));
    soundButton.dataset.audioState = audio.context?.state || "not-started";
    minimap.innerHTML = mapSvg(
      battle.map,
      battle.entities.filter((e) => battle.isVisible(e)),
      battle.selected,
      view?.cameraTarget(),
    );
    text(content.querySelector('[data-stat="cash"]'), `$${battle.cash}`);
    text(
      content.querySelector('[data-stat="wave"]'),
      `موجة ${battle.wave}/${battle.stage.waves} · ${battle.wave < battle.stage.waves ? Math.max(0, Math.ceil(battle.nextWave - battle.time)) + "ث" : "الموجة الأخيرة"}`,
    );
    text(
      content.querySelector('[data-stat="army"]'),
      `الجيش ${battle.entities.filter((e) => e.team === "blue" && e.speed).length} · المحدد ${battle.selected.size}`,
    );
    text(
      message,
      graphicsFailed
        ? "تعذّر تشغيل WebGL. فعّل تسريع الرسومات أو جرّب متصفحًا حديثًا."
        : building
          ? `بناء ${TYPES[building].name}: اختر موقعًا أو اضغط «بناء في مكان مقترح» · Escape للإلغاء`
          : battle.message,
    );
    text(
      content.querySelector('[data-game="pause"]'),
      battle.paused ? "متابعة" : "إيقاف مؤقت",
    );
    const ended = battle.status !== "playing";
    result.classList.toggle(
      "hidden",
      !ended && !battle.paused && !graphicsFailed,
    );
    text(
      result,
      graphicsFailed
        ? "الرسومات ثلاثية الأبعاد غير متاحة على هذا المتصفح"
        : ended
          ? battle.status === "won"
            ? "انتصار — اكتملت المرحلة"
            : "انتهت المهمة — لم تتحقق الأهداف"
          : "المهمة متوقفة مؤقتًا",
    );
    for (const button of content.querySelectorAll(
      "[data-build],[data-train]",
    )) {
      const type = button.dataset.build || button.dataset.train,
        spec = TYPES[type];
      button.disabled =
        graphicsFailed ||
        ended ||
        battle.paused ||
        battle.cash < spec.cost ||
        Boolean(spec.needs && !battle.has(spec.needs)) ||
        Boolean(spec.speed && !battle.has("power"));
      button.setAttribute("aria-pressed", String(building === type));
    }
    content.querySelector('[data-game="autoplace"]').disabled =
      !building || ended || battle.paused || graphicsFailed;
    content.querySelector('[data-game="next"]').disabled =
      battle.status !== "won" ||
      (!battle.operationId && battle.stageIndex === STAGES.length - 1);
    text(
      content.querySelector(".campaign-progress"),
      `مراحل مكتملة: ${progress.completed.length}/${STAGES.length}`,
    );
    if (!network && battle.status === "won" && !recorded) {
      recorded = true;
      if (!progress.completed.includes(battle.stageIndex))
        progress.completed.push(battle.stageIndex);
      saveProgress();
    }
    networkUI?.hud();
  }
  function start(index, mapId = chosenMaps[index], restored = null, run = {}) {
    audio.setActive(false);
    audio.sonar = 0;
    view?.dispose();
    view = null;
    battle =
      restored ||
      new Battle(index, mapId, {
        mission: missionSelect.value,
        difficulty: difficultySelect.value,
        ...run,
      });
    lastAuto = battle.time;
    missionSelect.innerHTML = MISSIONS.filter((m) => m.stages.includes(index))
      .map((m) => `<option value="${m.id}">${m.name}</option>`)
      .join("");
    missionSelect.value = battle.mission.id;
    difficultySelect.value = battle.difficulty;
    chosenMaps[index] = battle.map.id;
    try {
      if (!network)
        storage.setItem("myos-map-choice-v1", JSON.stringify(chosenMaps));
    } catch {
      /* Map is usable without persistence. */
    }
    mapSelect.innerHTML = MAPS.filter((m) => m.stage === index)
      .map((m) => `<option value="${m.id}">${m.name}</option>`)
      .join("");
    mapSelect.value = battle.map.id;
    content.querySelector(".map-preview").innerHTML =
      mapSvg(battle.map) +
      `<strong>${battle.map.name}</strong><p>${battle.map.description}</p>`;
    building = null;
    orderIntent = null;
    last = 0;
    recorded = false;
    graphicsFailed = false;
    progress.stage = index;
    select.value = String(index);
    saveProgress();
    content.querySelector(".rts-mission>span").textContent =
      battle.stage.category;
    content.querySelector(".rts-mission h2").textContent = battle.stage.name;
    content.querySelector(".rts-mission p").textContent =
      battle.mission.description;
    content.querySelector(".build-buttons").innerHTML = battle.stage.buildings
      .map(
        (t) =>
          `<button data-build="${t}"><span>${TYPES[t].name}</span><small>$${TYPES[t].cost}</small></button>`,
      )
      .join("");
    content.querySelector(".train-buttons").innerHTML = battle.stage.units
      .map(
        (t) =>
          `<button data-train="${t}">${TYPES[t].name}<small>$${TYPES[t].cost}</small></button>`,
      )
      .join("");
    content.querySelectorAll("[data-build]").forEach(
      (b) =>
        (b.onclick = () => {
          building = building === b.dataset.build ? null : b.dataset.build;
          if (matchMedia(COMPACT_QUERY).matches) {
            shell.classList.remove("commands-open");
            syncDrawers();
          }
          refresh();
        }),
    );
    content.querySelectorAll("[data-train]").forEach(
      (b) =>
        (b.onclick = () => {
          battle.purchase(b.dataset.train);
          refresh();
        }),
    );
    try {
      view = createBattleScene(canvas, battle.stage, battle.map, {
        quality: qualityChoice,
      });
      view.draw(battle);
      canvas.dataset.renderer = "webgl";
    } catch (error) {
      graphicsFailed = true;
      battle.paused = true;
      canvas.dataset.renderer = "unavailable";
      console.warn("3D renderer unavailable:", error.message);
    }
    refresh();
  }
  missionSelect.onchange = () => start(battle.stageIndex, battle.map.id);
  difficultySelect.onchange = () => start(battle.stageIndex, battle.map.id);
  content.querySelector('[data-game="save"]').onclick = () => persist(false);
  content.querySelector('[data-game="resume"]').onclick = () => {
    try {
      const snapshot = readBattle(storage);
      if (!snapshot) throw Error();
      const restored = restoreBattle(snapshot);
      start(restored.stageIndex, restored.map.id, restored);
      text(
        content.querySelector(".battle-save-status"),
        "استُعيدت المعركة. اضغط متابعة للعب.",
      );
    } catch {
      text(
        content.querySelector(".battle-save-status"),
        "تعذّر قراءة الحفظ؛ ابدأ مهمة جديدة.",
      );
    }
  };
  content.querySelector('[data-game="fog"]').onclick = () => {
    battle.fog = !battle.fog;
    refresh();
  };
  content.querySelector('[data-game="service"]').onclick = () => {
    battle.serviceSelected();
    refresh();
  };
  const saveOnLeave = () => persist(true);
  window.addEventListener("pagehide", saveOnLeave);
  window.addEventListener("myos:flush-data", saveOnLeave);
  mapSelect.onchange = () => {
    start(battle.stageIndex, mapSelect.value);
    shell.classList.remove("maps-open");
    syncDrawers();
  };
  content.querySelector('[data-sound="toggle"]').onclick = async () => {
    const status = content.querySelector(".sound-status");
    status.removeAttribute("data-error");
    try {
      if (audio.enabled) {
        audio.mute();
        status.textContent = "تم كتم الأصوات";
      } else {
        await audio.enable();
        audio.setActive(!battle.paused && battle.status === "playing");
        audio.play("order");
        status.textContent =
          "المؤثرات الصوتية مفعّلة: أسلحة وانفجارات ومحركات وأمواج وسونار";
      }
    } catch (error) {
      status.dataset.error = "true";
      status.textContent = error.message;
    }
    refresh();
  };
  content.querySelector('[aria-label="مستوى صوت اللعبة"]').oninput = (
    event,
  ) => {
    audio.setVolume(Number(event.target.value) / 100);
    content.querySelector('[aria-label="مستوى الصوت للجوال"]').value =
      event.target.value;
  };
  minimap.onclick = (event) => {
    if (!view) return;
    const rect = minimap.querySelector("svg").getBoundingClientRect(),
      x = ((event.clientX - rect.left) / rect.width) * 1000,
      y = ((event.clientY - rect.top) / rect.height) * 620;
    if (event.shiftKey) battle.command(x, y);
    else view.focusPoint(x, y);
    refresh();
  };
  const silence = () => {
    if (
      document.hidden ||
      content.closest(".window").classList.contains("hidden") ||
      !document.querySelector("#lock-screen").classList.contains("hidden")
    ) {
      audio.setActive(false);
      persist(true);
    }
  };
  document.addEventListener("visibilitychange", silence);
  const visibilityObserver = new MutationObserver(silence);
  visibilityObserver.observe(content.closest(".window"), {
    attributes: true,
    attributeFilter: ["class"],
  });
  visibilityObserver.observe(document.querySelector("#lock-screen"), {
    attributes: true,
    attributeFilter: ["class"],
  });
  select.onchange = () => start(Number(select.value));
  content.querySelector('[data-game="restart"]').onclick = () => {
    if (battle.operationId) tacticalUI.restart();
    else start(battle.stageIndex);
  };
  content.querySelector('[data-game="next"]').onclick = () => {
    if (battle.status === "won" && battle.operationId) {
      tacticalUI.advance();
      return;
    }
    if (battle.status === "won" && battle.stageIndex < 3)
      start(battle.stageIndex + 1);
  };
  content.querySelector('[data-game="pause"]').onclick = () => {
    if (battle.status === "playing" && !graphicsFailed)
      battle.paused = !battle.paused;
    refresh();
  };
  content.querySelector('[data-game="select"]').onclick = () => {
    building = null;
    battle.selectAll();
    refresh();
  };
  content.querySelector('[data-game="attack"]').onclick = () => {
    building = null;
    const hq = battle.entities.find((e) => e.type === "hq" && e.team === "red");
    if (!hq && network) {
      battle.message = "استكشف موقع مقر الخصم قبل الهجوم عليه";
      refresh();
      return;
    }
    if (hq) {
      battle.commandMode = "move";
      battle.command(hq.x, hq.y);
    }
    refresh();
  };
  content.querySelector('[data-game="autoplace"]').onclick = () => {
    if (!building) return;
    if (network) {
      networkUI.request({ kind: "autoBuild", unit: building });
      building = null;
      refresh();
      return;
    }
    const ys =
      building === "harbor"
        ? [235, 250]
        : battle.stageIndex >= 2
          ? [75, 160]
          : [150, 450, 75, 530, 240];
    for (const y of ys)
      for (const x of [320, 440, 240, 510, 90])
        if (battle.purchase(building, x, y)) {
          building = null;
          refresh();
          return;
        }
    refresh();
  };
  for (const button of content.querySelectorAll("[data-camera]"))
    button.onclick = () => {
      const action = button.dataset.camera;
      if (action === "focus")
        view?.focus(
          battle.entities.filter(
            (e) =>
              e.team === "blue" &&
              e.speed &&
              (battle.selected.size ? battle.selected.has(e.id) : true),
          ),
        );
      else if (action === "home") view?.home();
      else if (action === "in" || action === "out")
        view?.zoom(action === "in" ? 0.83 : 1.2);
      else view?.rotate(action === "left" ? -0.3 : 0.3);
    };
  canvas.onpointerdown = (event) => {
    if (
      event.button === 1 ||
      battle.paused ||
      battle.status !== "playing" ||
      !view
    )
      return;
    if (event.pointerType === "touch") return;
    interact(event);
  };
  let touchStart,
    touchGesture = false,
    touchDragged = false,
    previousTouch = null;
  const fingers = new Set();
  canvas.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch") {
      fingers.add(event.pointerId);
      if (fingers.size === 1) {
        touchDragged = false;
        previousTouch = { x: event.clientX, y: event.clientY };
      }
      if (fingers.size > 1) touchGesture = true;
      touchStart = {
        x: event.clientX,
        y: event.clientY,
        id: event.pointerId,
        time: performance.now(),
      };
    }
  });
  canvas.onpointermove = (event) => {
    if (
      event.pointerType !== "touch" ||
      fingers.size !== 1 ||
      touchGesture ||
      !touchStart ||
      !previousTouch
    )
      return;
    if (
      Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) > 8
    )
      touchDragged = true;
    if (touchDragged) {
      view?.panPixels(
        event.clientX - previousTouch.x,
        event.clientY - previousTouch.y,
      );
      event.preventDefault();
    }
    previousTouch = { x: event.clientX, y: event.clientY };
  };
  canvas.onpointerup = (event) => {
    if (
      event.pointerType === "touch" &&
      !touchGesture &&
      !touchDragged &&
      touchStart?.id === event.pointerId &&
      Math.hypot(event.clientX - touchStart.x, event.clientY - touchStart.y) <
        8 &&
      performance.now() - touchStart.time < 700
    )
      interact(event);
    fingers.delete(event.pointerId);
    if (fingers.size === 0) touchGesture = false;
    touchStart = null;
  };
  canvas.onpointercancel = (event) => {
    fingers.delete(event.pointerId);
    if (fingers.size === 0) touchGesture = false;
    touchStart = null;
  };
  function interact(event) {
    if (battle.paused || battle.status !== "playing" || !view) return;
    event.preventDefault();
    const point = view.pick(event);
    if (!point) return;
    if (orderIntent === "rally") {
      if (network) {
        networkUI.request({ kind: "rally", x: point.x, y: point.y });
        orderIntent = null;
        refresh();
        return;
      }
      battle.rally = {
        x: Math.max(25, Math.min(975, point.x)),
        y: Math.max(25, Math.min(595, point.y)),
      };
      orderIntent = null;
      battle.message =
        "نُقلت نقطة تجمع الجيش؛ يمكن تحريك الكاميرا إليها من العلم الأخضر";
      refresh();
      return;
    }
    if (orderIntent === "relocate") {
      if (tacticalUI.point(point.x, point.y)) orderIntent = null;
      refresh();
      return;
    }
    if (building) {
      if (battle.purchase(building, point.x, point.y)) building = null;
    } else {
      const entity = battle.entities.find((e) => e.id === point.entityId);
      if (event.button !== 2 && entity?.team === "blue" && entity.speed) {
        if (!event.shiftKey && !multiSelect) battle.selected.clear();
        if (multiSelect && battle.selected.has(entity.id))
          battle.selected.delete(entity.id);
        else battle.selected.add(entity.id);
      } else if (battle.selected.size) battle.command(point.x, point.y);
      else battle.selectAt(point.x, point.y, event.shiftKey);
    }
    refresh();
  }
  canvas.oncontextmenu = (e) => e.preventDefault();
  content.onkeydown = (e) => {
    if (tacticalUI?.key(e)) return;
    if (e.key === "Escape") {
      building = null;
      orderIntent = null;
      shell.classList.remove("maps-open", "commands-open");
      syncDrawers();
      refresh();
    }
  };
  const lost = (event) => {
    event.preventDefault();
    graphicsFailed = true;
    battle.paused = true;
    refresh();
  };
  canvas.addEventListener("webglcontextlost", lost);
  function frame(time) {
    if (stopped) return;
    const dt = last ? Math.min((time - last) / 1000, 0.08) : 0;
    last = time;
    const visible =
      !document.hidden &&
      !content.closest(".window").classList.contains("hidden") &&
      document.querySelector("#lock-screen").classList.contains("hidden");
    if (visible && !graphicsFailed && !network) battle.update(dt);
    if (network) networkUI?.frame(time);
    const events = battle.takeEvents();
    audio.update(battle, events, visible && !graphicsFailed);
    view?.effects(events);
    if (visible) view?.draw(battle);
    if (battle.status === "playing" && battle.time - lastAuto >= 10) {
      lastAuto = battle.time;
      persist(true);
    }
    if (time - lastHud > 150) {
      refresh();
      lastHud = time;
    }
    animation = requestAnimationFrame(frame);
  }
  tacticalUI = setupCommandCenter(content, {
    getBattle: () => battle,
    start,
    storage,
    refresh,
    arm: (value) => {
      orderIntent = value;
      building = null;
    },
  });
  const qualitySelect = content.querySelector('[aria-label="جودة الرسومات"]');
  qualitySelect.value = ["auto", "low", "medium", "high"].includes(
    qualityChoice,
  )
    ? qualityChoice
    : "auto";
  qualitySelect.onchange = () => {
    qualityChoice = qualitySelect.value;
    view?.setQuality(qualityChoice);
    try {
      storage.setItem("myos-quality-v1", qualityChoice);
    } catch {
      battle.message = "تغيّرت الجودة؛ تعذّر حفظ التفضيل";
    }
  };
  if (network)
    networkUI = bindNetworkGame(content, network, {
      getBattle: () => battle,
      refresh,
      onBattle: (next, initial) => {
        if (initial) start(next.stageIndex, next.map.id, next);
        else battle = next;
      },
    });
  else start(progress.stage);
  if (availableSave && !network)
    text(
      content.querySelector(".battle-save-status"),
      "توجد معركة محفوظة؛ اضغط استئناف آخر حفظ لمتابعتها.",
    );
  animation = requestAnimationFrame(frame);
  return () => {
    persist(true);
    window.removeEventListener("pagehide", saveOnLeave);
    window.removeEventListener("myos:flush-data", saveOnLeave);
    networkUI?.close();
    stopped = true;
    audio.dispose().catch(() => {});
    document.removeEventListener("visibilitychange", silence);
    visibilityObserver.disconnect();
    cancelAnimationFrame(animation);
    canvas.removeEventListener("webglcontextlost", lost);
    view?.dispose(true);
    content.onkeydown = null;
    canvas.onpointerdown = null;
    canvas.onpointermove = null;
    canvas.onpointerup = null;
    canvas.onpointercancel = null;
  };
}

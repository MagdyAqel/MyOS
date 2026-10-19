import { test } from "node:test";
import assert from "node:assert/strict";
import {
  loadNotebook,
  persistNotebook,
  NOTEBOOK_KEY,
} from "../src/notebook.js";
import { loadCampaign } from "../src/campaign.js";
const store = (entries) => {
  const map = new Map(entries);
  return {
    getItem: (key) => map.get(key) || null,
    setItem: (key, value) => map.set(key, value),
  };
};
test("legacy note is migrated, and multiple titled notes survive storage roundtrip", () => {
  const storage = store([["myos-note", "نص قديم مهم"]]);
  const { data } = loadNotebook(storage);
  assert.equal(data.notes[0].text, "نص قديم مهم");
  data.notes.push({ id: "second", title: "مشروعي", text: "ملاحظة جديدة" });
  data.activeId = "second";
  persistNotebook(storage, data);
  assert.deepEqual(loadNotebook(storage).data, data);
  assert.equal(storage.getItem("myos-note"), "نص قديم مهم");
});
test("a corrupt primary notebook recovers from its last valid backup", () => {
  const storage = store();
  const { data } = loadNotebook(storage);
  data.notes[0].text = "النسخة الأولى";
  persistNotebook(storage, data);
  data.notes[0].text = "النسخة الثانية";
  persistNotebook(storage, data);
  storage.setItem(NOTEBOOK_KEY, "{corrupt");
  const recovered = loadNotebook(storage);
  assert.equal(recovered.recovered, true);
  assert.equal(recovered.data.notes[0].text, "النسخة الأولى");
});
test("failed storage is reported to the caller instead of claiming a save", () => {
  const storage = {
    getItem: () => null,
    setItem: () => {
      throw Error("QuotaExceeded");
    },
  };
  assert.throws(
    () => persistNotebook(storage, loadNotebook(storage).data),
    /QuotaExceeded/,
  );
});
test("campaign state rejects corrupt indices and duplicate achievements", () => {
  const storage = store([
    [
      "myos-campaign-v1",
      JSON.stringify({ stage: 300, completed: [0, 0, 1, -1, "2", 9] }),
    ],
  ]);
  assert.deepEqual(loadCampaign(storage), { stage: 3, completed: [0, 1] });
});

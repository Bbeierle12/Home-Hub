import { useEffect, useState } from "react";
import { Check, Plus, ShoppingBag } from "lucide-react";
import { Panel } from "../../components/Panel";
import { ScanButton } from "../../components/ScanButton";
import { parseShoppingItems } from "../../utils/ocr-parsers";
import { useAuthStore } from "../../stores/auth";
import { useShoppingStore } from "../../stores/shopping";

export function ShoppingPage() {
  const householdId = useAuthStore((state) => state.user?.household_id);
  const lists = useShoppingStore((state) => state.lists);
  const activeList = useShoppingStore((state) => state.activeList);
  const items = useShoppingStore((state) => state.items);
  const fetchLists = useShoppingStore((state) => state.fetchLists);
  const fetchListDetail = useShoppingStore((state) => state.fetchListDetail);
  const createList = useShoppingStore((state) => state.createList);
  const addItem = useShoppingStore((state) => state.addItem);
  const toggleItem = useShoppingStore((state) => state.toggleItem);
  const [listName, setListName] = useState("");
  const [itemName, setItemName] = useState("");

  useEffect(() => {
    if (householdId) {
      void fetchLists(householdId);
    }
  }, [fetchLists, householdId]);

  return (
    <div className="grid gap-6 xl:grid-cols-[320px_1fr]">
      <Panel title="Lists" eyebrow="Household">
        <label className="block">
          <span className="mb-2 block text-sm font-medium">New list</span>
          <input
            value={listName}
            onChange={(event) => setListName(event.target.value)}
            className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
          />
        </label>
        <button
          type="button"
          onClick={() => {
            if (householdId && listName.trim()) {
              void createList(householdId, listName);
              setListName("");
            }
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 font-semibold text-white"
        >
          <Plus className="size-4" />
          Create list
        </button>

        <div className="mt-6 space-y-2">
          {lists.map((list) => (
            <button
              key={list.id}
              type="button"
              onClick={() => householdId && void fetchListDetail(householdId, list.id)}
              className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                activeList?.id === list.id
                  ? "border-[color:var(--color-accent)] bg-white"
                  : "border-[color:var(--color-border)] bg-white/80 hover:bg-white"
              }`}
            >
              <p className="font-semibold">{list.name}</p>
              <p className="mt-1 text-sm text-[color:var(--color-muted)]">{list.store ?? "Shared list"}</p>
            </button>
          ))}
        </div>
      </Panel>

      <Panel title={activeList?.name ?? "Select a list"} eyebrow="Live Sync">
        {activeList ? (
          <>
            <div className="flex gap-3">
              <input
                value={itemName}
                onChange={(event) => setItemName(event.target.value)}
                placeholder="Add milk, onions, batteries..."
                className="flex-1 rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
              />
              <button
                type="button"
                onClick={() => {
                  if (householdId && activeList.id && itemName.trim()) {
                    void addItem(householdId, activeList.id, itemName);
                    setItemName("");
                  }
                }}
                className="rounded-2xl bg-[color:var(--color-accent)] px-4 py-3 font-semibold text-white"
              >
                <Plus className="size-4" />
              </button>
              <ScanButton
                compact
                parser={parseShoppingItems}
                onResult={({ items: scannedItems }) => {
                  if (householdId && activeList?.id && scannedItems?.length) {
                    for (const name of scannedItems) {
                      void addItem(householdId, activeList.id, name);
                    }
                  }
                }}
              />
            </div>

            <div className="mt-6 space-y-3">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => householdId && activeList.id && void toggleItem(householdId, activeList.id, item)}
                  className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                    item.checked
                      ? "border-[color:var(--color-border)] bg-white/70 text-[color:var(--color-muted)]"
                      : "border-[color:var(--color-border)] bg-white hover:border-[color:var(--color-accent)]"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className={`rounded-full p-2 ${item.checked ? "bg-[color:var(--color-success)]/10" : "bg-[color:var(--color-accent-soft)]"}`}>
                      {item.checked ? (
                        <Check className="size-4 text-[color:var(--color-success)]" />
                      ) : (
                        <ShoppingBag className="size-4 text-[color:var(--color-accent)]" />
                      )}
                    </div>
                    <span className={item.checked ? "line-through" : ""}>{item.name}</span>
                  </div>
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--color-muted)]">
                    {item.checked ? "done" : "open"}
                  </span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl bg-white/80 p-4 text-sm text-[color:var(--color-muted)]">
            Pick a list to view live items.
          </div>
        )}
      </Panel>
    </div>
  );
}

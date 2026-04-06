import { useEffect, useState } from "react";
import { CheckCheck, Plus } from "lucide-react";
import { Panel } from "../../components/Panel";
import { ScanButton } from "../../components/ScanButton";
import { parseTaskTitle } from "../../utils/ocr-parsers";
import { useAuthStore } from "../../stores/auth";
import { useTasksStore } from "../../stores/tasks";

export function TasksPage() {
  const householdId = useAuthStore((state) => state.user?.household_id);
  const tasks = useTasksStore((state) => state.tasks);
  const fetchTasks = useTasksStore((state) => state.fetchTasks);
  const createTask = useTasksStore((state) => state.createTask);
  const completeTask = useTasksStore((state) => state.completeTask);
  const [title, setTitle] = useState("");

  useEffect(() => {
    if (householdId) {
      void fetchTasks(householdId);
    }
  }, [fetchTasks, householdId]);

  return (
    <div className="grid gap-6 xl:grid-cols-[360px_1fr]">
      <Panel title="Add Task" eyebrow="Create">
        <div className="flex items-end gap-2">
          <label className="block flex-1">
            <span className="mb-2 block text-sm font-medium">Title</span>
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none focus:border-[color:var(--color-accent)]"
            />
          </label>
          <ScanButton compact parser={parseTaskTitle} onResult={({ title: t }) => { if (t) setTitle(t); }} />
        </div>
        <button
          type="button"
          onClick={() => {
            if (householdId && title.trim()) {
              void createTask(householdId, { title });
              setTitle("");
            }
          }}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 font-semibold text-white"
        >
          <Plus className="size-4" />
          Create task
        </button>
      </Panel>

      <Panel title="Open Tasks" eyebrow="Execution">
        <div className="space-y-3">
          {tasks.length ? (
            tasks.map((task) => (
              <button
                key={task.id}
                type="button"
                onClick={() => householdId && void completeTask(householdId, task.id)}
                className="flex w-full items-center justify-between rounded-2xl border border-[color:var(--color-border)] bg-white p-4 text-left transition hover:border-[color:var(--color-accent)]"
              >
                <div>
                  <p className="font-semibold">{task.title}</p>
                  <p className="mt-1 text-sm text-[color:var(--color-muted)]">
                    {task.priority} priority · {task.points} points
                  </p>
                </div>
                <CheckCheck className="size-4 text-[color:var(--color-success)]" />
              </button>
            ))
          ) : (
            <div className="rounded-2xl bg-white/80 p-4 text-sm text-[color:var(--color-muted)]">
              No tasks loaded yet.
            </div>
          )}
        </div>
      </Panel>
    </div>
  );
}

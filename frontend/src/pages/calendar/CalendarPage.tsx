import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
  Plus,
  Trash2,
  UtensilsCrossed,
  X,
} from "lucide-react";
import { useAuthStore } from "../../stores/auth";
import { useCalendarStore } from "../../stores/calendar";
import type { CalendarEvent, MealPlan } from "../../types/api";

// ── Date helpers ─────────────────────────────────────────────────────────────

function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}
function endOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
}
function startOfWeek(d: Date) {
  const day = d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - day);
}
function addDays(d: Date, n: number) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
function toDateStr(d: Date) {
  return d.toISOString().slice(0, 10);
}
function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}
const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MEAL_TYPE_LABELS: Record<string, string> = { breakfast: "Breakfast", lunch: "Lunch", dinner: "Dinner", snack: "Snack" };
const MEAL_TYPE_COLORS: Record<string, string> = { breakfast: "#f59e0b", lunch: "#10b981", dinner: "#8b5cf6", snack: "#ec4899" };
const EVENT_TYPE_COLORS: Record<string, string> = { event: "#3b82f6", task: "#ef4444", reminder: "#f59e0b", meal: "#10b981" };

// ── Main Component ───────────────────────────────────────────────────────────

export function CalendarPage() {
  const householdId = useAuthStore((s) => s.user?.household_id);
  const events = useCalendarStore((s) => s.events);
  const meals = useCalendarStore((s) => s.meals);
  const selectedDate = useCalendarStore((s) => s.selectedDate);
  const view = useCalendarStore((s) => s.view);
  const setView = useCalendarStore((s) => s.setView);
  const setSelectedDate = useCalendarStore((s) => s.setSelectedDate);
  const fetchEvents = useCalendarStore((s) => s.fetchEvents);
  const fetchMeals = useCalendarStore((s) => s.fetchMeals);
  const createEvent = useCalendarStore((s) => s.createEvent);
  const deleteEvent = useCalendarStore((s) => s.deleteEvent);
  const createMeal = useCalendarStore((s) => s.createMeal);
  const deleteMeal = useCalendarStore((s) => s.deleteMeal);

  const [showEventModal, setShowEventModal] = useState(false);
  const [showMealModal, setShowMealModal] = useState(false);
  const [eventForm, setEventForm] = useState({ title: "", description: "", location: "", start_at: "", end_at: "", all_day: false, color: "#3b82f6", event_type: "event" });
  const [mealForm, setMealForm] = useState({ recipe_name: "", meal_type: "dinner", notes: "", servings: "1", prep_minutes: "", recipe_url: "" });

  const current = useMemo(() => new Date(selectedDate + "T12:00:00"), [selectedDate]);

  // Compute the range to fetch based on view
  const range = useMemo(() => {
    if (view === "month") {
      const first = startOfWeek(startOfMonth(current));
      const last = addDays(startOfWeek(addDays(endOfMonth(current), 6)), 7);
      return { start: first, end: last };
    }
    if (view === "week") {
      const first = startOfWeek(current);
      return { start: first, end: addDays(first, 7) };
    }
    return { start: current, end: addDays(current, 1) };
  }, [current, view]);

  const loadData = useCallback(() => {
    if (!householdId) return;
    const s = range.start.toISOString();
    const e = range.end.toISOString();
    void fetchEvents(householdId, s, e);
    void fetchMeals(householdId, toDateStr(range.start), toDateStr(range.end));
  }, [householdId, range, fetchEvents, fetchMeals]);

  useEffect(loadData, [loadData]);

  // Navigation
  const navigate = (dir: number) => {
    const d = new Date(current);
    if (view === "month") d.setMonth(d.getMonth() + dir);
    else if (view === "week") d.setDate(d.getDate() + 7 * dir);
    else d.setDate(d.getDate() + dir);
    setSelectedDate(toDateStr(d));
  };

  const goToday = () => setSelectedDate(toDateStr(new Date()));

  // Events for a given day
  const eventsForDay = (day: Date) =>
    events.filter((e) => {
      const s = new Date(e.start_at);
      const en = new Date(e.end_at);
      return s <= addDays(day, 1) && en > day;
    });

  const mealsForDay = (day: Date) =>
    meals.filter((m) => m.date === toDateStr(day));

  // Create event
  const handleCreateEvent = async () => {
    if (!householdId || !eventForm.title.trim()) return;
    await createEvent(householdId, {
      title: eventForm.title,
      description: eventForm.description || undefined,
      location: eventForm.location || undefined,
      start_at: new Date(eventForm.start_at).toISOString(),
      end_at: new Date(eventForm.end_at).toISOString(),
      all_day: eventForm.all_day,
      color: eventForm.color,
      event_type: eventForm.event_type as CalendarEvent["event_type"],
    });
    setShowEventModal(false);
    resetEventForm();
  };

  const handleCreateMeal = async () => {
    if (!householdId || !mealForm.recipe_name.trim()) return;
    await createMeal(householdId, {
      date: selectedDate,
      meal_type: mealForm.meal_type,
      recipe_name: mealForm.recipe_name,
      notes: mealForm.notes || undefined,
      servings: Number(mealForm.servings) || 1,
      prep_minutes: mealForm.prep_minutes ? Number(mealForm.prep_minutes) : undefined,
      recipe_url: mealForm.recipe_url || undefined,
    });
    setShowMealModal(false);
    resetMealForm();
  };

  const resetEventForm = () => {
    const start = new Date(current);
    start.setHours(9, 0, 0, 0);
    const end = new Date(current);
    end.setHours(10, 0, 0, 0);
    setEventForm({ title: "", description: "", location: "", start_at: toLocalDatetime(start), end_at: toLocalDatetime(end), all_day: false, color: "#3b82f6", event_type: "event" });
  };

  const resetMealForm = () => setMealForm({ recipe_name: "", meal_type: "dinner", notes: "", servings: "1", prep_minutes: "", recipe_url: "" });

  const openEventModal = () => { resetEventForm(); setShowEventModal(true); };
  const openMealModal = () => { resetMealForm(); setShowMealModal(true); };

  const isToday = isSameDay(current, new Date());

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] px-6 py-4 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="rounded-xl border border-[color:var(--color-border)] p-2 hover:bg-white/70"><ChevronLeft className="size-4" /></button>
          <button type="button" onClick={() => navigate(1)} className="rounded-xl border border-[color:var(--color-border)] p-2 hover:bg-white/70"><ChevronRight className="size-4" /></button>
          <h2 className="text-xl font-bold">
            {view === "month" && `${MONTH_NAMES[current.getMonth()]} ${current.getFullYear()}`}
            {view === "week" && `Week of ${current.toLocaleDateString()}`}
            {view === "day" && current.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
          </h2>
          {!isToday && <button type="button" onClick={goToday} className="rounded-xl border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-medium hover:bg-white/70">Today</button>}
        </div>
        <div className="flex items-center gap-2">
          {(["month", "week", "day"] as const).map((v) => (
            <button key={v} type="button" onClick={() => setView(v)} className={`rounded-xl px-3 py-1.5 text-sm font-medium capitalize ${view === v ? "bg-[color:var(--color-ink)] text-white" : "border border-[color:var(--color-border)] hover:bg-white/70"}`}>{v}</button>
          ))}
          <button type="button" onClick={openEventModal} className="flex items-center gap-1 rounded-xl bg-[color:var(--color-ink)] px-3 py-1.5 text-sm font-medium text-white"><Plus className="size-3.5" /> Event</button>
          <button type="button" onClick={openMealModal} className="flex items-center gap-1 rounded-xl border border-[color:var(--color-border)] px-3 py-1.5 text-sm font-medium hover:bg-white/70"><UtensilsCrossed className="size-3.5" /> Meal</button>
        </div>
      </div>

      {/* Calendar body */}
      {view === "month" && <MonthView current={current} eventsForDay={eventsForDay} mealsForDay={mealsForDay} selectedDate={selectedDate} onSelectDate={(d) => { setSelectedDate(d); setView("day"); }} />}
      {view === "week" && <WeekView current={current} eventsForDay={eventsForDay} mealsForDay={mealsForDay} onSelectDate={(d) => { setSelectedDate(d); setView("day"); }} />}
      {view === "day" && <DayView current={current} events={eventsForDay(current)} meals={mealsForDay(current)} householdId={householdId} deleteEvent={deleteEvent} deleteMeal={deleteMeal} />}

      {/* Event Modal */}
      {showEventModal && (
        <Modal onClose={() => setShowEventModal(false)} title="New Event">
          <div className="space-y-3">
            <input value={eventForm.title} onChange={(e) => setEventForm({ ...eventForm, title: e.target.value })} placeholder="Event title" className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none" />
            <textarea value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} placeholder="Description (optional)" rows={2} className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none" />
            <input value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} placeholder="Location (optional)" className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none" />
            <div className="grid grid-cols-2 gap-3">
              <label className="block"><span className="mb-1 block text-xs font-medium">Start</span><input type="datetime-local" value={eventForm.start_at} onChange={(e) => setEventForm({ ...eventForm, start_at: e.target.value })} className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none" /></label>
              <label className="block"><span className="mb-1 block text-xs font-medium">End</span><input type="datetime-local" value={eventForm.end_at} onChange={(e) => setEventForm({ ...eventForm, end_at: e.target.value })} className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none" /></label>
            </div>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={eventForm.all_day} onChange={(e) => setEventForm({ ...eventForm, all_day: e.target.checked })} /> All day</label>
              <select value={eventForm.event_type} onChange={(e) => setEventForm({ ...eventForm, event_type: e.target.value })} className="rounded-2xl border border-[color:var(--color-border)] bg-white px-3 py-2 text-sm outline-none">
                <option value="event">Event</option>
                <option value="task">Task</option>
                <option value="reminder">Reminder</option>
              </select>
              <input type="color" value={eventForm.color} onChange={(e) => setEventForm({ ...eventForm, color: e.target.value })} className="size-9 cursor-pointer rounded-xl border border-[color:var(--color-border)]" />
            </div>
            <button type="button" onClick={() => void handleCreateEvent()} className="w-full rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 font-semibold text-white">Create Event</button>
          </div>
        </Modal>
      )}

      {/* Meal Modal */}
      {showMealModal && (
        <Modal onClose={() => setShowMealModal(false)} title={`Plan Meal — ${current.toLocaleDateString()}`}>
          <div className="space-y-3">
            <input value={mealForm.recipe_name} onChange={(e) => setMealForm({ ...mealForm, recipe_name: e.target.value })} placeholder="Recipe / Meal name" className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none" />
            <div className="grid grid-cols-3 gap-3">
              <select value={mealForm.meal_type} onChange={(e) => setMealForm({ ...mealForm, meal_type: e.target.value })} className="rounded-2xl border border-[color:var(--color-border)] bg-white px-3 py-3 text-sm outline-none">
                <option value="breakfast">Breakfast</option>
                <option value="lunch">Lunch</option>
                <option value="dinner">Dinner</option>
                <option value="snack">Snack</option>
              </select>
              <input type="number" value={mealForm.servings} onChange={(e) => setMealForm({ ...mealForm, servings: e.target.value })} placeholder="Servings" min="1" className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none" />
              <input type="number" value={mealForm.prep_minutes} onChange={(e) => setMealForm({ ...mealForm, prep_minutes: e.target.value })} placeholder="Prep (min)" min="0" className="rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none" />
            </div>
            <input value={mealForm.recipe_url} onChange={(e) => setMealForm({ ...mealForm, recipe_url: e.target.value })} placeholder="Recipe URL (optional)" className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none" />
            <textarea value={mealForm.notes} onChange={(e) => setMealForm({ ...mealForm, notes: e.target.value })} placeholder="Notes (optional)" rows={2} className="w-full rounded-2xl border border-[color:var(--color-border)] bg-white px-4 py-3 outline-none" />
            <button type="button" onClick={() => void handleCreateMeal()} className="w-full rounded-2xl bg-[color:var(--color-ink)] px-4 py-3 font-semibold text-white">Plan Meal</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ── Sub-Components ───────────────────────────────────────────────────────────

function Modal({ onClose, title, children }: { onClose: () => void; title: string; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-lg rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-bold">{title}</h3>
          <button type="button" onClick={onClose} className="rounded-xl p-1 hover:bg-white/70"><X className="size-5" /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function MonthView({ current, eventsForDay, mealsForDay, selectedDate, onSelectDate }: {
  current: Date;
  eventsForDay: (d: Date) => CalendarEvent[];
  mealsForDay: (d: Date) => MealPlan[];
  selectedDate: string;
  onSelectDate: (d: string) => void;
}) {
  const firstDay = startOfWeek(startOfMonth(current));
  const weeks: Date[][] = [];
  let day = firstDay;
  for (let w = 0; w < 6; w++) {
    const week: Date[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(new Date(day));
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const todayStr = toDateStr(new Date());

  return (
    <div className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] shadow-[0_24px_80px_rgba(31,42,34,0.08)] overflow-hidden">
      <div className="grid grid-cols-7 border-b border-[color:var(--color-border)]">
        {DAY_NAMES.map((d) => <div key={d} className="px-2 py-2 text-center text-xs font-semibold uppercase text-[color:var(--color-muted)]">{d}</div>)}
      </div>
      {weeks.map((week, wi) => (
        <div key={wi} className="grid grid-cols-7 border-b border-[color:var(--color-border)] last:border-b-0">
          {week.map((d) => {
            const ds = toDateStr(d);
            const isCurrentMonth = d.getMonth() === current.getMonth();
            const isSelected = ds === selectedDate;
            const dayEvents = eventsForDay(d);
            const dayMeals = mealsForDay(d);
            const isT = ds === todayStr;

            return (
              <button
                key={ds}
                type="button"
                onClick={() => onSelectDate(ds)}
                className={`min-h-[90px] border-r border-[color:var(--color-border)] p-1.5 text-left last:border-r-0 transition hover:bg-[color:var(--color-accent-soft)]/30 ${!isCurrentMonth ? "opacity-40" : ""} ${isSelected ? "bg-[color:var(--color-accent-soft)]/50" : ""}`}
              >
                <span className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-medium ${isT ? "bg-[color:var(--color-ink)] text-white" : ""}`}>
                  {d.getDate()}
                </span>
                <div className="mt-0.5 space-y-0.5">
                  {dayEvents.slice(0, 2).map((e) => (
                    <div key={e.id} className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: e.color }}>
                      {e.title}
                    </div>
                  ))}
                  {dayMeals.slice(0, 2).map((m) => (
                    <div key={m.id} className="truncate rounded px-1 py-0.5 text-[10px] font-medium text-white" style={{ backgroundColor: MEAL_TYPE_COLORS[m.meal_type] ?? "#3b82f6" }}>
                      {m.recipe_name}
                    </div>
                  ))}
                  {dayEvents.length + dayMeals.length > 4 && (
                    <div className="text-[10px] text-[color:var(--color-muted)]">+{dayEvents.length + dayMeals.length - 4} more</div>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}

function WeekView({ current, eventsForDay, mealsForDay, onSelectDate }: {
  current: Date;
  eventsForDay: (d: Date) => CalendarEvent[];
  mealsForDay: (d: Date) => MealPlan[];
  onSelectDate: (d: string) => void;
}) {
  const first = startOfWeek(current);
  const days = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const todayStr = toDateStr(new Date());

  return (
    <div className="grid grid-cols-7 gap-2">
      {days.map((d) => {
        const ds = toDateStr(d);
        const dayEvents = eventsForDay(d);
        const dayMeals = mealsForDay(d);
        const isT = ds === todayStr;

        return (
          <div key={ds} className={`rounded-[20px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-3 shadow-sm ${isT ? "ring-2 ring-[color:var(--color-accent)]" : ""}`}>
            <button type="button" onClick={() => onSelectDate(ds)} className="mb-2 text-center w-full">
              <div className="text-xs font-semibold uppercase text-[color:var(--color-muted)]">{DAY_NAMES[d.getDay()]}</div>
              <div className={`mx-auto mt-1 flex size-8 items-center justify-center rounded-full text-sm font-bold ${isT ? "bg-[color:var(--color-ink)] text-white" : ""}`}>{d.getDate()}</div>
            </button>
            <div className="space-y-1">
              {dayEvents.map((e) => (
                <div key={e.id} className="truncate rounded-lg px-2 py-1 text-[11px] font-medium text-white" style={{ backgroundColor: e.color }}>
                  {!e.all_day && <span className="mr-1 opacity-80">{formatTime(e.start_at)}</span>}
                  {e.title}
                </div>
              ))}
              {dayMeals.map((m) => (
                <div key={m.id} className="truncate rounded-lg px-2 py-1 text-[11px] font-medium text-white" style={{ backgroundColor: MEAL_TYPE_COLORS[m.meal_type] ?? "#3b82f6" }}>
                  {MEAL_TYPE_LABELS[m.meal_type]}: {m.recipe_name}
                </div>
              ))}
              {dayEvents.length + dayMeals.length === 0 && (
                <div className="py-2 text-center text-[11px] text-[color:var(--color-muted)]">No events</div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DayView({ current, events, meals, householdId, deleteEvent, deleteMeal }: {
  current: Date;
  events: CalendarEvent[];
  meals: MealPlan[];
  householdId: string | null | undefined;
  deleteEvent: (hid: string, eid: string) => Promise<void>;
  deleteMeal: (hid: string, mid: string) => Promise<void>;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      {/* Events */}
      <section className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
        <div className="flex items-center gap-2">
          <CalendarIcon className="size-5 text-[color:var(--color-accent)]" />
          <h3 className="text-lg font-bold">Events</h3>
        </div>
        {events.length === 0 ? (
          <p className="mt-6 text-center text-sm text-[color:var(--color-muted)]">No events today</p>
        ) : (
          <div className="mt-4 space-y-3">
            {events.map((e) => (
              <div key={e.id} className="flex items-start gap-3 rounded-2xl border border-[color:var(--color-border)] bg-white p-4">
                <div className="mt-1 size-3 shrink-0 rounded-full" style={{ backgroundColor: e.color }} />
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{e.title}</p>
                  <div className="mt-1 flex flex-wrap gap-3 text-xs text-[color:var(--color-muted)]">
                    <span className="flex items-center gap-1"><Clock className="size-3" />{e.all_day ? "All day" : `${formatTime(e.start_at)} – ${formatTime(e.end_at)}`}</span>
                    {e.location && <span className="flex items-center gap-1"><MapPin className="size-3" />{e.location}</span>}
                    <span className="rounded-full bg-[color:var(--color-accent-soft)] px-2 py-0.5 capitalize" style={{ color: EVENT_TYPE_COLORS[e.event_type] }}>{e.event_type}</span>
                  </div>
                  {e.description && <p className="mt-2 text-sm text-[color:var(--color-muted)]">{e.description}</p>}
                </div>
                <button type="button" onClick={() => householdId && void deleteEvent(householdId, e.id)} className="text-[color:var(--color-muted)] hover:text-red-600"><Trash2 className="size-4" /></button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Meals */}
      <section className="rounded-[28px] border border-[color:var(--color-border)] bg-[color:var(--color-card)] p-6 shadow-[0_24px_80px_rgba(31,42,34,0.08)]">
        <div className="flex items-center gap-2">
          <UtensilsCrossed className="size-5 text-[color:var(--color-accent)]" />
          <h3 className="text-lg font-bold">Meals</h3>
        </div>
        {meals.length === 0 ? (
          <p className="mt-6 text-center text-sm text-[color:var(--color-muted)]">No meals planned</p>
        ) : (
          <div className="mt-4 space-y-3">
            {(["breakfast", "lunch", "snack", "dinner"] as const).map((type) => {
              const typeMeals = meals.filter((m) => m.meal_type === type);
              if (typeMeals.length === 0) return null;
              return (
                <div key={type}>
                  <div className="mb-1 flex items-center gap-2">
                    <div className="size-2.5 rounded-full" style={{ backgroundColor: MEAL_TYPE_COLORS[type] }} />
                    <span className="text-xs font-semibold uppercase tracking-wider text-[color:var(--color-muted)]">{MEAL_TYPE_LABELS[type]}</span>
                  </div>
                  {typeMeals.map((m) => (
                    <div key={m.id} className="flex items-start justify-between rounded-2xl border border-[color:var(--color-border)] bg-white p-3">
                      <div>
                        <p className="font-medium">{m.recipe_name}</p>
                        <div className="mt-1 flex gap-3 text-xs text-[color:var(--color-muted)]">
                          <span>{m.servings} serving{m.servings > 1 ? "s" : ""}</span>
                          {m.prep_minutes && <span>{m.prep_minutes} min prep</span>}
                        </div>
                        {m.notes && <p className="mt-1 text-xs text-[color:var(--color-muted)]">{m.notes}</p>}
                        {m.recipe_url && <a href={m.recipe_url} target="_blank" rel="noreferrer" className="mt-1 block text-xs text-[color:var(--color-accent)] underline">View recipe</a>}
                      </div>
                      <button type="button" onClick={() => householdId && void deleteMeal(householdId, m.id)} className="text-[color:var(--color-muted)] hover:text-red-600"><Trash2 className="size-4" /></button>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

function toLocalDatetime(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

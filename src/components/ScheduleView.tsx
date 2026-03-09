import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, Clock, MapPin, User, X } from 'lucide-react';

// Types
export type Event = {
  id: string;
  title: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:MM
  location?: string;
  memberId?: string;
};

const INITIAL_EVENTS: Event[] = [
  { id: '1', title: "Leo's Soccer Practice", date: new Date().toISOString().split('T')[0], time: '16:30', location: 'City Park', memberId: '3' },
  { id: '2', title: "Family Dinner", date: new Date().toISOString().split('T')[0], time: '19:00', location: 'Home' },
];

export default function ScheduleView() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<Event[]>(INITIAL_EVENTS);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Calendar logic
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = getFirstDayOfMonth(year, month);
  
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const handleAddEvent = (event: Event) => {
    setEvents([...events, event]);
    setIsAddingEvent(false);
  };

  const openAddEvent = (dateStr?: string) => {
    setSelectedDate(dateStr || new Date().toISOString().split('T')[0]);
    setIsAddingEvent(true);
  };

  // Render calendar grid
  const renderCalendarDays = () => {
    const days = [];
    // Empty cells for days before the 1st
    for (let i = 0; i < firstDay; i++) {
      days.push(<div key={`empty-${i}`} className="min-h-[100px] p-2 border-b border-r border-stone-100 bg-stone-50/30"></div>);
    }
    
    // Actual days
    for (let i = 1; i <= daysInMonth; i++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date === dateStr).sort((a, b) => a.time.localeCompare(b.time));
      const isToday = dateStr === new Date().toISOString().split('T')[0];

      days.push(
        <div 
          key={i} 
          className={`min-h-[100px] p-2 border-b border-r border-stone-100 bg-white hover:bg-stone-50 transition-colors cursor-pointer flex flex-col group ${isToday ? 'ring-2 ring-emerald-500 ring-inset relative z-10' : ''}`}
          onClick={() => openAddEvent(dateStr)}
        >
          <div className="flex justify-between items-start mb-1">
            <span className={`text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full ${isToday ? 'bg-emerald-500 text-white' : 'text-stone-700'}`}>
              {i}
            </span>
            <button className="opacity-0 group-hover:opacity-100 p-1 text-stone-400 hover:text-emerald-600 transition-opacity">
              <Plus className="w-4 h-4" />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1 no-scrollbar">
            {dayEvents.map(event => (
              <div key={event.id} className="text-xs p-1.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-100 truncate" title={event.title}>
                <span className="font-semibold mr-1">{event.time}</span>
                {event.title}
              </div>
            ))}
          </div>
        </div>
      );
    }
    return days;
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-6xl mx-auto flex gap-6 h-[calc(100vh-8rem)]"
    >
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
              <CalendarIcon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-stone-800">Family Schedule</h2>
              <p className="text-stone-500 text-sm">Keep everyone informed and on track.</p>
            </div>
          </div>
          <button 
            onClick={() => openAddEvent()}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Event
          </button>
        </div>

        {/* Calendar Controls */}
        <div className="p-4 flex items-center justify-between border-b border-stone-100">
          <h3 className="text-xl font-semibold text-stone-800">{monthNames[month]} {year}</h3>
          <div className="flex items-center gap-2">
            <button onClick={prevMonth} className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600">
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button onClick={() => setCurrentDate(new Date())} className="px-4 py-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-sm font-medium text-stone-600">
              Today
            </button>
            <button onClick={nextMonth} className="p-2 rounded-lg border border-stone-200 hover:bg-stone-50 text-stone-600">
              <ChevronRight className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="flex-1 flex flex-col overflow-hidden bg-stone-50/30">
          <div className="grid grid-cols-7 border-b border-stone-100">
            {dayNames.map(day => (
              <div key={day} className="py-3 text-center text-xs font-semibold text-stone-500 uppercase tracking-wider border-r border-stone-100 last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-7 auto-rows-fr h-full border-l border-t border-stone-100">
              {renderCalendarDays()}
            </div>
          </div>
        </div>
      </div>

      {/* Add Event Sidebar */}
      <AnimatePresence>
        {isAddingEvent && (
          <motion.div
            initial={{ width: 0, opacity: 0, marginLeft: 0 }}
            animate={{ width: 320, opacity: 1, marginLeft: '1.5rem' }}
            exit={{ width: 0, opacity: 0, marginLeft: 0 }}
            className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden shrink-0 flex flex-col"
          >
            <EventForm 
              initialDate={selectedDate || ''}
              onClose={() => setIsAddingEvent(false)} 
              onSubmit={handleAddEvent} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function EventForm({ initialDate, onClose, onSubmit }: { initialDate: string, onClose: () => void, onSubmit: (e: Event) => void }) {
  const [formData, setFormData] = useState({
    title: '',
    date: initialDate,
    time: '12:00',
    location: '',
    memberId: ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.date || !formData.time) return;
    
    onSubmit({
      id: Math.random().toString(36).substr(2, 9),
      ...formData
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
        <h3 className="font-semibold text-stone-800">New Event</h3>
        <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-md hover:bg-stone-100">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-5">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Event Title *</label>
          <input 
            type="text" 
            required
            autoFocus
            value={formData.title} 
            onChange={e => setFormData({...formData, title: e.target.value})}
            placeholder="e.g., Dentist Appointment"
            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
          />
        </div>
        
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Date *</label>
            <input 
              type="date" 
              required
              value={formData.date} 
              onChange={e => setFormData({...formData, date: e.target.value})}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Time *</label>
            <input 
              type="time" 
              required
              value={formData.time} 
              onChange={e => setFormData({...formData, time: e.target.value})}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Location</label>
          <div className="relative">
            <MapPin className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              value={formData.location} 
              onChange={e => setFormData({...formData, location: e.target.value})}
              placeholder="Where is it?"
              className="w-full border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Assign To (Optional)</label>
          <div className="relative">
            <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select 
              value={formData.memberId} 
              onChange={e => setFormData({...formData, memberId: e.target.value})}
              className="w-full border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white appearance-none"
            >
              <option value="">Everyone</option>
              <option value="1">Sarah (Mom)</option>
              <option value="2">David (Dad)</option>
              <option value="3">Leo (Son)</option>
              <option value="4">Mia (Daughter)</option>
            </select>
          </div>
        </div>

        <div className="pt-4 mt-auto">
          <button type="submit" className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
            Save Event
          </button>
        </div>
      </form>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { CheckCircle2, Circle, Plus, User, Award, Clock, Trash2, X, Loader2 } from 'lucide-react';

type ChoreStatus = 'todo' | 'done';

export type Chore = {
  id: string;
  title: string;
  assignee_id: string;
  assignee_name?: string;
  assignee_avatar?: string;
  points: number;
  status: ChoreStatus;
  due_date: string;
};

type Member = {
  id: string;
  name: string;
  avatar?: string;
};

export default function ChoresView({ token, ws }: { token: string, ws: WebSocket | null }) {
  const [chores, setChores] = useState<Chore[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isAddingChore, setIsAddingChore] = useState(false);
  const [filter, setFilter] = useState<'all' | 'todo' | 'done'>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [tasksRes, membersRes] = await Promise.all([
          fetch('/api/tasks', { headers: { 'Authorization': `Bearer ${token}` } }),
          fetch('/api/household/members', { headers: { 'Authorization': `Bearer ${token}` } })
        ]);
        
        if (tasksRes.ok) {
          const data = await tasksRes.json();
          setChores(data.tasks);
        }
        if (membersRes.ok) {
          const data = await membersRes.json();
          setMembers(data.members);
        }
      } catch (e) {
        console.error('Failed to fetch data', e);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchData();
  }, [token]);

  useEffect(() => {
    if (!ws) return;

    const handleMessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === 'task:created') {
          setChores(prev => [data.payload, ...prev]);
        } else if (data.event === 'task:updated') {
          setChores(prev => prev.map(c => c.id === data.payload.id ? data.payload : c));
        } else if (data.event === 'task:deleted') {
          setChores(prev => prev.filter(c => c.id !== data.payload.id));
        }
      } catch (e) {
        console.error('Failed to parse ws message', e);
      }
    };

    ws.addEventListener('message', handleMessage);
    return () => ws.removeEventListener('message', handleMessage);
  }, [ws]);

  const toggleChoreStatus = async (chore: Chore) => {
    const newStatus = chore.status === 'todo' ? 'done' : 'todo';
    
    // Optimistic update
    setChores(chores.map(c => c.id === chore.id ? { ...c, status: newStatus } : c));

    try {
      await fetch(`/api/tasks/${chore.id}`, {
        method: 'PUT',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ status: newStatus })
      });
    } catch (e) {
      // Revert on error
      setChores(chores.map(c => c.id === chore.id ? { ...c, status: chore.status } : c));
    }
  };

  const deleteChore = async (id: string) => {
    // Optimistic update
    const previousChores = [...chores];
    setChores(chores.filter(chore => chore.id !== id));

    try {
      await fetch(`/api/tasks/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
    } catch (e) {
      setChores(previousChores);
    }
  };

  const handleAddChore = async (choreData: any) => {
    try {
      const res = await fetch('/api/tasks', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(choreData)
      });
      if (res.ok) {
        const data = await res.json();
        setChores([data.task, ...chores]);
        setIsAddingChore(false);
      }
    } catch (e) {
      console.error('Failed to add chore', e);
    }
  };

  const filteredChores = chores.filter(c => filter === 'all' ? true : c.status === filter);
  const todoCount = chores.filter(c => c.status === 'todo').length;
  const doneCount = chores.filter(c => c.status === 'done').length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-8rem)]">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto flex gap-6 h-[calc(100vh-8rem)]"
    >
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-stone-800">Chores & Tasks</h2>
              <p className="text-stone-500 text-sm">Manage household tasks and earn points.</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAddingChore(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Chore
          </button>
        </div>

        {/* Filters & Stats */}
        <div className="p-4 flex items-center justify-between border-b border-stone-100 bg-white">
          <div className="flex gap-2">
            <button 
              onClick={() => setFilter('all')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === 'all' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              All ({chores.length})
            </button>
            <button 
              onClick={() => setFilter('todo')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === 'todo' ? 'bg-amber-100 text-amber-700' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              To Do ({todoCount})
            </button>
            <button 
              onClick={() => setFilter('done')}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${filter === 'done' ? 'bg-emerald-100 text-emerald-700' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              Done ({doneCount})
            </button>
          </div>
        </div>

        {/* Chores List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-stone-50/30">
          <AnimatePresence>
            {filteredChores.map(chore => {
              const isDone = chore.status === 'done';
              
              return (
                <motion.div
                  key={chore.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-4 rounded-2xl border flex items-center gap-4 transition-all ${isDone ? 'bg-stone-50 border-stone-200 opacity-75' : 'bg-white border-stone-200 shadow-sm hover:border-emerald-300'}`}
                >
                  <button 
                    onClick={() => toggleChoreStatus(chore)}
                    className={`shrink-0 transition-colors ${isDone ? 'text-emerald-500' : 'text-stone-300 hover:text-emerald-500'}`}
                  >
                    {isDone ? <CheckCircle2 className="w-6 h-6" /> : <Circle className="w-6 h-6" />}
                  </button>
                  
                  <div className="flex-1 min-w-0">
                    <h3 className={`font-medium truncate ${isDone ? 'text-stone-500 line-through' : 'text-stone-800'}`}>
                      {chore.title}
                    </h3>
                    <div className="flex items-center gap-3 mt-1 text-xs text-stone-500">
                      {chore.due_date && (
                        <div className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(chore.due_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                        </div>
                      )}
                      <div className="flex items-center gap-1 font-medium text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded">
                        <Award className="w-3.5 h-3.5" />
                        {chore.points} pts
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    {chore.assignee_name && (
                      <div className="flex items-center gap-2" title={`Assigned to ${chore.assignee_name}`}>
                        {chore.assignee_avatar ? (
                          <img src={chore.assignee_avatar} alt={chore.assignee_name} className={`w-8 h-8 rounded-full object-cover border-2 border-white shadow-sm ${isDone ? 'grayscale' : ''}`} referrerPolicy="no-referrer" />
                        ) : (
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs border-2 border-white shadow-sm ${isDone ? 'bg-stone-200 text-stone-500' : 'bg-emerald-100 text-emerald-700'}`}>
                            {chore.assignee_name.charAt(0)}
                          </div>
                        )}
                      </div>
                    )}
                    <button 
                      onClick={() => deleteChore(chore.id)}
                      className="p-2 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
          
          {filteredChores.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-4 py-12">
              <CheckCircle2 className="w-12 h-12 opacity-20" />
              <p>No chores found in this view.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Chore Sidebar */}
      <AnimatePresence>
        {isAddingChore && (
          <motion.div
            initial={{ width: 0, opacity: 0, marginLeft: 0 }}
            animate={{ width: 320, opacity: 1, marginLeft: '1.5rem' }}
            exit={{ width: 0, opacity: 0, marginLeft: 0 }}
            className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden shrink-0 flex flex-col"
          >
            <ChoreForm 
              members={members}
              onClose={() => setIsAddingChore(false)} 
              onSubmit={handleAddChore} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ChoreForm({ members, onClose, onSubmit }: { members: Member[], onClose: () => void, onSubmit: (c: any) => void }) {
  const [formData, setFormData] = useState({
    title: '',
    assignee_id: members.length > 0 ? members[0].id : '',
    points: 10,
    due_date: new Date().toISOString().split('T')[0]
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title) return;
    onSubmit(formData);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
        <h3 className="font-semibold text-stone-800">New Chore</h3>
        <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-md hover:bg-stone-100">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-5">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Chore Title *</label>
          <input 
            type="text" 
            required
            autoFocus
            value={formData.title} 
            onChange={e => setFormData({...formData, title: e.target.value})}
            placeholder="e.g., Fold Laundry"
            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Assign To</label>
          <div className="relative">
            <User className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <select 
              value={formData.assignee_id} 
              onChange={e => setFormData({...formData, assignee_id: e.target.value})}
              className="w-full border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white appearance-none"
            >
              <option value="">Unassigned</option>
              {members.map(m => (
                <option key={m.id} value={m.id}>{m.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Points</label>
            <div className="relative">
              <Award className="w-4 h-4 text-amber-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input 
                type="number" 
                min="0"
                step="5"
                required
                value={formData.points} 
                onChange={e => setFormData({...formData, points: parseInt(e.target.value) || 0})}
                className="w-full border border-stone-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Due Date</label>
            <input 
              type="date" 
              required
              value={formData.due_date} 
              onChange={e => setFormData({...formData, due_date: e.target.value})}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div className="pt-4 mt-auto">
          <button type="submit" className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
            Add Chore
          </button>
        </div>
      </form>
    </div>
  );
}

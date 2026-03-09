import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Home, Users, Loader2 } from 'lucide-react';

export default function HouseholdSetup({ token, onComplete }: { token: string, onComplete: (householdId: string) => void }) {
  const [isCreating, setIsCreating] = useState(true);
  const [name, setName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const endpoint = isCreating ? '/api/household/create' : '/api/household/join';
      const body = isCreating ? { name } : { inviteCode };
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to setup household');

      onComplete(data.household.id);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f5f5f0] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="bg-white rounded-3xl shadow-xl border border-stone-100 p-8 w-full max-w-md"
      >
        <div className="flex justify-center mb-6">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center">
            {isCreating ? <Home className="w-8 h-8" /> : <Users className="w-8 h-8" />}
          </div>
        </div>
        
        <h2 className="text-2xl font-bold text-center text-stone-800 mb-2">
          {isCreating ? 'Create a Household' : 'Join a Household'}
        </h2>
        <p className="text-center text-stone-500 mb-8">
          {isCreating ? 'Set up a new space for your family' : 'Enter an invite code to join your family'}
        </p>

        {error && (
          <div className="bg-rose-50 text-rose-600 p-3 rounded-xl text-sm font-medium mb-6 text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {isCreating ? (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Household Name</label>
              <input 
                type="text" 
                required
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="e.g., The Smiths"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none"
              />
            </div>
          ) : (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Invite Code</label>
              <input 
                type="text" 
                required
                value={inviteCode}
                onChange={e => setInviteCode(e.target.value)}
                placeholder="Enter 8-character code"
                className="w-full border border-stone-200 rounded-xl px-4 py-3 focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none uppercase"
              />
            </div>
          )}

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-blue-600 text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2 mt-6"
          >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {isCreating ? 'Create Household' : 'Join Household'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button 
            onClick={() => { setIsCreating(!isCreating); setError(''); }}
            className="text-stone-500 hover:text-blue-600 text-sm font-medium transition-colors"
          >
            {isCreating ? "Have an invite code? Join instead" : "Want to start fresh? Create instead"}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

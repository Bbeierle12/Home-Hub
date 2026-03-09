/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, Home, Calendar, Users, Globe, Sparkles,
  Menu, X, BookOpen, Award, Shield, ChevronRight, CheckCircle2, Zap,
  MessageSquareText, Loader2, Send, PenTool, Settings, Network, CheckSquare, ShoppingCart, LogOut
} from 'lucide-react';
import { GoogleGenAI } from '@google/genai';
import FamilyTreeView from './components/FamilyTreeView';
import ScheduleView from './components/ScheduleView';
import ChoresView from './components/ChoresView';
import PantryView from './components/PantryView';
import AuthView from './components/AuthView';
import HouseholdSetup from './components/HouseholdSetup';
import { useWebSocket } from './lib/store';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

type View = 'dashboard' | 'search' | 'planner' | 'translator' | 'family-tree' | 'schedule' | 'chores' | 'pantry';

export default function App() {
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const { ws, isConnected, sendMessage } = useWebSocket(token);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);

  const handleLogin = (newToken: string, userData: any) => {
    setToken(newToken);
    setUser(userData);
  };

  const handleLogout = () => {
    setToken(null);
    setUser(null);
  };

  const handleHouseholdComplete = (householdId: string) => {
    setUser({ ...user, householdId });
  };

  if (!token) {
    return <AuthView onLogin={handleLogin} />;
  }

  if (token && user && !user.householdId) {
    return <HouseholdSetup token={token} onComplete={handleHouseholdComplete} />;
  }

  return (
    <div className="flex h-screen bg-[#f5f5f0] text-stone-900 font-sans overflow-hidden">
      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: 280, opacity: 1 }}
            exit={{ width: 0, opacity: 0 }}
            className="bg-white border-r border-stone-200 flex flex-col z-20 shrink-0"
          >
            <div className="p-6 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-700">
                <Sparkles className="w-6 h-6" />
                <span className="font-semibold text-lg tracking-tight">Family AI Hub</span>
              </div>
              <button onClick={toggleSidebar} className="lg:hidden text-stone-400 hover:text-stone-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <nav className="flex-1 px-4 space-y-1 overflow-y-auto">
              <NavItem icon={<Home />} label="Dashboard" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} />
              <div className="pt-4 pb-2 px-3 text-xs font-semibold text-stone-400 uppercase tracking-wider">AI Tools</div>
              <NavItem icon={<Search />} label="Smart Search" active={currentView === 'search'} onClick={() => setCurrentView('search')} />
              <NavItem icon={<PenTool />} label="Content Generator" active={currentView === 'planner'} onClick={() => setCurrentView('planner')} />
              <NavItem icon={<Globe />} label="Translator" active={currentView === 'translator'} onClick={() => setCurrentView('translator')} />
              
              <div className="pt-4 pb-2 px-3 text-xs font-semibold text-stone-400 uppercase tracking-wider">Family</div>
              <NavItem icon={<Network />} label="Family Tree" active={currentView === 'family-tree'} onClick={() => setCurrentView('family-tree')} />
              <NavItem icon={<Calendar />} label="Schedule" active={currentView === 'schedule'} onClick={() => setCurrentView('schedule')} />
              <NavItem icon={<CheckSquare />} label="Chores" active={currentView === 'chores'} onClick={() => setCurrentView('chores')} />
              <NavItem icon={<ShoppingCart />} label="Pantry" active={currentView === 'pantry'} onClick={() => setCurrentView('pantry')} />
              <NavItem icon={<Users />} label="Members" active={false} onClick={() => {}} />
              <NavItem icon={<Award />} label="Rewards" active={false} onClick={() => {}} />
            </nav>

            <div className="p-4 border-t border-stone-100">
              <div className="flex items-center gap-3 p-2 rounded-xl hover:bg-stone-50 transition-colors cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center font-bold">
                  {user?.name?.charAt(0) || 'U'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{user?.name}</p>
                  <p className="text-xs text-stone-500 truncate">Admin</p>
                </div>
                <button onClick={handleLogout} className="p-2 text-stone-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all">
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden relative">
        <header className="h-16 bg-white/80 backdrop-blur-md border-b border-stone-200 flex items-center px-4 lg:px-8 shrink-0 z-10">
          {!isSidebarOpen && (
            <button onClick={toggleSidebar} className="mr-4 text-stone-500 hover:text-stone-700 p-2 rounded-lg hover:bg-stone-100 transition-colors">
              <Menu className="w-5 h-5" />
            </button>
          )}
          <h1 className="text-xl font-medium text-stone-800 capitalize">
            {currentView === 'dashboard' ? 'Overview' : currentView.replace('-', ' ')}
          </h1>
          <div className="ml-auto flex items-center gap-4">
            <div className={`hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${isConnected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-amber-500'}`}></div>
              <span>{isConnected ? 'Live Sync' : 'Connecting...'}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-5xl mx-auto">
            <AnimatePresence mode="wait">
              {currentView === 'dashboard' && <DashboardView key="dashboard" user={user} />}
              {currentView === 'search' && <SearchView key="search" />}
              {currentView === 'planner' && <PlannerView key="planner" />}
              {currentView === 'translator' && <TranslatorView key="translator" />}
              {currentView === 'family-tree' && <FamilyTreeView key="family-tree" />}
              {currentView === 'schedule' && <ScheduleView key="schedule" />}
              {currentView === 'chores' && <ChoresView key="chores" token={token} ws={ws} />}
              {currentView === 'pantry' && <PantryView key="pantry" />}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick }: { icon: React.ReactNode, label: string, active: boolean, onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 ${
        active 
          ? 'bg-emerald-50 text-emerald-700 font-medium' 
          : 'text-stone-600 hover:bg-stone-50 hover:text-stone-900'
      }`}
    >
      {React.cloneElement(icon as React.ReactElement, { className: `w-5 h-5 ${active ? 'text-emerald-600' : 'text-stone-400'}` })}
      <span className="text-sm">{label}</span>
    </button>
  );
}

// --- Views ---

const FAMILY_MEMBERS = [
  { id: '1', name: 'Sarah (Mom)', avatar: 'https://picsum.photos/seed/sarah/100/100', points: 1250 },
  { id: '2', name: 'David (Dad)', avatar: 'https://picsum.photos/seed/david/100/100', points: 980 },
  { id: '3', name: 'Leo (Son)', avatar: 'https://picsum.photos/seed/leo/100/100', points: 450 },
  { id: '4', name: 'Mia (Daughter)', avatar: 'https://picsum.photos/seed/mia/100/100', points: 620 },
];

const RECENT_ACTIVITIES = [
  { id: 1, user: 'Leo', action: 'completed chore: Empty Dishwasher', time: '2 hours ago', points: 20 },
  { id: 2, user: 'Sarah', action: 'added a new recipe: Lasagna', time: '5 hours ago', points: 15 },
  { id: 3, user: 'David', action: 'updated the weekend schedule', time: 'Yesterday', points: 10 },
];

function DashboardView({ user }: { user: any }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="space-y-8"
    >
      {/* Welcome Section */}
      <div className="bg-white rounded-3xl p-8 shadow-sm border border-stone-100 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-50 rounded-full blur-3xl -mr-20 -mt-20 opacity-50 pointer-events-none"></div>
        <div className="relative z-10">
          <h2 className="text-3xl font-semibold mb-2">Good afternoon, {user?.name?.split(' ')[0] || 'there'}!</h2>
          <p className="text-stone-500 max-w-xl">
            Here's what's happening with your family today. Your AI assistant has prepared some personalized recommendations for you.
          </p>
          
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-emerald-50/50 rounded-2xl p-5 border border-emerald-100/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
                  <Sparkles className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-emerald-900">AI Suggestion</h3>
              </div>
              <p className="text-sm text-emerald-800/80">
                It looks like a rainy weekend. Would you like me to generate some indoor activity ideas for Leo and Mia?
              </p>
              <button className="mt-4 text-sm font-medium text-emerald-700 hover:text-emerald-800 flex items-center gap-1">
                Generate ideas <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            
            <div className="bg-amber-50/50 rounded-2xl p-5 border border-amber-100/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-lg">
                  <Calendar className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-amber-900">Up Next</h3>
              </div>
              <p className="text-sm text-amber-800/80">
                Leo's soccer practice is at 4:30 PM. Traffic is light, estimated drive time is 15 minutes.
              </p>
            </div>

            <div className="bg-blue-50/50 rounded-2xl p-5 border border-blue-100/50">
              <div className="flex items-center gap-3 mb-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <h3 className="font-medium text-blue-900">Maintenance</h3>
              </div>
              <p className="text-sm text-blue-800/80">
                Automated system check complete. All family devices are synced and backed up securely.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Gamification / Leaderboard */}
        <div className="lg:col-span-1 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-medium flex items-center gap-2">
              <Award className="w-5 h-5 text-amber-500" /> Family Points
            </h3>
          </div>
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 space-y-4">
            {FAMILY_MEMBERS.sort((a, b) => b.points - a.points).map((member, i) => (
              <div key={member.id} className="flex items-center gap-3">
                <div className="w-6 text-center text-sm font-bold text-stone-400">
                  {i + 1}
                </div>
                <img src={member.avatar} alt={member.name} className="w-10 h-10 rounded-full object-cover" referrerPolicy="no-referrer" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-stone-900 truncate">{member.name}</p>
                </div>
                <div className="text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                  {member.points}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="lg:col-span-2 space-y-4">
          <h3 className="text-lg font-medium">Recent Activity</h3>
          <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100">
            <div className="space-y-6">
              {RECENT_ACTIVITIES.map((activity, i) => (
                <div key={activity.id} className="flex gap-4 relative">
                  {i !== RECENT_ACTIVITIES.length - 1 && (
                    <div className="absolute top-8 left-5 bottom-[-24px] w-px bg-stone-100"></div>
                  )}
                  <div className="w-10 h-10 rounded-full bg-stone-50 border border-stone-100 flex items-center justify-center shrink-0 z-10">
                    <Zap className="w-4 h-4 text-stone-400" />
                  </div>
                  <div className="pt-2 flex-1">
                    <p className="text-sm text-stone-800">
                      <span className="font-medium">{activity.user}</span> {activity.action}
                    </p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-stone-400">{activity.time}</span>
                      <span className="text-xs font-medium text-emerald-600">+{activity.points} pts</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function SearchView() {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    setResult(null);

    try {
      const prompt = `
        You are an AI assistant for a family tool website. 
        The family has a shared calendar, recipes, and documents.
        Answer the following query based on typical family scenarios. Be helpful, concise, and friendly.
        Query: "${query}"
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      setResult(response.text || "I couldn't find an answer for that.");
    } catch (error) {
      console.error(error);
      setResult("Sorry, there was an error processing your search.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-3xl mx-auto space-y-8"
    >
      <div className="text-center space-y-4 mb-12">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto rotate-3">
          <Search className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-semibold">AI-Powered Search</h2>
        <p className="text-stone-500">Ask anything about your family's schedule, recipes, or documents.</p>
      </div>

      <form onSubmit={handleSearch} className="relative">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="e.g., 'What time is Leo's soccer practice?' or 'Show me Mom's lasagna recipe'"
          className="w-full bg-white border border-stone-200 rounded-2xl py-4 pl-5 pr-14 text-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
        />
        <button 
          type="submit"
          disabled={isSearching || !query.trim()}
          className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 disabled:opacity-50 transition-colors"
        >
          {isSearching ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-5 h-5" />}
        </button>
      </form>

      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100"
          >
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center shrink-0 mt-1">
                <Sparkles className="w-5 h-5 text-emerald-600" />
              </div>
              <div className="prose prose-stone max-w-none">
                <p className="whitespace-pre-wrap">{result}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!result && !isSearching && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
          <button onClick={() => setQuery("What's for dinner this week?")} className="text-left p-4 rounded-2xl border border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
            <p className="font-medium text-stone-800">What's for dinner this week?</p>
            <p className="text-sm text-stone-500 mt-1">Search meal plans</p>
          </button>
          <button onClick={() => setQuery("Where is the warranty for the TV?")} className="text-left p-4 rounded-2xl border border-stone-200 hover:border-emerald-300 hover:bg-emerald-50/30 transition-colors">
            <p className="font-medium text-stone-800">Where is the warranty for the TV?</p>
            <p className="text-sm text-stone-500 mt-1">Search documents</p>
          </button>
        </div>
      )}
    </motion.div>
  );
}

function PlannerView() {
  const [topic, setTopic] = useState('meal-plan');
  const [details, setDetails] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [content, setContent] = useState<string | null>(null);

  const handleGenerate = async () => {
    setIsGenerating(true);
    setContent(null);

    try {
      const prompt = `
        You are an AI assistant for a family tool website.
        Generate personalized content for the family based on the following request.
        Topic: ${topic}
        Additional Details: ${details || 'None provided.'}
        
        Format the output nicely using markdown. Keep it engaging and practical for a family.
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      setContent(response.text || "Failed to generate content.");
    } catch (error) {
      console.error(error);
      setContent("Sorry, there was an error generating the content.");
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-4xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8"
    >
      <div className="lg:col-span-1 space-y-6">
        <div>
          <h2 className="text-2xl font-semibold">Content Generator</h2>
          <p className="text-stone-500 text-sm mt-1">Create tailored content for your family instantly.</p>
        </div>

        <div className="space-y-4 bg-white p-6 rounded-3xl shadow-sm border border-stone-100">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">What do you want to create?</label>
            <select 
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            >
              <option value="meal-plan">Weekly Meal Plan</option>
              <option value="chore-list">Kids Chore List</option>
              <option value="newsletter">Family Monthly Newsletter</option>
              <option value="activity-ideas">Weekend Activity Ideas</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-stone-700 mb-2">Any specific details?</label>
            <textarea 
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              placeholder="e.g., 'Make it vegetarian', 'Focus on outdoor activities'"
              className="w-full bg-stone-50 border border-stone-200 rounded-xl px-3 py-2.5 text-sm h-24 resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>

          <button 
            onClick={handleGenerate}
            disabled={isGenerating}
            className="w-full bg-emerald-600 text-white rounded-xl py-2.5 font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
          >
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {isGenerating ? 'Generating...' : 'Generate Content'}
          </button>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-stone-100 min-h-[400px]">
          {content ? (
            <div className="prose prose-stone prose-emerald max-w-none">
              <div className="whitespace-pre-wrap">{content}</div>
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-4 py-12">
              <BookOpen className="w-12 h-12 opacity-20" />
              <p>Your generated content will appear here.</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function TranslatorView() {
  const [text, setText] = useState('');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translation, setTranslation] = useState<string | null>(null);

  const handleTranslate = async () => {
    if (!text.trim()) return;
    setIsTranslating(true);
    setTranslation(null);

    try {
      const prompt = `
        Translate the following text to ${targetLang}. 
        Keep the tone friendly and suitable for family communication.
        Text: "${text}"
      `;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      setTranslation(response.text || "Translation failed.");
    } catch (error) {
      console.error(error);
      setTranslation("Sorry, there was an error translating the text.");
    } finally {
      setIsTranslating(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-3xl mx-auto space-y-8"
    >
      <div className="text-center space-y-4 mb-8">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto -rotate-3">
          <Globe className="w-8 h-8" />
        </div>
        <h2 className="text-3xl font-semibold">Family Translator</h2>
        <p className="text-stone-500">Communicate easily with extended family members around the world.</p>
      </div>

      <div className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden">
        <div className="p-4 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <span className="font-medium text-stone-700">English</span>
          <div className="flex items-center gap-3">
            <span className="text-stone-400">to</span>
            <select 
              value={targetLang}
              onChange={(e) => setTargetLang(e.target.value)}
              className="bg-white border border-stone-200 rounded-lg px-3 py-1.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            >
              <option value="Spanish">Spanish</option>
              <option value="French">French</option>
              <option value="German">German</option>
              <option value="Italian">Italian</option>
              <option value="Japanese">Japanese</option>
              <option value="Chinese (Simplified)">Chinese</option>
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-stone-100">
          <div className="p-4">
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Type a message to translate..."
              className="w-full h-48 resize-none bg-transparent border-none focus:ring-0 p-0 text-stone-800 placeholder-stone-400"
            />
            <div className="flex justify-end mt-2">
              <button
                onClick={handleTranslate}
                disabled={isTranslating || !text.trim()}
                className="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center gap-2"
              >
                {isTranslating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
                Translate
              </button>
            </div>
          </div>
          
          <div className="p-4 bg-stone-50/30">
            {translation ? (
              <p className="text-stone-800 whitespace-pre-wrap">{translation}</p>
            ) : (
              <p className="text-stone-400 italic">Translation will appear here...</p>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}


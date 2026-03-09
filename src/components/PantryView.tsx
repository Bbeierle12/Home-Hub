import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShoppingCart, Plus, Trash2, X, Package, AlertTriangle, Search } from 'lucide-react';

type PantryItem = {
  id: string;
  name: string;
  category: string;
  quantity: number;
  unit: string;
  lowStockThreshold: number;
};

const INITIAL_INVENTORY: PantryItem[] = [
  { id: '1', name: 'Milk', category: 'Dairy', quantity: 1, unit: 'gallon', lowStockThreshold: 1 },
  { id: '2', name: 'Eggs', category: 'Dairy', quantity: 6, unit: 'count', lowStockThreshold: 12 },
  { id: '3', name: 'Bread', category: 'Bakery', quantity: 2, unit: 'loaf', lowStockThreshold: 1 },
  { id: '4', name: 'Apples', category: 'Produce', quantity: 5, unit: 'count', lowStockThreshold: 4 },
  { id: '5', name: 'Pasta', category: 'Pantry', quantity: 3, unit: 'box', lowStockThreshold: 2 },
];

const CATEGORIES = ['Dairy', 'Bakery', 'Produce', 'Pantry', 'Meat', 'Frozen', 'Household', 'Other'];

export default function PantryView() {
  const [inventory, setInventory] = useState<PantryItem[]>(INITIAL_INVENTORY);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const handleDelete = (id: string) => {
    setInventory(inventory.filter(item => item.id !== id));
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setInventory(inventory.map(item => {
      if (item.id === id) {
        const newQuantity = Math.max(0, item.quantity + delta);
        return { ...item, quantity: newQuantity };
      }
      return item;
    }));
  };

  const handleAddItem = (item: PantryItem) => {
    setInventory([...inventory, item]);
    setIsAddingItem(false);
  };

  const filteredInventory = inventory.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const lowStockItems = inventory.filter(item => item.quantity <= item.lowStockThreshold);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="max-w-5xl mx-auto flex gap-6 h-[calc(100vh-8rem)]"
    >
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-stone-100 flex items-center justify-between bg-stone-50/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-stone-800">Pantry & Groceries</h2>
              <p className="text-stone-500 text-sm">Track inventory and manage shopping lists.</p>
            </div>
          </div>
          <button 
            onClick={() => setIsAddingItem(true)}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Add Item
          </button>
        </div>

        {/* Low Stock Alert */}
        {lowStockItems.length > 0 && (
          <div className="mx-6 mt-6 p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-amber-800">Low Stock Alert</h3>
              <p className="text-sm text-amber-700 mt-1">
                You are running low on: {lowStockItems.map(i => i.name).join(', ')}. Consider adding them to your shopping list.
              </p>
            </div>
          </div>
        )}

        {/* Controls */}
        <div className="p-6 pb-4 flex flex-col sm:flex-row gap-4 justify-between items-center">
          <div className="relative w-full sm:w-72">
            <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search inventory..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-stone-50 border border-stone-200 rounded-xl pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
            />
          </div>
          
          <div className="flex gap-2 overflow-x-auto w-full sm:w-auto pb-2 sm:pb-0 no-scrollbar">
            <button
              onClick={() => setSelectedCategory('All')}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === 'All' ? 'bg-stone-800 text-white' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
            >
              All Items
            </button>
            {CATEGORIES.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${selectedCategory === cat ? 'bg-indigo-100 text-indigo-700' : 'bg-stone-100 text-stone-600 hover:bg-stone-200'}`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* Inventory List */}
        <div className="flex-1 overflow-y-auto px-6 pb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredInventory.map(item => {
                const isLowStock = item.quantity <= item.lowStockThreshold;
                
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    className={`p-4 rounded-2xl border flex flex-col gap-3 transition-all bg-white ${isLowStock ? 'border-amber-300 shadow-[0_0_0_1px_rgba(252,211,77,1)]' : 'border-stone-200 shadow-sm hover:border-emerald-300'}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium text-stone-800">{item.name}</h3>
                        <span className="text-xs font-medium text-stone-500 bg-stone-100 px-2 py-0.5 rounded-md mt-1 inline-block">
                          {item.category}
                        </span>
                      </div>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-1.5 text-stone-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    <div className="flex items-center justify-between mt-auto pt-2 border-t border-stone-100">
                      <div className="flex items-center gap-2">
                        <Package className={`w-4 h-4 ${isLowStock ? 'text-amber-500' : 'text-stone-400'}`} />
                        <span className={`text-sm font-medium ${isLowStock ? 'text-amber-600' : 'text-stone-600'}`}>
                          {item.quantity} <span className="text-stone-400 font-normal">{item.unit}</span>
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 bg-stone-50 rounded-lg p-1 border border-stone-200">
                        <button 
                          onClick={() => handleUpdateQuantity(item.id, -1)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white text-stone-600 shadow-sm hover:text-emerald-600 disabled:opacity-50"
                          disabled={item.quantity <= 0}
                        >
                          -
                        </button>
                        <button 
                          onClick={() => handleUpdateQuantity(item.id, 1)}
                          className="w-6 h-6 flex items-center justify-center rounded bg-white text-stone-600 shadow-sm hover:text-emerald-600"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
          
          {filteredInventory.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center text-stone-400 space-y-4 py-12">
              <Package className="w-12 h-12 opacity-20" />
              <p>No items found in inventory.</p>
            </div>
          )}
        </div>
      </div>

      {/* Add Item Sidebar */}
      <AnimatePresence>
        {isAddingItem && (
          <motion.div
            initial={{ width: 0, opacity: 0, marginLeft: 0 }}
            animate={{ width: 320, opacity: 1, marginLeft: '1.5rem' }}
            exit={{ width: 0, opacity: 0, marginLeft: 0 }}
            className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden shrink-0 flex flex-col"
          >
            <ItemForm 
              onClose={() => setIsAddingItem(false)} 
              onSubmit={handleAddItem} 
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ItemForm({ onClose, onSubmit }: { onClose: () => void, onSubmit: (i: PantryItem) => void }) {
  const [formData, setFormData] = useState({
    name: '',
    category: CATEGORIES[0],
    quantity: 1,
    unit: 'count',
    lowStockThreshold: 1
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name) return;
    
    onSubmit({
      id: Math.random().toString(36).substr(2, 9),
      ...formData
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
        <h3 className="font-semibold text-stone-800">Add Item</h3>
        <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-md hover:bg-stone-100">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-5">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Item Name *</label>
          <input 
            type="text" 
            required
            autoFocus
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder="e.g., Peanut Butter"
            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
          />
        </div>
        
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Category</label>
          <select 
            value={formData.category} 
            onChange={e => setFormData({...formData, category: e.target.value})}
            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none bg-white"
          >
            {CATEGORIES.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Quantity</label>
            <input 
              type="number" 
              min="0"
              required
              value={formData.quantity} 
              onChange={e => setFormData({...formData, quantity: parseInt(e.target.value) || 0})}
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Unit</label>
            <input 
              type="text" 
              value={formData.unit} 
              onChange={e => setFormData({...formData, unit: e.target.value})}
              placeholder="e.g., jar, oz"
              className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Low Stock Alert At</label>
          <input 
            type="number" 
            min="0"
            required
            value={formData.lowStockThreshold} 
            onChange={e => setFormData({...formData, lowStockThreshold: parseInt(e.target.value) || 0})}
            className="w-full border border-stone-200 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
          />
          <p className="text-xs text-stone-400 mt-1">Alert when quantity falls to or below this number.</p>
        </div>

        <div className="pt-4 mt-auto">
          <button type="submit" className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
            Save Item
          </button>
        </div>
      </form>
    </div>
  );
}

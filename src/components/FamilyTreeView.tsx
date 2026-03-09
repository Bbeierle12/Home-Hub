import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Plus, Edit2, Trash2, X, UserPlus, Heart, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export type FamilyMember = {
  id: string;
  name: string;
  birthDate: string;
  bio: string;
  avatar?: string;
};

export type Relationship = {
  id: string;
  source: string;
  target: string;
  type: 'parent-child' | 'spouse';
};

const INITIAL_MEMBERS: FamilyMember[] = [
  { id: '1', name: 'Sarah (Mom)', birthDate: '1980-05-15', bio: 'Loves gardening and reading.' },
  { id: '2', name: 'David (Dad)', birthDate: '1978-10-22', bio: 'Software engineer, enjoys hiking.' },
  { id: '3', name: 'Leo (Son)', birthDate: '2010-03-08', bio: 'Plays soccer and video games.' },
  { id: '4', name: 'Mia (Daughter)', birthDate: '2012-07-14', bio: 'Loves painting and animals.' },
];

const INITIAL_RELATIONSHIPS: Relationship[] = [
  { id: 'r1', source: '1', target: '2', type: 'spouse' },
  { id: 'r2', source: '1', target: '3', type: 'parent-child' },
  { id: 'r3', source: '2', target: '3', type: 'parent-child' },
  { id: 'r4', source: '1', target: '4', type: 'parent-child' },
  { id: 'r5', source: '2', target: '4', type: 'parent-child' },
];

export default function FamilyTreeView() {
  const [members, setMembers] = useState<FamilyMember[]>(INITIAL_MEMBERS);
  const [relationships, setRelationships] = useState<Relationship[]>(INITIAL_RELATIONSHIPS);
  const [selectedMember, setSelectedMember] = useState<FamilyMember | null>(null);
  const [isAddingMember, setIsAddingMember] = useState(false);
  const [isAddingRelation, setIsAddingRelation] = useState(false);
  
  const svgRef = useRef<SVGSVGElement>(null);

  // D3 Visualization
  useEffect(() => {
    if (!svgRef.current) return;

    const width = svgRef.current.clientWidth;
    const height = svgRef.current.clientHeight;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove(); // Clear previous render

    const g = svg.append('g');

    // Zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 4])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    svg.call(zoom);

    // Prepare data for D3
    const nodes = members.map(d => ({ ...d })) as (FamilyMember & d3.SimulationNodeDatum)[];
    const links = relationships.map(d => ({ ...d })) as (Relationship & d3.SimulationLinkDatum<FamilyMember & d3.SimulationNodeDatum>)[];

    const simulation = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id((d: any) => d.id).distance(100))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide().radius(50));

    // Draw links
    const link = g.append('g')
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('stroke', d => d.type === 'spouse' ? '#f43f5e' : '#94a3b8')
      .attr('stroke-width', d => d.type === 'spouse' ? 3 : 2)
      .attr('stroke-dasharray', d => d.type === 'spouse' ? '5,5' : 'none');

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .join('g')
      .call(d3.drag<SVGGElement, any>()
        .on('start', dragstarted)
        .on('drag', dragged)
        .on('end', dragended) as any)
      .on('click', (event, d) => {
        setSelectedMember(members.find(m => m.id === d.id) || null);
        setIsAddingMember(false);
        setIsAddingRelation(false);
      });

    node.append('circle')
      .attr('r', 30)
      .attr('fill', '#10b981')
      .attr('stroke', '#fff')
      .attr('stroke-width', 3)
      .attr('cursor', 'pointer');

    node.append('text')
      .text(d => d.name)
      .attr('y', 45)
      .attr('text-anchor', 'middle')
      .attr('fill', '#334155')
      .attr('font-size', '12px')
      .attr('font-weight', '500');

    simulation.on('tick', () => {
      link
        .attr('x1', (d: any) => d.source.x)
        .attr('y1', (d: any) => d.source.y)
        .attr('x2', (d: any) => d.target.x)
        .attr('y2', (d: any) => d.target.y);

      node
        .attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    function dragstarted(event: any) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      event.subject.fx = event.subject.x;
      event.subject.fy = event.subject.y;
    }

    function dragged(event: any) {
      event.subject.fx = event.x;
      event.subject.fy = event.y;
    }

    function dragended(event: any) {
      if (!event.active) simulation.alphaTarget(0);
      event.subject.fx = null;
      event.subject.fy = null;
    }

    return () => {
      simulation.stop();
    };
  }, [members, relationships]);

  const handleAddMember = (member: FamilyMember) => {
    setMembers([...members, member]);
    setIsAddingMember(false);
  };

  const handleUpdateMember = (updatedMember: FamilyMember) => {
    setMembers(members.map(m => m.id === updatedMember.id ? updatedMember : m));
    setSelectedMember(updatedMember);
  };

  const handleDeleteMember = (id: string) => {
    setMembers(members.filter(m => m.id !== id));
    setRelationships(relationships.filter(r => r.source !== id && r.target !== id));
    setSelectedMember(null);
  };

  const handleAddRelation = (relation: Relationship) => {
    setRelationships([...relationships, relation]);
    setIsAddingRelation(false);
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] gap-6">
      {/* Main Visualization Area */}
      <div className="flex-1 bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden relative flex flex-col">
        <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
          <div>
            <h2 className="text-lg font-semibold text-stone-800">Interactive Family Tree</h2>
            <p className="text-sm text-stone-500">Drag to pan, scroll to zoom. Click a node to view details.</p>
          </div>
          <div className="flex gap-2">
            <div className="flex items-center gap-2 text-xs text-stone-500 mr-4">
              <span className="w-4 h-0.5 bg-slate-400 block"></span> Parent/Child
              <span className="w-4 h-0.5 bg-rose-500 border-dashed border-t-2 block ml-2"></span> Spouse
            </div>
            <button
              onClick={() => { setIsAddingMember(true); setSelectedMember(null); setIsAddingRelation(false); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Add Person
            </button>
            <button
              onClick={() => { setIsAddingRelation(true); setSelectedMember(null); setIsAddingMember(false); }}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-200 transition-colors"
            >
              <Users className="w-4 h-4" /> Add Relation
            </button>
          </div>
        </div>
        
        <div className="flex-1 relative">
          <svg ref={svgRef} className="w-full h-full cursor-grab active:cursor-grabbing" />
        </div>
      </div>

      {/* Sidebar for Details/Forms */}
      <AnimatePresence mode="wait">
        {(selectedMember || isAddingMember || isAddingRelation) && (
          <motion.div
            initial={{ width: 0, opacity: 0, marginLeft: 0 }}
            animate={{ width: 320, opacity: 1, marginLeft: '1.5rem' }}
            exit={{ width: 0, opacity: 0, marginLeft: 0 }}
            className="bg-white rounded-3xl shadow-sm border border-stone-100 overflow-hidden shrink-0 flex flex-col"
          >
            {selectedMember && !isAddingMember && !isAddingRelation && (
              <MemberDetails 
                member={selectedMember} 
                onClose={() => setSelectedMember(null)}
                onUpdate={handleUpdateMember}
                onDelete={() => handleDeleteMember(selectedMember.id)}
              />
            )}
            {isAddingMember && (
              <MemberForm 
                onClose={() => setIsAddingMember(false)} 
                onSubmit={handleAddMember} 
              />
            )}
            {isAddingRelation && (
              <RelationForm 
                members={members}
                onClose={() => setIsAddingRelation(false)}
                onSubmit={handleAddRelation}
              />
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MemberDetails({ member, onClose, onUpdate, onDelete }: { member: FamilyMember, onClose: () => void, onUpdate: (m: FamilyMember) => void, onDelete: () => void }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState(member);

  useEffect(() => {
    setEditData(member);
    setIsEditing(false);
  }, [member]);

  const handleSave = () => {
    onUpdate(editData);
    setIsEditing(false);
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
        <h3 className="font-semibold text-stone-800">{isEditing ? 'Edit Profile' : 'Profile Details'}</h3>
        <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-md hover:bg-stone-100">
          <X className="w-5 h-5" />
        </button>
      </div>

      <div className="p-6 flex-1 overflow-y-auto">
        <div className="flex flex-col items-center mb-6">
          <div className="w-24 h-24 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-600 text-3xl font-bold mb-3 border-4 border-white shadow-sm">
            {member.name.charAt(0)}
          </div>
          {!isEditing && <h2 className="text-xl font-semibold text-center">{member.name}</h2>}
        </div>

        {isEditing ? (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Full Name</label>
              <input 
                type="text" 
                value={editData.name} 
                onChange={e => setEditData({...editData, name: e.target.value})}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Birth Date</label>
              <input 
                type="date" 
                value={editData.birthDate} 
                onChange={e => setEditData({...editData, birthDate: e.target.value})}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Biography</label>
              <textarea 
                value={editData.bio} 
                onChange={e => setEditData({...editData, bio: e.target.value})}
                rows={4}
                className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none"
              />
            </div>
            <div className="flex gap-2 pt-4">
              <button onClick={handleSave} className="flex-1 bg-emerald-600 text-white py-2 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
                Save Changes
              </button>
              <button onClick={() => setIsEditing(false)} className="px-4 bg-stone-100 text-stone-600 py-2 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors">
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            <div>
              <h4 className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">Birth Date</h4>
              <p className="text-stone-800">{new Date(member.birthDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' }) || 'Not specified'}</p>
            </div>
            <div>
              <h4 className="text-xs font-medium text-stone-400 uppercase tracking-wider mb-1">Biography</h4>
              <p className="text-stone-800 text-sm leading-relaxed">{member.bio || 'No biography provided.'}</p>
            </div>
            
            <div className="pt-6 border-t border-stone-100 flex gap-2">
              <button onClick={() => setIsEditing(true)} className="flex-1 flex items-center justify-center gap-2 bg-stone-100 text-stone-700 py-2 rounded-xl text-sm font-medium hover:bg-stone-200 transition-colors">
                <Edit2 className="w-4 h-4" /> Edit
              </button>
              <button onClick={onDelete} className="flex-1 flex items-center justify-center gap-2 bg-rose-50 text-rose-600 py-2 rounded-xl text-sm font-medium hover:bg-rose-100 transition-colors">
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MemberForm({ onClose, onSubmit }: { onClose: () => void, onSubmit: (m: FamilyMember) => void }) {
  const [formData, setFormData] = useState({ name: '', birthDate: '', bio: '' });

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
        <h3 className="font-semibold text-stone-800">Add Family Member</h3>
        <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-md hover:bg-stone-100">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Full Name *</label>
          <input 
            type="text" 
            required
            value={formData.name} 
            onChange={e => setFormData({...formData, name: e.target.value})}
            placeholder="e.g., Jane Doe"
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Birth Date</label>
          <input 
            type="date" 
            value={formData.birthDate} 
            onChange={e => setFormData({...formData, birthDate: e.target.value})}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Biography</label>
          <textarea 
            value={formData.bio} 
            onChange={e => setFormData({...formData, bio: e.target.value})}
            placeholder="A short bio..."
            rows={4}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 outline-none resize-none"
          />
        </div>
        <div className="pt-4">
          <button type="submit" className="w-full bg-emerald-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-emerald-700 transition-colors">
            Add Person
          </button>
        </div>
      </form>
    </div>
  );
}

function RelationForm({ members, onClose, onSubmit }: { members: FamilyMember[], onClose: () => void, onSubmit: (r: Relationship) => void }) {
  const [source, setSource] = useState(members[0]?.id || '');
  const [target, setTarget] = useState(members[1]?.id || '');
  const [type, setType] = useState<'parent-child' | 'spouse'>('parent-child');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !target || source === target) return;
    onSubmit({
      id: Math.random().toString(36).substr(2, 9),
      source,
      target,
      type
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-stone-100 flex justify-between items-center bg-stone-50/50">
        <h3 className="font-semibold text-stone-800">Add Relationship</h3>
        <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-600 rounded-md hover:bg-stone-100">
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="p-6 flex-1 overflow-y-auto space-y-4">
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Person 1 (Parent/Spouse)</label>
          <select 
            value={source} 
            onChange={e => setSource(e.target.value)}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
          >
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        
        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Relationship Type</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setType('parent-child')}
              className={`py-2 px-3 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 transition-colors ${type === 'parent-child' ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
            >
              <Users className="w-4 h-4" /> Parent of
            </button>
            <button
              type="button"
              onClick={() => setType('spouse')}
              className={`py-2 px-3 rounded-xl text-sm font-medium border flex items-center justify-center gap-2 transition-colors ${type === 'spouse' ? 'bg-rose-50 border-rose-200 text-rose-700' : 'bg-white border-stone-200 text-stone-600 hover:bg-stone-50'}`}
            >
              <Heart className="w-4 h-4" /> Spouse of
            </button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-stone-500 mb-1 uppercase tracking-wider">Person 2 (Child/Spouse)</label>
          <select 
            value={target} 
            onChange={e => setTarget(e.target.value)}
            className="w-full border border-stone-200 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none bg-white"
          >
            {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
          </select>
        </div>
        
        <div className="pt-4">
          <button 
            type="submit" 
            disabled={source === target}
            className="w-full bg-blue-600 text-white py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Add Relationship
          </button>
          {source === target && (
            <p className="text-xs text-rose-500 mt-2 text-center">Cannot link a person to themselves.</p>
          )}
        </div>
      </form>
    </div>
  );
}

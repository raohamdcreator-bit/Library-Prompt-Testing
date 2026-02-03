// src/components/PromptList.jsx
// Main prompt list component with demo handling and guest mode integration

import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useGuestMode } from '../context/GuestModeContext';
import { 
  getAllDemoPrompts, 
  isDemoPrompt, 
  duplicateDemoToUserPrompt,
  getPromptBadge,
  formatTimestamp,
} from '../lib/guestDemoContent';
import { guestState } from '../lib/guestState';
import AIPromptEnhancer from './AIPromptEnhancer';
import { 
  Sparkles, 
  Edit, 
  Copy, 
  Trash2, 
  Eye, 
  Plus,
  Search,
  Filter,
  Zap,
} from 'lucide-react';


export default function PromptList({ 
  teamId, 
  activeTeam,
  onEditPrompt,
  onViewPrompt,
  savePrompt,
  updatePrompt: updatePromptFirestore,
}) {
  const { user } = useAuth();
  const { isGuest, checkSaveRequired, canEditPrompt } = useGuestMode();
  
  const [userPrompts, setUserPrompts] = useState([]);
  const [editingPrompt, setEditingPrompt] = useState(null);
  const [viewingPrompt, setViewingPrompt] = useState(null);
  const [enhancingPrompt, setEnhancingPrompt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');

  // Get demos (always available)
  const demos = useMemo(() => getAllDemoPrompts(), []);

  // Load user prompts
  useEffect(() => {
    loadPrompts();
  }, [isGuest, user, teamId]);

  const loadPrompts = async () => {
    if (isGuest) {
      setUserPrompts(guestState.getPrompts());
      setLoading(false);
    } else if (user && teamId) {
      await loadUserPromptsFromFirestore();
    } else {
      setLoading(false);
    }
  };

  const loadUserPromptsFromFirestore = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'prompts'),
        where('createdBy', '==', user.uid),
        where('teamId', '==', teamId),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const prompts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      }));
      
      setUserPrompts(prompts);
    } catch (error) {
      console.error('Error loading prompts:', error);
      showToast('Failed to load prompts', 'error');
    } finally {
      setLoading(false);
    }
  };

  // Combine and filter prompts
  const allPrompts = useMemo(() => {
    let combined = [...demos, ...userPrompts];
    
    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      combined = combined.filter(p => 
        p.title.toLowerCase().includes(query) ||
        p.text.toLowerCase().includes(query) ||
        (p.tags && p.tags.some(tag => tag.toLowerCase().includes(query)))
      );
    }
    
    // Apply category filter
    if (filterCategory !== 'all') {
      if (filterCategory === 'demos') {
        combined = combined.filter(p => isDemoPrompt(p));
      } else if (filterCategory === 'mine') {
        combined = combined.filter(p => !isDemoPrompt(p));
      } else if (filterCategory === 'enhanced') {
        combined = combined.filter(p => p.enhanced === true);
      }
    }
    
    return combined;
  }, [demos, userPrompts, searchQuery, filterCategory]);

  // Separate demos and user prompts for display
  const displayDemos = useMemo(() => 
    allPrompts.filter(p => isDemoPrompt(p)), 
    [allPrompts]
  );
  
  const displayUserPrompts = useMemo(() => 
    allPrompts.filter(p => !isDemoPrompt(p)), 
    [allPrompts]
  );

  /**
   * Handle "Make My Own" for demos
   */
  const handleDuplicateDemo = (demoPrompt) => {
    const userPrompt = duplicateDemoToUserPrompt(demoPrompt);
    
    if (!userPrompt) {
      showToast('Failed to duplicate demo', 'error');
      return;
    }
    
    checkSaveRequired('duplicate_demo', async () => {
      if (isGuest) {
        const savedPrompt = guestState.addPrompt(userPrompt);
        setUserPrompts(prev => [savedPrompt, ...prev]);
        showToast('Demo copied! Edit it however you like.', 'success');
        
        if (onEditPrompt) {
          onEditPrompt(savedPrompt);
        }
      } else {
        try {
          const promptId = await savePrompt(user.uid, userPrompt, teamId);
          await loadUserPromptsFromFirestore();
          showToast('Demo copied!', 'success');
        } catch (error) {
          console.error('Error saving duplicated prompt:', error);
          showToast('Failed to save copied prompt', 'error');
        }
      }
      
      if (window.gtag) {
        window.gtag('event', 'demo_duplicated', {
          demo_id: demoPrompt.id,
          demo_title: demoPrompt.title,
          is_guest: isGuest,
        });
      }
    });
  };

  /**
   * Handle create new prompt
   */
  const handleCreatePrompt = () => {
    if (onEditPrompt) {
      onEditPrompt({ isNew: true });
    }
  };

  /**
   * Handle edit prompt
   */
  const handleEditPrompt = (prompt) => {
    if (!canEditPrompt(prompt)) {
      showToast('Cannot edit this prompt', 'warning');
      return;
    }
    
    if (onEditPrompt) {
      onEditPrompt(prompt);
    }
  };

  /**
   * Handle view prompt
   */
  const handleViewPrompt = (prompt) => {
    if (onViewPrompt) {
      onViewPrompt(prompt);
    } else {
      setViewingPrompt(prompt);
    }
  };

  /**
   * Handle enhance prompt
   */
  const handleEnhancePrompt = (prompt) => {
    if (!canEditPrompt(prompt)) {
      showToast('Duplicate this demo first to enhance it', 'warning');
      return;
    }
    
    setEnhancingPrompt(prompt);
  };

  /**
   * Handle delete prompt
   */
  const handleDeletePrompt = async (prompt) => {
    if (!canEditPrompt(prompt)) {
      showToast('Cannot delete this prompt', 'warning');
      return;
    }
    
    if (!window.confirm(`Delete "${prompt.title}"? This cannot be undone.`)) {
      return;
    }
    
    try {
      if (isGuest) {
        guestState.deletePrompt(prompt.id);
        setUserPrompts(prev => prev.filter(p => p.id !== prompt.id));
        showToast('Prompt deleted', 'success');
      } else {
        await deleteDoc(doc(db, 'prompts', prompt.id));
        setUserPrompts(prev => prev.filter(p => p.id !== prompt.id));
        showToast('Prompt deleted', 'success');
      }
    } catch (error) {
      console.error('Error deleting prompt:', error);
      showToast('Failed to delete prompt', 'error');
    }
  };

  /**
   * Handle enhancement application
   */
  const handleApplyEnhancement = (enhancedPrompt) => {
    setUserPrompts(prev => 
      prev.map(p => p.id === enhancedPrompt.id ? enhancedPrompt : p)
    );
    setEnhancingPrompt(null);
  };

  /**
   * Show toast notification
   */
  const showToast = (message, type = 'info') => {
    console.log(`[${type.toUpperCase()}] ${message}`);
    // Replace with your actual toast system (e.g., react-hot-toast)
  };

  /**
   * Render prompt card
   */
  const renderPromptCard = (prompt) => {
    const badge = getPromptBadge(prompt, isGuest);
    const isDemo = isDemoPrompt(prompt);
    const canEdit = canEditPrompt(prompt);
    
    return (
      <div key={prompt.id} className="prompt-card">
        {/* Badge */}
        {badge && (
          <span className={`prompt-badge ${badge.type}`}>
            <span className="badge-icon">{badge.icon}</span>
            {badge.label}
          </span>
        )}
        
        {/* Title */}
        <h3 className="prompt-title">{prompt.title}</h3>
        
        {/* Preview */}
        <p className="prompt-preview">
          {prompt.text.substring(0, 150)}
          {prompt.text.length > 150 && '...'}
        </p>
        
        {/* Tags */}
        {prompt.tags && prompt.tags.length > 0 && (
          <div className="prompt-tags">
            {prompt.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="tag">{tag}</span>
            ))}
            {prompt.tags.length > 3 && (
              <span className="tag-more">+{prompt.tags.length - 3}</span>
            )}
          </div>
        )}
        
        {/* Metadata */}
        <div className="prompt-meta">
          {prompt.createdAt && (
            <span className="meta-item">
              {formatTimestamp(prompt.createdAt)}
            </span>
          )}
          {prompt.category && (
            <span className="meta-item category">
              {prompt.category}
            </span>
          )}
        </div>
        
        {/* Actions */}
        <div className="prompt-actions">
          {isDemo ? (
            <>
              <button 
                onClick={() => handleViewPrompt(prompt)}
                className="action-btn secondary"
                title="View demo prompt"
              >
                <Eye size={16} />
                View
              </button>
              <button 
                onClick={() => handleDuplicateDemo(prompt)}
                className="action-btn primary"
                title="Create your own copy"
              >
                <Copy size={16} />
                Make My Own
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => handleEditPrompt(prompt)}
                className="action-btn secondary"
                disabled={!canEdit}
                title="Edit prompt"
              >
                <Edit size={16} />
                Edit
              </button>
              <button 
                onClick={() => handleEnhancePrompt(prompt)}
                className="action-btn secondary"
                disabled={!canEdit}
                title="AI enhance"
              >
                <Sparkles size={16} />
                Enhance
              </button>
              <button 
                onClick={() => handleDeletePrompt(prompt)}
                className="action-btn danger"
                disabled={!canEdit}
                title="Delete prompt"
              >
                <Trash2 size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="prompt-list-loading">
        <div className="spinner"></div>
        <p>Loading prompts...</p>
      </div>
    );
  }

  return (
    <div className="prompt-list">
      {/* Header */}
      <div className="list-header">
        <div className="header-left">
          <h2 className="list-title">
            {isGuest ? 'Try Demo Prompts' : 'Your Prompts'}
          </h2>
          <p className="list-subtitle">
            {isGuest 
              ? 'Explore examples and create your own' 
              : `${userPrompts.length} ${userPrompts.length === 1 ? 'prompt' : 'prompts'}`
            }
          </p>
        </div>
        <button 
          onClick={handleCreatePrompt}
          className="btn-primary"
        >
          <Plus size={18} />
          New Prompt
        </button>
      </div>

      {/* Search and Filters */}
      <div className="list-controls">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
          />
        </div>
        
        <div className="filter-buttons">
          <button
            onClick={() => setFilterCategory('all')}
            className={`filter-btn ${filterCategory === 'all' ? 'active' : ''}`}
          >
            All
          </button>
          {isGuest && (
            <button
              onClick={() => setFilterCategory('demos')}
              className={`filter-btn ${filterCategory === 'demos' ? 'active' : ''}`}
            >
              <Sparkles size={14} />
              Demos
            </button>
          )}
          <button
            onClick={() => setFilterCategory('mine')}
            className={`filter-btn ${filterCategory === 'mine' ? 'active' : ''}`}
          >
            My Prompts
          </button>
          <button
            onClick={() => setFilterCategory('enhanced')}
            className={`filter-btn ${filterCategory === 'enhanced' ? 'active' : ''}`}
          >
            <Zap size={14} />
            Enhanced
          </button>
        </div>
      </div>

      {/* Demo Section */}
      {(filterCategory === 'all' || filterCategory === 'demos') && displayDemos.length > 0 && (
        <section className="prompts-section">
          <div className="section-header">
            <h3 className="section-title">
              <Sparkles size={18} />
              Demo Prompts
            </h3>
            <span className="section-count">{displayDemos.length}</span>
          </div>
          <div className="prompts-grid">
            {displayDemos.map(renderPromptCard)}
          </div>
        </section>
      )}

      {/* User Prompts Section */}
      {(filterCategory === 'all' || filterCategory === 'mine' || filterCategory === 'enhanced') && displayUserPrompts.length > 0 && (
        <section className="prompts-section">
          <div className="section-header">
            <h3 className="section-title">
              My Prompts
              {isGuest && (
                <span className="unsaved-badge">
                  {displayUserPrompts.length} unsaved
                </span>
              )}
            </h3>
            <span className="section-count">{displayUserPrompts.length}</span>
          </div>
          <div className="prompts-grid">
            {displayUserPrompts.map(renderPromptCard)}
          </div>
        </section>
      )}

      {/* Empty State */}
      {allPrompts.length === 0 && (
        <div className="empty-state">
          {searchQuery || filterCategory !== 'all' ? (
            <>
              <Search size={48} />
              <h3>No prompts found</h3>
              <p>Try adjusting your search or filters</p>
              <button 
                onClick={() => {
                  setSearchQuery('');
                  setFilterCategory('all');
                }}
                className="btn-secondary"
              >
                Clear Filters
              </button>
            </>
          ) : (
            <>
              <Sparkles size={48} />
              <h3>No prompts yet</h3>
              <p>
                {isGuest 
                  ? 'Try duplicating a demo or create your own!' 
                  : 'Create your first prompt to get started'
                }
              </p>
              <button 
                onClick={handleCreatePrompt}
                className="btn-primary"
              >
                <Plus size={18} />
                Create First Prompt
              </button>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {enhancingPrompt && (
        <AIPromptEnhancer
          prompt={enhancingPrompt}
          onApply={handleApplyEnhancement}
          onClose={() => setEnhancingPrompt(null)}
          teamId={teamId}
          updatePrompt={updatePromptFirestore}
        />
      )}
    </div>
  );
}

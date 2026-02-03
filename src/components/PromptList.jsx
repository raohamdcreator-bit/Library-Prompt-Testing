// src/components/PromptList.jsx - FIXED: Complete working version
import React, { useState, useEffect, useMemo } from 'react';
import { collection, query, where, orderBy, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { useGuestMode } from '../context/GuestModeContext';
import { savePrompt, updatePrompt as updatePromptFirestore } from '../lib/prompts';
import { 
  getAllDemoPrompts, 
  isDemoPrompt, 
  duplicateDemoToUserPrompt,
  getPromptBadge,
  formatTimestamp,
} from '../lib/guestDemoContent';
import { guestState } from '../lib/guestState';
import AIPromptEnhancer from './AIPromptEnhancer';
import EditPromptModal from './EditPromptModal';
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
  FileText,
  Users,
  Lock,
  Unlock,
} from 'lucide-react';

export default function PromptList({ 
  activeTeam,
  userRole,
  isGuestMode = false,
  userId,
}) {
  const { user } = useAuth();
  const { checkSaveRequired, canEditPrompt } = useGuestMode();
  
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
  }, [isGuestMode, user, activeTeam]);

  const loadPrompts = async () => {
    if (isGuestMode) {
      setUserPrompts(guestState.getPrompts());
      setLoading(false);
    } else if (user && activeTeam) {
      await loadUserPromptsFromFirestore();
    } else {
      setLoading(false);
    }
  };

  const loadUserPromptsFromFirestore = async () => {
    try {
      setLoading(true);
      const q = query(
        collection(db, 'teams', activeTeam, 'prompts'),
        orderBy('createdAt', 'desc')
      );
      
      const querySnapshot = await getDocs(q);
      const prompts = querySnapshot.docs.map(doc => ({
        id: doc.id,
        teamId: activeTeam,
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
      if (isGuestMode) {
        const savedPrompt = guestState.addPrompt(userPrompt);
        setUserPrompts(prev => [savedPrompt, ...prev]);
        showToast('Demo copied! Edit it however you like.', 'success');
        setEditingPrompt(savedPrompt);
      } else {
        try {
          await savePrompt(user.uid, userPrompt, activeTeam);
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
          is_guest: isGuestMode,
        });
      }
    });
  };

  /**
   * Handle create new prompt
   */
  const handleCreatePrompt = () => {
    setEditingPrompt({ 
      isNew: true,
      title: '',
      text: '',
      tags: [],
      visibility: 'public',
    });
  };

  /**
   * Handle edit prompt
   */
  const handleEditPrompt = (prompt) => {
    if (!canEditPrompt(prompt)) {
      showToast('Cannot edit this prompt', 'warning');
      return;
    }
    
    setEditingPrompt(prompt);
  };

  /**
   * Handle save from edit modal
   */
  const handleSavePrompt = async (updates) => {
    try {
      if (editingPrompt.isNew) {
        // Create new prompt
        if (isGuestMode) {
          const newPrompt = guestState.addPrompt(updates);
          setUserPrompts(prev => [newPrompt, ...prev]);
          showToast('Prompt created!', 'success');
        } else {
          await savePrompt(user.uid, updates, activeTeam);
          await loadUserPromptsFromFirestore();
          showToast('Prompt created!', 'success');
        }
      } else {
        // Update existing prompt
        if (isGuestMode) {
          guestState.updatePrompt(editingPrompt.id, updates);
          setUserPrompts(prev => prev.map(p => 
            p.id === editingPrompt.id ? { ...p, ...updates } : p
          ));
          showToast('Prompt updated!', 'success');
        } else {
          await updatePromptFirestore(activeTeam, editingPrompt.id, updates);
          await loadUserPromptsFromFirestore();
          showToast('Prompt updated!', 'success');
        }
      }
      
      setEditingPrompt(null);
    } catch (error) {
      console.error('Error saving prompt:', error);
      showToast('Failed to save prompt', 'error');
    }
  };

  /**
   * Handle view prompt
   */
  const handleViewPrompt = (prompt) => {
    setViewingPrompt(prompt);
  };

  /**
   * Handle enhance prompt
   */
  const handleEnhancePrompt = (prompt) => {
    if (isDemoPrompt(prompt)) {
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
      if (isGuestMode) {
        guestState.deletePrompt(prompt.id);
        setUserPrompts(prev => prev.filter(p => p.id !== prompt.id));
        showToast('Prompt deleted', 'success');
      } else {
        await deleteDoc(doc(db, 'teams', activeTeam, 'prompts', prompt.id));
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
  const handleApplyEnhancement = async (enhancedPrompt) => {
    try {
      if (isGuestMode) {
        guestState.updatePrompt(enhancedPrompt.id, enhancedPrompt, true);
        setUserPrompts(prev => prev.map(p => 
          p.id === enhancedPrompt.id ? enhancedPrompt : p
        ));
      } else {
        await updatePromptFirestore(activeTeam, enhancedPrompt.id, enhancedPrompt);
        await loadUserPromptsFromFirestore();
      }
      setEnhancingPrompt(null);
      showToast('Enhancement applied!', 'success');
    } catch (error) {
      console.error('Error applying enhancement:', error);
      showToast('Failed to apply enhancement', 'error');
    }
  };

  /**
   * Handle save enhanced as new
   */
  const handleSaveEnhancedAsNew = async (enhancedPrompt) => {
    try {
      if (isGuestMode) {
        const newPrompt = guestState.addPrompt(enhancedPrompt);
        setUserPrompts(prev => [newPrompt, ...prev]);
      } else {
        await savePrompt(user.uid, enhancedPrompt, activeTeam);
        await loadUserPromptsFromFirestore();
      }
      setEnhancingPrompt(null);
      showToast('Saved as new prompt!', 'success');
    } catch (error) {
      console.error('Error saving new prompt:', error);
      showToast('Failed to save as new', 'error');
    }
  };

  /**
   * Show toast notification
   */
  const showToast = (message, type = 'info') => {
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.innerHTML = `
      <div class="success-icon">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <path d="M7 10L9 12L13 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
      <span>${message}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
      if (toast.parentNode) {
        document.body.removeChild(toast);
      }
    }, 3000);
  };

  /**
   * Render prompt card
   */
  const renderPromptCard = (prompt) => {
    const badge = getPromptBadge(prompt, isGuestMode);
    const isDemo = isDemoPrompt(prompt);
    const canEdit = canEditPrompt(prompt);
    
    return (
      <div 
        key={prompt.id} 
        className="prompt-card-premium"
        style={{
          animation: 'fadeInUp 0.5s ease-out backwards',
        }}
      >
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 className="prompt-title-premium">{prompt.title}</h3>
          </div>
          
          {/* Badge */}
          {badge && (
            <span 
              className="visibility-badge"
              style={{
                background: badge.type === 'demo' ? 'rgba(139, 92, 246, 0.1)' : 'rgba(251, 191, 36, 0.1)',
                borderColor: badge.type === 'demo' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(251, 191, 36, 0.2)',
                color: badge.type === 'demo' ? 'rgba(139, 92, 246, 0.9)' : 'rgba(251, 191, 36, 0.9)',
              }}
            >
              {badge.icon} {badge.label}
            </span>
          )}
        </div>
        
        {/* Preview */}
        <p className="prompt-content-preview">
          {prompt.text.substring(0, 150)}
          {prompt.text.length > 150 && '...'}
        </p>
        
        {/* Tags */}
        {prompt.tags && prompt.tags.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginTop: '0.875rem' }}>
            {prompt.tags.slice(0, 3).map((tag, i) => (
              <span key={i} className="tag-chip-premium">#{tag}</span>
            ))}
            {prompt.tags.length > 3 && (
              <span className="tag-chip-premium" style={{ opacity: 0.6 }}>
                +{prompt.tags.length - 3}
              </span>
            )}
          </div>
        )}
        
        {/* Metadata */}
        <div className="prompt-metadata" style={{ marginTop: '1rem' }}>
          {prompt.createdAt && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <FileText size={12} />
              {formatTimestamp(prompt.createdAt)}
            </span>
          )}
          {prompt.category && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              <Users size={12} />
              {prompt.category}
            </span>
          )}
          {prompt.visibility && !isDemo && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
              {prompt.visibility === 'private' ? <Lock size={12} /> : <Unlock size={12} />}
              {prompt.visibility}
            </span>
          )}
        </div>
        
        {/* Actions */}
        <div className="primary-actions" style={{ marginTop: '1rem' }}>
          {isDemo ? (
            <>
              <button 
                onClick={() => handleViewPrompt(prompt)}
                className="action-btn-premium"
                title="View demo prompt"
              >
                <Eye size={16} />
              </button>
              <button 
                onClick={() => handleDuplicateDemo(prompt)}
                className="action-btn-premium primary"
                title="Create your own copy"
              >
                <Copy size={16} />
              </button>
            </>
          ) : (
            <>
              <button 
                onClick={() => handleEditPrompt(prompt)}
                className="action-btn-premium"
                disabled={!canEdit}
                title="Edit prompt"
              >
                <Edit size={16} />
              </button>
              <button 
                onClick={() => handleEnhancePrompt(prompt)}
                className="action-btn-premium primary"
                disabled={!canEdit}
                title="AI enhance"
              >
                <Sparkles size={16} />
              </button>
              <button 
                onClick={() => handleDeletePrompt(prompt)}
                className="action-btn-premium danger"
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
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center', 
        justifyContent: 'center',
        padding: '4rem 2rem',
        gap: '1rem',
      }}>
        <div className="neo-spinner" style={{ width: '32px', height: '32px' }}></div>
        <p style={{ color: 'var(--muted-foreground)' }}>Loading prompts...</p>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header */}
      <div style={{ 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'space-between',
        marginBottom: '2rem',
        flexWrap: 'wrap',
        gap: '1rem',
      }}>
        <div>
          <h2 style={{ 
            fontSize: '1.5rem', 
            fontWeight: '700', 
            color: 'var(--foreground)',
            marginBottom: '0.25rem',
          }}>
            {isGuestMode ? 'Demo Prompts' : 'Your Prompts'}
          </h2>
          <p style={{ fontSize: '0.875rem', color: 'var(--muted-foreground)' }}>
            {isGuestMode 
              ? 'Explore examples and create your own' 
              : `${userPrompts.length} ${userPrompts.length === 1 ? 'prompt' : 'prompts'}`
            }
          </p>
        </div>
        <button 
          onClick={handleCreatePrompt}
          className="btn-premium"
        >
          <Plus size={18} />
          New Prompt
        </button>
      </div>

      {/* Search and Filters */}
      <div style={{ 
        display: 'flex', 
        gap: '1rem', 
        marginBottom: '2rem',
        flexWrap: 'wrap',
      }}>
        <div style={{ 
          flex: '1', 
          minWidth: '200px',
          position: 'relative',
        }}>
          <Search 
            size={18} 
            style={{ 
              position: 'absolute',
              left: '0.75rem',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--muted-foreground)',
            }}
          />
          <input
            type="text"
            placeholder="Search prompts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="search-input"
            style={{ paddingLeft: '2.5rem' }}
          />
        </div>
        
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={() => setFilterCategory('all')}
            className={`btn-secondary ${filterCategory === 'all' ? 'active' : ''}`}
            style={{
              background: filterCategory === 'all' ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
              borderColor: filterCategory === 'all' ? 'var(--primary)' : 'var(--border)',
            }}
          >
            All
          </button>
          <button
            onClick={() => setFilterCategory('demos')}
            className={`btn-secondary ${filterCategory === 'demos' ? 'active' : ''}`}
            style={{
              background: filterCategory === 'demos' ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
              borderColor: filterCategory === 'demos' ? 'var(--primary)' : 'var(--border)',
            }}
          >
            <Sparkles size={14} />
            Demos
          </button>
          <button
            onClick={() => setFilterCategory('mine')}
            className={`btn-secondary ${filterCategory === 'mine' ? 'active' : ''}`}
            style={{
              background: filterCategory === 'mine' ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
              borderColor: filterCategory === 'mine' ? 'var(--primary)' : 'var(--border)',
            }}
          >
            My Prompts
          </button>
          <button
            onClick={() => setFilterCategory('enhanced')}
            className={`btn-secondary ${filterCategory === 'enhanced' ? 'active' : ''}`}
            style={{
              background: filterCategory === 'enhanced' ? 'rgba(139, 92, 246, 0.1)' : 'transparent',
              borderColor: filterCategory === 'enhanced' ? 'var(--primary)' : 'var(--border)',
            }}
          >
            <Zap size={14} />
            Enhanced
          </button>
        </div>
      </div>

      {/* Demo Section */}
      {(filterCategory === 'all' || filterCategory === 'demos') && displayDemos.length > 0 && (
        <section style={{ marginBottom: '3rem' }}>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}>
            <Sparkles size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              color: 'var(--foreground)',
              margin: 0,
            }}>
              Demo Prompts
            </h3>
            <span style={{ 
              fontSize: '0.875rem',
              color: 'var(--muted-foreground)',
              background: 'rgba(139, 92, 246, 0.1)',
              padding: '0.25rem 0.625rem',
              borderRadius: '6px',
            }}>
              {displayDemos.length}
            </span>
          </div>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
          }}>
            {displayDemos.map(renderPromptCard)}
          </div>
        </section>
      )}

      {/* User Prompts Section */}
      {(filterCategory === 'all' || filterCategory === 'mine' || filterCategory === 'enhanced') && displayUserPrompts.length > 0 && (
        <section>
          <div style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '0.75rem',
            marginBottom: '1.5rem',
          }}>
            <FileText size={20} style={{ color: 'var(--primary)' }} />
            <h3 style={{ 
              fontSize: '1.125rem', 
              fontWeight: '600', 
              color: 'var(--foreground)',
              margin: 0,
            }}>
              My Prompts
            </h3>
            {isGuestMode && displayUserPrompts.length > 0 && (
              <span style={{ 
                fontSize: '0.75rem',
                color: 'rgba(251, 191, 36, 0.9)',
                background: 'rgba(251, 191, 36, 0.1)',
                padding: '0.25rem 0.625rem',
                borderRadius: '6px',
                border: '1px solid rgba(251, 191, 36, 0.2)',
              }}>
                {displayUserPrompts.length} unsaved
              </span>
            )}
          </div>
          <div style={{ 
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
          }}>
            {displayUserPrompts.map(renderPromptCard)}
          </div>
        </section>
      )}

      {/* Empty State */}
      {allPrompts.length === 0 && (
        <div className="glass-card" style={{ 
          padding: '4rem 2rem',
          textAlign: 'center',
        }}>
          {searchQuery || filterCategory !== 'all' ? (
            <>
              <Search size={48} style={{ color: 'var(--muted-foreground)', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
                No prompts found
              </h3>
              <p style={{ color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>
                Try adjusting your search or filters
              </p>
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
              <Sparkles size={48} style={{ color: 'var(--primary)', margin: '0 auto 1rem' }} />
              <h3 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '0.5rem', color: 'var(--foreground)' }}>
                No prompts yet
              </h3>
              <p style={{ color: 'var(--muted-foreground)', marginBottom: '1.5rem' }}>
                {isGuestMode 
                  ? 'Try duplicating a demo or create your own!' 
                  : 'Create your first prompt to get started'
                }
              </p>
              <button 
                onClick={handleCreatePrompt}
                className="btn-premium"
              >
                <Plus size={18} />
                Create First Prompt
              </button>
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {editingPrompt && (
        <EditPromptModal
          open={true}
          prompt={editingPrompt}
          onClose={() => setEditingPrompt(null)}
          onSave={handleSavePrompt}
        />
      )}

      {enhancingPrompt && (
        <AIPromptEnhancer
          prompt={enhancingPrompt}
          onApply={handleApplyEnhancement}
          onSaveAsNew={handleSaveEnhancedAsNew}
          onClose={() => setEnhancingPrompt(null)}
        />
      )}

      {viewingPrompt && (
        <div 
          className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
          style={{ background: 'rgba(0, 0, 0, 0.8)' }}
          onClick={() => setViewingPrompt(null)}
        >
          <div 
            className="glass-card w-full max-w-2xl p-6"
            style={{ borderRadius: '16px' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.25rem', fontWeight: '700', color: 'var(--foreground)' }}>
                {viewingPrompt.title}
              </h3>
              <button
                onClick={() => setViewingPrompt(null)}
                className="action-btn-premium"
              >
                <Eye size={20} />
              </button>
            </div>
            
            <div style={{ 
              padding: '1rem',
              background: 'var(--background)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              marginBottom: '1rem',
              maxHeight: '400px',
              overflowY: 'auto',
            }}>
              <pre style={{ 
                fontFamily: 'monospace',
                fontSize: '0.875rem',
                color: 'var(--foreground)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}>
                {viewingPrompt.text}
              </pre>
            </div>

            {viewingPrompt.tags && viewingPrompt.tags.length > 0 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                {viewingPrompt.tags.map((tag, index) => (
                  <span key={index} className="tag-chip-premium">
                    #{tag}
                  </span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

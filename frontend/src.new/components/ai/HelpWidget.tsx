import { useState, useEffect, useRef } from 'react';
import { HelpCircle, X, MessageSquare, ChevronRight, Loader2, Bot } from 'lucide-react';
import './HelpWidget.css';

interface HelpSuggestion {
  question: string;
  category: 'quick' | 'how-to' | 'explain';
}

interface HelpWidgetProps {
  currentPage: string;
  aiEnabled?: boolean;
  onOpenChat?: (initialMessage?: string) => void;
  onConfigure?: () => void;
}

// Context-aware suggestions for each page
const PAGE_SUGGESTIONS: Record<string, HelpSuggestion[]> = {
  dashboard: [
    { question: 'What do these dashboard stats mean?', category: 'explain' },
    { question: 'How do I customize my dashboard widgets?', category: 'how-to' },
    { question: 'Show me users who haven\'t logged in recently', category: 'quick' },
  ],
  users: [
    { question: 'How do I add a new user?', category: 'how-to' },
    { question: 'How do I bulk import users from CSV?', category: 'how-to' },
    { question: 'Show me inactive users', category: 'quick' },
    { question: 'Generate a user export report', category: 'quick' },
  ],
  groups: [
    { question: 'What\'s the difference between static and dynamic groups?', category: 'explain' },
    { question: 'How do I create a dynamic group?', category: 'how-to' },
    { question: 'List all groups with member counts', category: 'quick' },
  ],
  settings: [
    { question: 'How do I connect Google Workspace?', category: 'how-to' },
    { question: 'How do I set up Microsoft 365 integration?', category: 'how-to' },
    { question: 'What are the required API scopes?', category: 'explain' },
  ],
  signatures: [
    { question: 'How do I create a signature template?', category: 'how-to' },
    { question: 'How do signature assignments work?', category: 'explain' },
    { question: 'How do I track signature engagement?', category: 'how-to' },
  ],
  'audit-logs': [
    { question: 'What events are logged?', category: 'explain' },
    { question: 'How do I filter audit logs by user?', category: 'how-to' },
    { question: 'Show recent admin actions', category: 'quick' },
  ],
  'security-events': [
    { question: 'What security events should I monitor?', category: 'explain' },
    { question: 'How do I set up security alerts?', category: 'how-to' },
  ],
  'onboarding-templates': [
    { question: 'How do onboarding templates work?', category: 'explain' },
    { question: 'How do I create a new onboarding template?', category: 'how-to' },
    { question: 'What actions can be automated in onboarding?', category: 'explain' },
  ],
  'offboarding-templates': [
    { question: 'How do offboarding templates work?', category: 'explain' },
    { question: 'How do I set up data transfer during offboarding?', category: 'how-to' },
  ],
  people: [
    { question: 'How do I find someone in the directory?', category: 'how-to' },
    { question: 'How do I update my profile?', category: 'how-to' },
  ],
  orgChart: [
    { question: 'How does the org chart hierarchy work?', category: 'explain' },
    { question: 'How do I update reporting relationships?', category: 'how-to' },
  ],
  console: [
    { question: 'What API endpoints are available?', category: 'explain' },
    { question: 'How do I test an API call?', category: 'how-to' },
    { question: 'Generate a curl command for user creation', category: 'quick' },
  ],
  // Default suggestions for unknown pages
  default: [
    { question: 'How do I use Helios?', category: 'explain' },
    { question: 'Show me a summary of my organization', category: 'quick' },
    { question: 'What can I do from here?', category: 'explain' },
  ],
};

export function HelpWidget({
  currentPage,
  aiEnabled = false,
  onOpenChat,
  onConfigure,
}: HelpWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quickAnswer, setQuickAnswer] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Get suggestions for current page
  const suggestions = PAGE_SUGGESTIONS[currentPage] || PAGE_SUGGESTIONS.default;

  // Close widget when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (widgetRef.current && !widgetRef.current.contains(event.target as Node)) {
        setIsOpen(false);
        setQuickAnswer(null);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Handle keyboard shortcut (? key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not in an input field
      if (
        e.key === '?' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
        setQuickAnswer(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  // Handle quick question (get a brief answer)
  const handleQuickQuestion = async (question: string) => {
    if (!aiEnabled) {
      if (onConfigure) onConfigure();
      return;
    }

    setIsLoading(true);
    setQuickAnswer(null);

    try {
      const token = localStorage.getItem('helios_token');
      const res = await fetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          message: question,
          pageContext: currentPage,
          quickMode: true, // Request shorter response
        })
      });

      const data = await res.json();
      if (data.success) {
        setQuickAnswer(data.data.message);
      } else {
        // Fall back to opening chat for full answer
        handleOpenChat(question);
      }
    } catch {
      // Fall back to opening chat
      handleOpenChat(question);
    } finally {
      setIsLoading(false);
    }
  };

  // Open full chat with question
  const handleOpenChat = (question?: string) => {
    setIsOpen(false);
    setQuickAnswer(null);
    if (onOpenChat) {
      onOpenChat(question);
    }
  };

  const getCategoryIcon = (category: HelpSuggestion['category']) => {
    switch (category) {
      case 'quick':
        return <span className="category-badge quick">Quick</span>;
      case 'how-to':
        return <span className="category-badge how-to">How-to</span>;
      case 'explain':
        return <span className="category-badge explain">Explain</span>;
      default:
        return null;
    }
  };

  return (
    <div className="help-widget" ref={widgetRef}>
      {/* Floating button */}
      <button
        className={`help-widget-button ${isOpen ? 'active' : ''}`}
        onClick={() => {
          setIsOpen(!isOpen);
          setQuickAnswer(null);
        }}
        title="Get help (press ?)"
        aria-label="Help"
      >
        {isOpen ? <X size={20} /> : <HelpCircle size={20} />}
      </button>

      {/* Popup panel */}
      {isOpen && (
        <div className="help-widget-popup">
          <div className="help-widget-header">
            <div className="help-widget-title">
              <HelpCircle size={16} />
              <span>Quick Help</span>
            </div>
            <span className="help-page-context">{formatPageName(currentPage)}</span>
          </div>

          {!aiEnabled ? (
            <div className="help-widget-disabled">
              <Bot size={32} className="disabled-icon" />
              <p>AI Assistant is not available</p>
              {onConfigure && (
                <button className="configure-btn" onClick={onConfigure}>
                  Go to AI Settings
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Quick answer display */}
              {quickAnswer && (
                <div className="quick-answer">
                  <div className="quick-answer-header">
                    <Bot size={14} />
                    <span>AI Assistant</span>
                  </div>
                  <p>{quickAnswer}</p>
                  <button
                    className="expand-chat-btn"
                    onClick={() => handleOpenChat()}
                  >
                    Continue in chat
                    <ChevronRight size={14} />
                  </button>
                </div>
              )}

              {/* Loading state */}
              {isLoading && (
                <div className="help-loading">
                  <Loader2 size={20} className="spin" />
                  <span>Getting answer...</span>
                </div>
              )}

              {/* Suggestions */}
              {!quickAnswer && !isLoading && (
                <div className="help-suggestions">
                  <p className="suggestions-label">Suggested questions:</p>
                  <ul>
                    {suggestions.map((suggestion, index) => (
                      <li key={index}>
                        <button
                          onClick={() => handleQuickQuestion(suggestion.question)}
                          className="suggestion-btn"
                        >
                          <span className="suggestion-text">{suggestion.question}</span>
                          {getCategoryIcon(suggestion.category)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Open full chat */}
              <div className="help-widget-footer">
                <button
                  className="open-chat-btn"
                  onClick={() => handleOpenChat()}
                >
                  <MessageSquare size={14} />
                  <span>Open full chat</span>
                </button>
                <span className="keyboard-hint">
                  Press <kbd>?</kbd> to toggle
                </span>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Helper to format page name for display
function formatPageName(page: string): string {
  const names: Record<string, string> = {
    dashboard: 'Dashboard',
    users: 'Users',
    groups: 'Groups',
    settings: 'Settings',
    signatures: 'Signatures',
    'audit-logs': 'Audit Logs',
    'security-events': 'Security Events',
    'onboarding-templates': 'Onboarding',
    'offboarding-templates': 'Offboarding',
    people: 'People Directory',
    orgChart: 'Org Chart',
    console: 'Developer Console',
    workspaces: 'Workspaces',
    'files-assets': 'Files & Assets',
    administrators: 'Administrators',
  };
  return names[page] || page.charAt(0).toUpperCase() + page.slice(1).replace(/-/g, ' ');
}

export default HelpWidget;

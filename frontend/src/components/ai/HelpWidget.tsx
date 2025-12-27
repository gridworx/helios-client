import { useState, useEffect, useRef } from 'react';
import { HelpCircle, X, MessageSquare, ChevronRight, Loader2, Bot } from 'lucide-react';
import { authFetch } from '../../config/api';
import './HelpWidget.css';

interface HelpSuggestion {
  question: string;
  category: 'quick' | 'how-to' | 'explain';
}

interface HelpWidgetProps {
  currentPage: string;
  subContext?: string; // e.g., 'active', 'staged', 'suspended', 'deleted' for users page
  aiEnabled?: boolean;
  onOpenChat?: (initialMessage?: string) => void;
  onConfigure?: () => void;
  externalOpen?: boolean; // Allow parent to control open state
  onExternalClose?: () => void; // Callback when closed (for parent state sync)
  hideFloatingButton?: boolean; // Hide the floating button (when header button is used)
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
    { question: 'What\'s the difference between Quick Add and Full Onboarding?', category: 'explain' },
    { question: 'How do I export users?', category: 'how-to' },
  ],
  // User status tabs - specific help for each view
  'users-active': [
    { question: 'What makes a user "active"?', category: 'explain' },
    { question: 'How do I suspend an active user?', category: 'how-to' },
    { question: 'Show users who haven\'t logged in for 30 days', category: 'quick' },
  ],
  'users-staged': [
    { question: 'What is a staged user?', category: 'explain' },
    { question: 'How do I complete setup for a staged user?', category: 'how-to' },
    { question: 'How do staged users relate to onboarding?', category: 'explain' },
  ],
  'users-suspended': [
    { question: 'What happens when a user is suspended?', category: 'explain' },
    { question: 'How do I reactivate a suspended user?', category: 'how-to' },
    { question: 'Can suspended users still access their data?', category: 'explain' },
  ],
  'users-deleted': [
    { question: 'Can I recover a deleted user?', category: 'how-to' },
    { question: 'How long are deleted users retained?', category: 'explain' },
    { question: 'What happens to a deleted user\'s data?', category: 'explain' },
  ],
  guests: [
    { question: 'What is a guest user?', category: 'explain' },
    { question: 'How do I set an expiration date for guests?', category: 'how-to' },
    { question: 'What can guest users access?', category: 'explain' },
  ],
  contacts: [
    { question: 'What are contacts used for?', category: 'explain' },
    { question: 'How do contacts differ from users?', category: 'explain' },
    { question: 'How do I import contacts?', category: 'how-to' },
  ],
  groups: [
    { question: 'What\'s the difference between static and dynamic groups?', category: 'explain' },
    { question: 'How do I create a dynamic group?', category: 'how-to' },
    { question: 'How do groups sync with Google Workspace?', category: 'explain' },
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
    { question: 'What triggers a security alert?', category: 'explain' },
    { question: 'How do I investigate suspicious activity?', category: 'how-to' },
  ],
  'onboarding-templates': [
    { question: 'How do onboarding templates work?', category: 'explain' },
    { question: 'How do I create a new onboarding template?', category: 'how-to' },
    { question: 'What actions can be automated in onboarding?', category: 'explain' },
  ],
  'offboarding-templates': [
    { question: 'How do offboarding templates work?', category: 'explain' },
    { question: 'How do I set up data transfer during offboarding?', category: 'how-to' },
    { question: 'What steps are automated in offboarding?', category: 'explain' },
  ],
  'scheduled-actions': [
    { question: 'What are scheduled actions?', category: 'explain' },
    { question: 'How do I schedule a user status change?', category: 'how-to' },
    { question: 'Can I cancel a scheduled action?', category: 'how-to' },
  ],
  requests: [
    { question: 'What types of requests can be submitted?', category: 'explain' },
    { question: 'How do I approve or deny a request?', category: 'how-to' },
    { question: 'How do requests create staged users?', category: 'explain' },
  ],
  people: [
    { question: 'How do I find someone in the directory?', category: 'how-to' },
    { question: 'How do I update my profile?', category: 'how-to' },
    { question: 'Who can see my profile information?', category: 'explain' },
  ],
  orgChart: [
    { question: 'How does the org chart hierarchy work?', category: 'explain' },
    { question: 'How do I update reporting relationships?', category: 'how-to' },
    { question: 'Why is someone missing from the org chart?', category: 'explain' },
  ],
  console: [
    { question: 'What API endpoints are available?', category: 'explain' },
    { question: 'How do I test an API call?', category: 'how-to' },
    { question: 'How do I create an API key?', category: 'how-to' },
  ],
  assets: [
    { question: 'How do I track IT assets?', category: 'how-to' },
    { question: 'How do I assign an asset to a user?', category: 'how-to' },
    { question: 'What asset types can I track?', category: 'explain' },
  ],
  'files-assets': [
    { question: 'How do I upload media files?', category: 'how-to' },
    { question: 'What file types are supported?', category: 'explain' },
    { question: 'How do I use files in signatures?', category: 'how-to' },
  ],
  'external-sharing': [
    { question: 'What is external sharing?', category: 'explain' },
    { question: 'How do I audit external file sharing?', category: 'how-to' },
    { question: 'How do I restrict external sharing?', category: 'how-to' },
  ],
  'email-security': [
    { question: 'How do I search email logs?', category: 'how-to' },
    { question: 'What email security features are available?', category: 'explain' },
    { question: 'How do I trace an email delivery?', category: 'how-to' },
  ],
  workspaces: [
    { question: 'What are workspaces?', category: 'explain' },
    { question: 'How do workspaces sync from Microsoft Teams?', category: 'explain' },
    { question: 'How do I manage workspace membership?', category: 'how-to' },
  ],
  administrators: [
    { question: 'What can administrators do?', category: 'explain' },
    { question: 'How do I add a new administrator?', category: 'how-to' },
    { question: 'What\'s the difference between admin roles?', category: 'explain' },
  ],
  'my-profile': [
    { question: 'How do I update my profile photo?', category: 'how-to' },
    { question: 'What profile fields can I edit?', category: 'explain' },
    { question: 'Who can see my profile?', category: 'explain' },
  ],
  'my-team': [
    { question: 'Who is on my team?', category: 'explain' },
    { question: 'How do I view my direct reports?', category: 'how-to' },
  ],
  'my-groups': [
    { question: 'What groups am I a member of?', category: 'explain' },
    { question: 'How do I request to join a group?', category: 'how-to' },
  ],
  // Default suggestions for unknown pages
  default: [
    { question: 'How do I use Helios?', category: 'explain' },
    { question: 'What can I do from this page?', category: 'explain' },
    { question: 'Where can I find help documentation?', category: 'how-to' },
  ],
};

export function HelpWidget({
  currentPage,
  subContext,
  aiEnabled = false,
  onOpenChat,
  onConfigure,
  externalOpen,
  onExternalClose,
  hideFloatingButton = false,
}: HelpWidgetProps) {
  const [internalOpen, setInternalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [quickAnswer, setQuickAnswer] = useState<string | null>(null);
  const widgetRef = useRef<HTMLDivElement>(null);

  // Use external control if provided, otherwise use internal state
  const isOpen = externalOpen !== undefined ? externalOpen : internalOpen;
  const setIsOpen = (open: boolean) => {
    if (externalOpen !== undefined) {
      // Externally controlled - notify parent
      if (!open && onExternalClose) {
        onExternalClose();
      }
    } else {
      setInternalOpen(open);
    }
  };

  // Get suggestions for current page, with sub-context support
  // e.g., 'users' + 'staged' -> try 'users-staged' first, fall back to 'users'
  const contextKey = subContext ? `${currentPage}-${subContext}` : currentPage;
  const suggestions = PAGE_SUGGESTIONS[contextKey] || PAGE_SUGGESTIONS[currentPage] || PAGE_SUGGESTIONS.default;
  const displayContext = subContext ? contextKey : currentPage;

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
  }, [isOpen, onExternalClose]);

  // Handle keyboard shortcut (? key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only trigger if not in an input field
      if (
        e.key === '?' &&
        !['INPUT', 'TEXTAREA', 'SELECT'].includes((e.target as HTMLElement).tagName)
      ) {
        e.preventDefault();
        setIsOpen(!isOpen);
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
      const res = await authFetch('/api/v1/ai/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
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
      {/* Floating button - can be hidden when header button is used */}
      {!hideFloatingButton && (
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
      )}

      {/* Slide-in panel */}
      {isOpen && (
        <div className="help-widget-popup">
          <div className="help-widget-header">
            <div className="help-widget-title">
              <HelpCircle size={16} />
              <span>Quick Help</span>
            </div>
            <div className="help-header-actions">
              <span className="help-page-context">{formatPageName(displayContext)}</span>
              <button
                className="help-close-btn"
                onClick={() => setIsOpen(false)}
                title="Close"
              >
                <X size={16} />
              </button>
            </div>
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
    'users-active': 'Active Users',
    'users-staged': 'Staged Users',
    'users-suspended': 'Suspended Users',
    'users-deleted': 'Deleted Users',
    guests: 'Guests',
    contacts: 'Contacts',
    groups: 'Groups',
    settings: 'Settings',
    signatures: 'Signatures',
    'audit-logs': 'Audit Logs',
    'security-events': 'Security Events',
    'onboarding-templates': 'Onboarding Templates',
    'offboarding-templates': 'Offboarding Templates',
    'scheduled-actions': 'Scheduled Actions',
    requests: 'Requests',
    people: 'People Directory',
    orgChart: 'Org Chart',
    console: 'Developer Console',
    workspaces: 'Workspaces',
    'files-assets': 'Media Files',
    assets: 'IT Assets',
    'external-sharing': 'External Sharing',
    'email-security': 'Mail Search',
    administrators: 'Administrators',
    'my-profile': 'My Profile',
    'my-team': 'My Team',
    'my-groups': 'My Groups',
  };
  return names[page] || page.charAt(0).toUpperCase() + page.slice(1).replace(/-/g, ' ');
}

export default HelpWidget;

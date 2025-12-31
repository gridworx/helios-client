import { useState, useMemo, useEffect } from 'react';
import { Search, ChevronLeft, ChevronRight, X, Pin, PinOff, Plus, Copy, Loader2 } from 'lucide-react';
import './ConsoleHelpPanel.css';

export interface CommandInfo {
  command: string;
  description: string;
  example?: string;
}

export interface CommandSection {
  title: string;
  commands: CommandInfo[];
}

interface ConsoleHelpPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onInsertCommand: (command: string) => void;
  dockPosition: 'left' | 'right';
  onChangeDockPosition: (position: 'left' | 'right') => void;
  isPinned: boolean;
  onTogglePin: () => void;
}

export function ConsoleHelpPanel({
  isOpen,
  onClose,
  onInsertCommand,
  dockPosition,
  onChangeDockPosition,
  isPinned,
  onTogglePin
}: ConsoleHelpPanelProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [copiedCommand, setCopiedCommand] = useState<string | null>(null);
  const [commandSections, setCommandSections] = useState<CommandSection[]>([]);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch commands from backend API
  useEffect(() => {
    if (!isOpen) return;

    const fetchCommands = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetch('/api/v1/help/commands');
        if (!response.ok) {
          throw new Error('Failed to fetch commands');
        }
        const data = await response.json();
        if (data.success && data.data?.sections) {
          setCommandSections(data.data.sections);
          // Expand all sections by default
          setExpandedSections(new Set(data.data.sections.map((s: CommandSection) => s.title)));
        } else {
          throw new Error('Invalid response format');
        }
      } catch (err) {
        console.error('Error fetching commands:', err);
        setError('Failed to load commands');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCommands();
  }, [isOpen]);

  // Filter commands based on search query
  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) {
      return commandSections;
    }

    const query = searchQuery.toLowerCase();
    return commandSections.map(section => ({
      ...section,
      commands: section.commands.filter(cmd =>
        cmd.command.toLowerCase().includes(query) ||
        cmd.description.toLowerCase().includes(query)
      )
    })).filter(section => section.commands.length > 0);
  }, [searchQuery, commandSections]);

  const toggleSection = (title: string) => {
    setExpandedSections(prev => {
      const newSet = new Set(prev);
      if (newSet.has(title)) {
        newSet.delete(title);
      } else {
        newSet.add(title);
      }
      return newSet;
    });
  };

  const handleInsert = (command: string) => {
    onInsertCommand(command);
  };

  const handleCopy = async (command: string) => {
    try {
      await navigator.clipboard.writeText(command);
      setCopiedCommand(command);
      setTimeout(() => setCopiedCommand(null), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className={`console-help-panel dock-${dockPosition}`}>
      <div className="help-panel-header">
        <h3>Commands</h3>
        <div className="header-actions">
          <button
            className="panel-action-btn"
            onClick={onTogglePin}
            title={isPinned ? 'Unpin panel' : 'Pin panel'}
          >
            {isPinned ? <PinOff size={14} /> : <Pin size={14} />}
          </button>
          <button
            className="panel-action-btn"
            onClick={() => onChangeDockPosition(dockPosition === 'left' ? 'right' : 'left')}
            title={`Dock to ${dockPosition === 'left' ? 'right' : 'left'}`}
          >
            {dockPosition === 'left' ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
          </button>
          <button
            className="panel-action-btn"
            onClick={onClose}
            title="Close panel"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      <div className="help-panel-search">
        <Search size={14} className="search-icon" />
        <input
          type="text"
          placeholder="Search commands..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="search-input"
        />
        {searchQuery && (
          <button className="clear-search" onClick={() => setSearchQuery('')}>
            <X size={12} />
          </button>
        )}
      </div>

      <div className="help-panel-content">
        {isLoading ? (
          <div className="loading-state">
            <Loader2 size={20} className="spinner" />
            <span>Loading commands...</span>
          </div>
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button onClick={() => setIsLoading(true)}>Retry</button>
          </div>
        ) : filteredSections.length === 0 ? (
          <div className="no-results">
            <p>No commands match "{searchQuery}"</p>
          </div>
        ) : (
          filteredSections.map(section => (
            <div key={section.title} className="command-section">
              <button
                className="section-header"
                onClick={() => toggleSection(section.title)}
              >
                <span className="section-title">{section.title}</span>
                <span className="section-count">{section.commands.length}</span>
                <span className={`section-arrow ${expandedSections.has(section.title) ? 'expanded' : ''}`}>
                  <ChevronRight size={14} />
                </span>
              </button>
              {expandedSections.has(section.title) && (
                <div className="section-commands">
                  {section.commands.map((cmd, idx) => (
                    <div key={`${cmd.command}-${idx}`} className="command-item">
                      <div className="command-main">
                        <code className="command-syntax">{cmd.command}</code>
                        <p className="command-description">{cmd.description}</p>
                      </div>
                      <div className="command-actions">
                        <button
                          className="insert-btn"
                          onClick={() => handleInsert(cmd.example || cmd.command)}
                          title="Insert into console"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          className={`copy-btn ${copiedCommand === (cmd.example || cmd.command) ? 'copied' : ''}`}
                          onClick={() => handleCopy(cmd.example || cmd.command)}
                          title="Copy to clipboard"
                        >
                          <Copy size={12} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <div className="help-panel-footer">
        <span className="tip">Tip: The "helios" prefix is optional</span>
      </div>
    </div>
  );
}

export default ConsoleHelpPanel;

import { useState, useEffect } from 'react';
import {
  Loader2,
  Save,
  TestTube,
  CheckCircle,
  XCircle,
  Eye,
  EyeOff,
  Bot,
  Zap,
  Server,
  Activity
} from 'lucide-react';
import './AISettings.css';

interface AIConfig {
  isConfigured: boolean;
  isEnabled: boolean;
  primaryEndpointUrl: string;
  primaryModel: string;
  hasPrimaryApiKey: boolean;
  fallbackEndpointUrl: string | null;
  fallbackModel: string | null;
  hasFallbackApiKey: boolean;
  toolCallModel: string | null;
  maxTokensPerRequest: number;
  temperature: number;
  contextWindowTokens: number;
  requestsPerMinuteLimit: number;
  tokensPerDayLimit: number;
}

interface TestResult {
  success: boolean;
  message: string;
  modelInfo?: {
    model: string;
    responseTime: number;
  };
  error?: string;
}

interface UsageStats {
  totalRequests: number;
  totalTokens: number;
  avgLatencyMs: number;
  errorRate: number;
  byDay: Array<{ date: string; requests: number; tokens: number }>;
  byModel: Array<{ model: string; requests: number; tokens: number }>;
}

interface AISettingsProps {
  organizationId: string;
}

const COMMON_ENDPOINTS = [
  { label: 'OpenAI', value: 'https://api.openai.com/v1' },
  { label: 'Azure OpenAI', value: '' },
  { label: 'Anthropic (via LiteLLM)', value: 'https://api.anthropic.com/v1' },
  { label: 'Ollama (local)', value: 'http://localhost:11434/v1' },
  { label: 'vLLM (local)', value: 'http://localhost:8000/v1' },
  { label: 'OpenRouter', value: 'https://openrouter.ai/api/v1' },
  { label: 'Groq', value: 'https://api.groq.com/openai/v1' },
  { label: 'Together AI', value: 'https://api.together.xyz/v1' },
  { label: 'Custom', value: '' }
];

const COMMON_MODELS = [
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-3.5-turbo',
  'claude-3-opus',
  'claude-3-sonnet',
  'claude-3-haiku',
  'llama3.1:70b',
  'llama3.1:8b',
  'mixtral:8x7b'
];

export function AISettings({ organizationId }: AISettingsProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTesting, setIsTesting] = useState<'primary' | 'fallback' | null>(null);
  const [testResult, setTestResult] = useState<{ type: 'primary' | 'fallback'; result: TestResult } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [showPrimaryKey, setShowPrimaryKey] = useState(false);
  const [showFallbackKey, setShowFallbackKey] = useState(false);
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null);

  // Form state
  const [isEnabled, setIsEnabled] = useState(false);
  const [primaryEndpointUrl, setPrimaryEndpointUrl] = useState('https://api.openai.com/v1');
  const [primaryApiKey, setPrimaryApiKey] = useState('');
  const [primaryModel, setPrimaryModel] = useState('gpt-4o');
  const [hasPrimaryApiKey, setHasPrimaryApiKey] = useState(false);

  const [enableFallback, setEnableFallback] = useState(false);
  const [fallbackEndpointUrl, setFallbackEndpointUrl] = useState('');
  const [fallbackApiKey, setFallbackApiKey] = useState('');
  const [fallbackModel, setFallbackModel] = useState('');
  const [hasFallbackApiKey, setHasFallbackApiKey] = useState(false);

  const [toolCallModel, setToolCallModel] = useState('');
  const [enableToolCallModel, setEnableToolCallModel] = useState(false);

  const [maxTokensPerRequest, setMaxTokensPerRequest] = useState(4096);
  const [temperature, setTemperature] = useState(0.7);
  const [requestsPerMinuteLimit, setRequestsPerMinuteLimit] = useState(20);
  const [tokensPerDayLimit, setTokensPerDayLimit] = useState(100000);

  useEffect(() => {
    fetchConfig();
    fetchUsage();
  }, [organizationId]);

  const fetchConfig = async () => {
    try {
      setIsLoading(true);
      const token = localStorage.getItem('helios_token');
      const response = await fetch('/api/v1/ai/config', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success && data.data.isConfigured) {
        const config: AIConfig = data.data;
        setIsEnabled(config.isEnabled);
        setPrimaryEndpointUrl(config.primaryEndpointUrl);
        setPrimaryModel(config.primaryModel);
        setHasPrimaryApiKey(config.hasPrimaryApiKey);

        if (config.fallbackEndpointUrl) {
          setEnableFallback(true);
          setFallbackEndpointUrl(config.fallbackEndpointUrl);
          setFallbackModel(config.fallbackModel || '');
          setHasFallbackApiKey(config.hasFallbackApiKey);
        }

        if (config.toolCallModel) {
          setEnableToolCallModel(true);
          setToolCallModel(config.toolCallModel);
        }

        setMaxTokensPerRequest(config.maxTokensPerRequest);
        setTemperature(config.temperature);
        setRequestsPerMinuteLimit(config.requestsPerMinuteLimit);
        setTokensPerDayLimit(config.tokensPerDayLimit);
      }
    } catch (err) {
      console.error('Failed to fetch AI config:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchUsage = async () => {
    try {
      const token = localStorage.getItem('helios_token');
      const response = await fetch('/api/v1/ai/usage?days=30', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      const data = await response.json();
      if (data.success) {
        setUsageStats(data.data);
      }
    } catch (err) {
      console.error('Failed to fetch AI usage:', err);
    }
  };

  const handleTestConnection = async (type: 'primary' | 'fallback') => {
    setIsTesting(type);
    setTestResult(null);

    try {
      const token = localStorage.getItem('helios_token');
      const endpoint = type === 'primary' ? primaryEndpointUrl : fallbackEndpointUrl;
      const apiKey = type === 'primary' ? primaryApiKey : fallbackApiKey;
      const model = type === 'primary' ? primaryModel : fallbackModel;

      const response = await fetch('/api/v1/ai/test-connection', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ endpoint, apiKey: apiKey || undefined, model })
      });

      const data = await response.json();
      setTestResult({ type, result: data.data || data });
    } catch (err: any) {
      setTestResult({
        type,
        result: { success: false, message: 'Test failed', error: err.message }
      });
    } finally {
      setIsTesting(null);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const token = localStorage.getItem('helios_token');
      const config: Record<string, any> = {
        isEnabled,
        primaryEndpointUrl,
        primaryModel,
        maxTokensPerRequest,
        temperature,
        requestsPerMinuteLimit,
        tokensPerDayLimit
      };

      // Only include API key if it's been changed
      if (primaryApiKey) {
        config.primaryApiKey = primaryApiKey;
      }

      if (enableFallback && fallbackEndpointUrl && fallbackModel) {
        config.fallbackEndpointUrl = fallbackEndpointUrl;
        config.fallbackModel = fallbackModel;
        if (fallbackApiKey) {
          config.fallbackApiKey = fallbackApiKey;
        }
      } else {
        config.fallbackEndpointUrl = null;
        config.fallbackModel = null;
        config.fallbackApiKey = null;
      }

      if (enableToolCallModel && toolCallModel) {
        config.toolCallModel = toolCallModel;
      } else {
        config.toolCallModel = null;
      }

      const response = await fetch('/api/v1/ai/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });

      const data = await response.json();
      if (data.success) {
        setSuccessMessage('AI configuration saved successfully');
        // Clear API key fields after save (they're now stored)
        setPrimaryApiKey('');
        setFallbackApiKey('');
        setHasPrimaryApiKey(true);
        if (enableFallback) {
          setHasFallbackApiKey(true);
        }
        setTimeout(() => setSuccessMessage(null), 3000);
      } else {
        setError(data.message || 'Failed to save configuration');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="ai-settings-loading">
        <Loader2 className="spin" size={24} />
        <span>Loading AI configuration...</span>
      </div>
    );
  }

  return (
    <div className="ai-settings">
      <div className="ai-settings-header">
        <div className="header-icon">
          <Bot size={24} />
        </div>
        <div className="header-text">
          <h2>AI Assistant</h2>
          <p>Configure an AI assistant powered by your choice of LLM provider</p>
        </div>
        <div className="header-toggle">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={isEnabled}
              onChange={(e) => setIsEnabled(e.target.checked)}
            />
            <span className="toggle-slider"></span>
            <span className="toggle-text">{isEnabled ? 'Enabled' : 'Disabled'}</span>
          </label>
        </div>
      </div>

      {error && (
        <div className="ai-settings-error">
          <XCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {successMessage && (
        <div className="ai-settings-success">
          <CheckCircle size={16} />
          <span>{successMessage}</span>
        </div>
      )}

      <div className="ai-settings-section">
        <div className="section-title">
          <Server size={18} />
          <span>Primary Model</span>
          <span className="required-badge">Required</span>
        </div>

        <div className="form-group">
          <label>Endpoint URL</label>
          <div className="input-with-select">
            <select
              value={COMMON_ENDPOINTS.find(e => e.value === primaryEndpointUrl)?.value || ''}
              onChange={(e) => setPrimaryEndpointUrl(e.target.value || primaryEndpointUrl)}
            >
              {COMMON_ENDPOINTS.map(ep => (
                <option key={ep.label} value={ep.value}>{ep.label}</option>
              ))}
            </select>
            <input
              type="text"
              value={primaryEndpointUrl}
              onChange={(e) => setPrimaryEndpointUrl(e.target.value)}
              placeholder="https://api.openai.com/v1"
            />
          </div>
          <span className="form-hint">OpenAI-compatible endpoint (e.g., OpenAI, Ollama, vLLM, LiteLLM)</span>
        </div>

        <div className="form-group">
          <label>API Key {!hasPrimaryApiKey && <span className="optional">(optional for local models)</span>}</label>
          <div className="input-with-toggle">
            <input
              type={showPrimaryKey ? 'text' : 'password'}
              value={primaryApiKey}
              onChange={(e) => setPrimaryApiKey(e.target.value)}
              placeholder={hasPrimaryApiKey ? '••••••••••••••••••••' : 'sk-...'}
            />
            <button
              type="button"
              className="toggle-visibility"
              onClick={() => setShowPrimaryKey(!showPrimaryKey)}
            >
              {showPrimaryKey ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {hasPrimaryApiKey && !primaryApiKey && (
            <span className="form-hint success">API key is configured. Enter a new key to replace it.</span>
          )}
        </div>

        <div className="form-group">
          <label>Model Name</label>
          <div className="input-with-suggestions">
            <input
              type="text"
              value={primaryModel}
              onChange={(e) => setPrimaryModel(e.target.value)}
              placeholder="gpt-4o"
              list="primary-models"
            />
            <datalist id="primary-models">
              {COMMON_MODELS.map(m => <option key={m} value={m} />)}
            </datalist>
          </div>
          <span className="form-hint">Model identifier (e.g., gpt-4o, claude-3-opus, llama3.1:70b)</span>
        </div>

        <div className="form-actions-row">
          <button
            className="btn-secondary"
            onClick={() => handleTestConnection('primary')}
            disabled={!primaryEndpointUrl || !primaryModel || isTesting === 'primary'}
          >
            {isTesting === 'primary' ? (
              <><Loader2 className="spin" size={16} /> Testing...</>
            ) : (
              <><TestTube size={16} /> Test Connection</>
            )}
          </button>

          {testResult?.type === 'primary' && (
            <div className={`test-result ${testResult.result.success ? 'success' : 'error'}`}>
              {testResult.result.success ? (
                <>
                  <CheckCircle size={16} />
                  <span>Connected to {testResult.result.modelInfo?.model} ({testResult.result.modelInfo?.responseTime}ms)</span>
                </>
              ) : (
                <>
                  <XCircle size={16} />
                  <span>{testResult.result.error || 'Connection failed'}</span>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="ai-settings-section">
        <div className="section-title">
          <Zap size={18} />
          <span>Fallback Model</span>
          <span className="optional-badge">Optional</span>
        </div>

        <label className="checkbox-label">
          <input
            type="checkbox"
            checked={enableFallback}
            onChange={(e) => setEnableFallback(e.target.checked)}
          />
          <span>Enable fallback model (used when primary fails)</span>
        </label>

        {enableFallback && (
          <>
            <div className="form-group">
              <label>Endpoint URL</label>
              <input
                type="text"
                value={fallbackEndpointUrl}
                onChange={(e) => setFallbackEndpointUrl(e.target.value)}
                placeholder="http://localhost:11434/v1"
              />
            </div>

            <div className="form-group">
              <label>API Key <span className="optional">(optional)</span></label>
              <div className="input-with-toggle">
                <input
                  type={showFallbackKey ? 'text' : 'password'}
                  value={fallbackApiKey}
                  onChange={(e) => setFallbackApiKey(e.target.value)}
                  placeholder={hasFallbackApiKey ? '••••••••••••••••••••' : 'Leave empty for local models'}
                />
                <button
                  type="button"
                  className="toggle-visibility"
                  onClick={() => setShowFallbackKey(!showFallbackKey)}
                >
                  {showFallbackKey ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label>Model Name</label>
              <input
                type="text"
                value={fallbackModel}
                onChange={(e) => setFallbackModel(e.target.value)}
                placeholder="llama3.1:70b"
                list="fallback-models"
              />
              <datalist id="fallback-models">
                {COMMON_MODELS.map(m => <option key={m} value={m} />)}
              </datalist>
            </div>

            <div className="form-actions-row">
              <button
                className="btn-secondary"
                onClick={() => handleTestConnection('fallback')}
                disabled={!fallbackEndpointUrl || !fallbackModel || isTesting === 'fallback'}
              >
                {isTesting === 'fallback' ? (
                  <><Loader2 className="spin" size={16} /> Testing...</>
                ) : (
                  <><TestTube size={16} /> Test Connection</>
                )}
              </button>

              {testResult?.type === 'fallback' && (
                <div className={`test-result ${testResult.result.success ? 'success' : 'error'}`}>
                  {testResult.result.success ? (
                    <>
                      <CheckCircle size={16} />
                      <span>Connected ({testResult.result.modelInfo?.responseTime}ms)</span>
                    </>
                  ) : (
                    <>
                      <XCircle size={16} />
                      <span>{testResult.result.error || 'Connection failed'}</span>
                    </>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="ai-settings-section">
        <div className="section-title">
          <Activity size={18} />
          <span>Usage Limits</span>
        </div>

        <div className="form-row">
          <div className="form-group half">
            <label>Max tokens per request</label>
            <input
              type="number"
              value={maxTokensPerRequest}
              onChange={(e) => setMaxTokensPerRequest(parseInt(e.target.value) || 4096)}
              min={100}
              max={128000}
            />
          </div>

          <div className="form-group half">
            <label>Temperature</label>
            <input
              type="number"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value) || 0.7)}
              min={0}
              max={2}
              step={0.1}
            />
          </div>
        </div>

        <div className="form-row">
          <div className="form-group half">
            <label>Requests per minute limit</label>
            <input
              type="number"
              value={requestsPerMinuteLimit}
              onChange={(e) => setRequestsPerMinuteLimit(parseInt(e.target.value) || 20)}
              min={1}
              max={1000}
            />
          </div>

          <div className="form-group half">
            <label>Tokens per day limit</label>
            <input
              type="number"
              value={tokensPerDayLimit}
              onChange={(e) => setTokensPerDayLimit(parseInt(e.target.value) || 100000)}
              min={1000}
              max={10000000}
            />
          </div>
        </div>
      </div>

      {usageStats && usageStats.totalRequests > 0 && (
        <div className="ai-settings-section">
          <div className="section-title">
            <Activity size={18} />
            <span>Usage (Last 30 Days)</span>
          </div>

          <div className="usage-stats-grid">
            <div className="usage-stat">
              <div className="usage-stat-value">{usageStats.totalRequests.toLocaleString()}</div>
              <div className="usage-stat-label">Total Requests</div>
            </div>
            <div className="usage-stat">
              <div className="usage-stat-value">{usageStats.totalTokens.toLocaleString()}</div>
              <div className="usage-stat-label">Total Tokens</div>
            </div>
            <div className="usage-stat">
              <div className="usage-stat-value">{usageStats.avgLatencyMs}ms</div>
              <div className="usage-stat-label">Avg Latency</div>
            </div>
            <div className="usage-stat">
              <div className="usage-stat-value">{(usageStats.errorRate * 100).toFixed(1)}%</div>
              <div className="usage-stat-label">Error Rate</div>
            </div>
          </div>
        </div>
      )}

      <div className="ai-settings-footer">
        <button
          className="btn-primary"
          onClick={handleSave}
          disabled={isSaving || !primaryEndpointUrl || !primaryModel}
        >
          {isSaving ? (
            <><Loader2 className="spin" size={16} /> Saving...</>
          ) : (
            <><Save size={16} /> Save Configuration</>
          )}
        </button>
      </div>
    </div>
  );
}

export default AISettings;

import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', background: '#fee', color: '#c00', minHeight: '100vh' }}>
          <h1>Something went wrong</h1>
          <p>Error: {this.state.error?.message}</p>
          <details style={{ whiteSpace: 'pre-wrap', marginTop: '20px' }}>
            <summary>Stack trace</summary>
            {this.state.error?.stack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}
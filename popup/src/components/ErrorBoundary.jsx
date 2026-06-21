import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * @file ErrorBoundary.jsx
 * @description React Error Boundary to catch and display errors gracefully
 * instead of showing a white screen when components crash.
 */
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error(' ErrorBoundary caught an error:', error, errorInfo);
    this.setState({
      error,
      errorInfo
    });
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/15">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>

            <h1 className="mb-2 text-center text-2xl font-bold text-foreground">
              Oops! Something went wrong
            </h1>

            <p className="mb-6 text-center text-muted-foreground">
              The application encountered an unexpected error. This has been logged for review.
            </p>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mb-4 rounded-lg border border-destructive/25 bg-destructive/10 p-3 text-sm">
                <p className="mb-1 font-semibold text-destructive">Error Details:</p>
                <p className="break-all font-mono text-xs text-destructive/90">
                  {this.state.error.toString()}
                </p>
              </div>
            )}

            <button
              onClick={this.handleReset}
              className="flex w-full items-center justify-center space-x-2 rounded-lg bg-accent py-3 px-4 font-semibold text-accent-foreground transition-colors duration-200 hover:bg-accent/90"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Reload Application</span>
            </button>

            <p className="mt-4 text-center text-xs text-muted-foreground">
              If this problem persists, try logging out and back in.
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

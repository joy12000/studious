import React from 'react';

type Props = { children: React.ReactNode };
type State = { hasError: boolean; error?: Error; resetKey: number; };

export default class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, resetKey: 0 };
  }
  static getDerivedStateFromError(error: Error) { return { hasError: true, error, resetKey: 0 }; }
  componentDidCatch(error: Error, info: React.ErrorInfo) { console.error('[ErrorBoundary]', error, info); }
  hardReload = () => {
    try { if (navigator.serviceWorker?.controller) { navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.update())); } } catch {}
    location.reload();
  };
  render() {
    if (!this.state.hasError) return React.cloneElement(this.props.children as React.ReactElement, { key: this.state.resetKey });
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-gray-50">
        <div className="max-w-md w-full bg-white rounded-xl shadow border border-gray-100 p-5 space-y-3">
          <h1 className="text-lg font-semibold">앗! 화면에 문제가 생겼어요.</h1>
          <p className="text-sm text-gray-600">새로고침하면 대부분 해결됩니다. 계속되면 캐시를 갱신해요.</p>
          <div className="flex gap-2">
            <button onClick={this.hardReload} className="px-3 py-2 text-sm rounded bg-blue-600 text-white">새로고침</button>
            <button onClick={()=>this.setState(prevState => ({ hasError: false, error: undefined, resetKey: prevState.resetKey + 1 }))} className="px-3 py-2 text-sm rounded bg-gray-100">무시하고 계속</button>
          </div>
          {this.state.error && <pre className="text-xs text-red-600 bg-red-50 rounded p-2 overflow-auto">{String(this.state.error)}</pre>}
        </div>
      </div>
    );
  }
}

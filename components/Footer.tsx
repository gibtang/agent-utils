// Server-rendered footer for SEO crawlability
export default function Footer() {
  return (
    <footer className="mt-auto pt-12 pb-8 border-t border-gray-800">
      <div className="max-w-7xl mx-auto px-4">
        <div className="grid md:grid-cols-3 gap-8 mb-8">
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Agent Utils</h3>
            <ul className="space-y-2">
              <li><a href="/" className="text-sm text-gray-400 hover:text-gray-200">Home</a></li>
              <li><a href="/tools" className="text-sm text-gray-400 hover:text-gray-200">Tools</a></li>
              <li><a href="/docs" className="text-sm text-gray-400 hover:text-gray-200">Documentation</a></li>
              <li><a href="/docs/v2" className="text-sm text-gray-400 hover:text-gray-200">v2 API (current)</a></li>
              <li><a href="/human-in-the-loop" className="text-sm text-gray-400 hover:text-gray-200">Human-in-the-Loop</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Reference</h3>
            <ul className="space-y-2">
              <li><a href="/llms-v2.txt" className="text-sm text-gray-400 hover:text-gray-200">llms-v2.txt</a></li>
              <li><a href="/openapi-v2.json" className="text-sm text-gray-400 hover:text-gray-200">OpenAPI spec</a></li>
              <li><a href="https://github.com/gibtang/agent-utils" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-400 hover:text-gray-200">GitHub</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Legal</h3>
            <ul className="space-y-2">
              <li><a href="/privacy" className="text-sm text-gray-400 hover:text-gray-200">Privacy Policy</a></li>
              <li><a href="/terms" className="text-sm text-gray-400 hover:text-gray-200">Terms of Service</a></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-gray-800 pt-6 text-center">
          <p className="text-gray-600 text-sm">
            Made by{" "}
            <a href="https://feedcode.dev" target="_blank" rel="noopener noreferrer" className="hover:text-gray-400">
              feedcode
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}

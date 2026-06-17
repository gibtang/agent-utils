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
              <li><a href="/dashboard" className="text-sm text-gray-400 hover:text-gray-200">Dashboard</a></li>
              <li><a href="/tools" className="text-sm text-gray-400 hover:text-gray-200">Tools</a></li>
              <li><a href="/docs" className="text-sm text-gray-400 hover:text-gray-200">Documentation</a></li>
              <li><a href="/docs/checkpoint" className="text-sm text-gray-400 hover:text-gray-200">Checkpoint</a></li>
              <li><a href="/docs/dlq" className="text-sm text-gray-400 hover:text-gray-200">DLQ</a></li>
              <li><a href="/human-in-the-loop" className="text-sm text-gray-400 hover:text-gray-200">Human-in-the-Loop</a></li>
            </ul>
          </div>
          <div>
            <h3 className="text-sm font-semibold text-white mb-4 uppercase tracking-wider">Account</h3>
            <ul className="space-y-2">
              <li><a href="/login" className="text-sm text-gray-400 hover:text-gray-200">Login</a></li>
              <li><a href="/signup" className="text-sm text-gray-400 hover:text-gray-200">Sign Up</a></li>
              <li><a href="/profile" className="text-sm text-gray-400 hover:text-gray-200">Profile</a></li>
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

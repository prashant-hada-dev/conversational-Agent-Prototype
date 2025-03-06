import { ChatProvider } from './contexts/ChatContext';
import ChatWindow from './components/ChatWindow';

function App() {
  return (
    <div className="min-h-screen bg-gray-100">
      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">
            AI Sales Assistant
          </h1>
          <p className="text-lg text-gray-600">
            Your intelligent sales companion powered by AI
          </p>
        </header>

        <main className="max-w-4xl mx-auto">
          <section className="bg-white rounded-lg shadow-lg p-8 mb-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              Welcome to Your AI Sales Assistant
            </h2>
            <p className="text-gray-600 mb-4">
              Our AI-powered sales assistant is here to help you with:
            </p>
            <ul className="list-disc list-inside text-gray-600 space-y-2">
              <li>Product information and recommendations</li>
              <li>Sales inquiries and support</li>
              <li>Pricing and availability</li>
              <li>Order processing assistance</li>
            </ul>
          </section>

          <section className="bg-white rounded-lg shadow-lg p-8">
            <h2 className="text-2xl font-semibold text-gray-900 mb-4">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="text-center">
                <div className="bg-primary-100 rounded-full p-4 inline-block mb-4">
                  <svg
                    className="w-8 h-8 text-primary-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Chat or Talk</h3>
                <p className="text-gray-600">
                  Interact with our AI using text or voice
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary-100 rounded-full p-4 inline-block mb-4">
                  <svg
                    className="w-8 h-8 text-primary-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Get Smart Responses
                </h3>
                <p className="text-gray-600">
                  Receive intelligent, context-aware assistance
                </p>
              </div>
              <div className="text-center">
                <div className="bg-primary-100 rounded-full p-4 inline-block mb-4">
                  <svg
                    className="w-8 h-8 text-primary-600"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">
                  Get Things Done
                </h3>
                <p className="text-gray-600">
                  Complete tasks and transactions efficiently
                </p>
              </div>
            </div>
          </section>
        </main>
      </div>

      {/* Chat Window */}
      <ChatProvider>
        <ChatWindow />
      </ChatProvider>
    </div>
  );
}

export default App;
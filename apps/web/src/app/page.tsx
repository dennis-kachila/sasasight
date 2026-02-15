'use client'

import Link from 'next/link'

export default function Home() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      {/* Header */}
      <header className="border-b border-gray-700 bg-gray-900 bg-opacity-50 backdrop-blur">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <h1 className="text-3xl font-bold text-cyan-400">SasaSight</h1>
          <p className="text-gray-400 mt-1">Find • Scan • Study</p>
        </div>
      </header>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-16">
        {/* Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {/* Find Mode */}
          <Link href="/mode/find">
            <div className="card hover:border-cyan-500 cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-500/20 group">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🎯</div>
              <h2 className="text-2xl font-bold mb-2 text-cyan-400">Find Mode</h2>
              <p className="text-gray-400 text-sm mb-4">
                Quickly locate components by reference designator or part number. Real-time OCR highlighting with stabilized targeting.
              </p>
              <div className="flex items-center text-cyan-400 text-sm font-medium">
                Start Searching <span className="ml-2">→</span>
              </div>
            </div>
          </Link>

          {/* Scan Mode */}
          <Link href="/mode/scan">
            <div className="card hover:border-cyan-500 cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-500/20 group">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">📸</div>
              <h2 className="text-2xl font-bold mb-2 text-cyan-400">Scan Mode</h2>
              <p className="text-gray-400 text-sm mb-4">
                Create a high-resolution digital map of your motherboard. Automatic stitching, board ID detection, and coverage tracking.
              </p>
              <div className="flex items-center text-cyan-400 text-sm font-medium">
                Start Scanning <span className="ml-2">→</span>
              </div>
            </div>
          </Link>

          {/* Study Mode */}
          <Link href="/mode/study">
            <div className="card hover:border-cyan-500 cursor-pointer transition-all hover:shadow-lg hover:shadow-cyan-500/20 group">
              <div className="text-4xl mb-4 group-hover:scale-110 transition-transform">🖊️</div>
              <h2 className="text-2xl font-bold mb-2 text-cyan-400">Study Mode</h2>
              <p className="text-gray-400 text-sm mb-4">
                Annotate and analyze board scans. Mark rails, faults, and measurements. Save and export for repair documentation.
              </p>
              <div className="flex items-center text-cyan-400 text-sm font-medium">
                View Boards <span className="ml-2">→</span>
              </div>
            </div>
          </Link>
        </div>

        {/* Features Section */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-8">Key Features</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="card border-gray-700">
              <h3 className="font-semibold text-cyan-400 mb-2">Component Detection</h3>
              <p className="text-sm text-gray-400">Automatically detect and highlight components in real-time using AI vision.</p>
            </div>
            <div className="card border-gray-700">
              <h3 className="font-semibold text-cyan-400 mb-2">Board ID Recognition</h3>
              <p className="text-sm text-gray-400">OCR-based identification of board numbers, revisions, and manufacturers.</p>
            </div>
            <div className="card border-gray-700">
              <h3 className="font-semibold text-cyan-400 mb-2">Panoramic Stitching</h3>
              <p className="text-sm text-gray-400">Seamlessly stitch multiple frames into a high-resolution board image.</p>
            </div>
            <div className="card border-gray-700">
              <h3 className="font-semibold text-cyan-400 mb-2">Annotation Tools</h3>
              <p className="text-sm text-gray-400">Draw, label, and mark rails, faults, and measurement points with layers.</p>
            </div>
            <div className="card border-gray-700">
              <h3 className="font-semibold text-cyan-400 mb-2">Rail Tracing</h3>
              <p className="text-sm text-gray-400">Manually trace power rails (5V, 3.3V, VBAT) with AI suggestion support.</p>
            </div>
            <div className="card border-gray-700">
              <h3 className="font-semibold text-cyan-400 mb-2">Save & Share</h3>
              <p className="text-sm text-gray-400">Store board scans with annotations and export for repair documentation.</p>
            </div>
          </div>
        </section>
      </div>

      {/* Footer */}
      <footer className="border-t border-gray-700 bg-gray-900 bg-opacity-50 mt-16">
        <div className="max-w-7xl mx-auto px-6 py-8 text-center text-gray-400 text-sm">
          <p>SasaSight v0.1.0 — Motherboard Repair Assistant</p>
          <p className="mt-2">Built for Sasaflex technicians</p>
        </div>
      </footer>
    </main>
  )
}

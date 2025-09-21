import React, { ReactNode, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

interface SharedLayoutProps {
  children: ReactNode;
}

export const SharedLayout = ({ children }: SharedLayoutProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  return (
    <div className="min-h-screen">
      {/* Same gradient background as landing page */}
      <div className="relative min-h-screen">
        {/* Multi-layer gradient background to match landing page */}
        <div className="absolute inset-0 bg-gradient-to-br from-[#FCE4EC] from-0% via-[#a78bfa] via-45% to-[#1e1b4b] to-100%" />
        <div className="absolute inset-0 bg-gradient-to-r from-transparent from-10% via-purple-500/40 via-50% to-indigo-950/90 to-80%" />
        <div className="absolute inset-0 bg-gradient-to-l from-black/50 via-transparent to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />
        
        {/* Header Navigation - Same as landing page */}
        <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 py-2 sm:py-3 md:py-4 lg:py-6 bg-white/20 backdrop-blur-lg border-b border-white/10">
          <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div className="flex items-center gap-4 sm:gap-8">
              <div className="flex items-center gap-2 cursor-pointer" onClick={() => navigate('/')}>
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-gradient-to-r from-purple-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white text-lg sm:text-xl">🎓</span>
                </div>
                <span 
                  className="font-bold text-lg sm:text-xl bg-gradient-to-r from-gray-900 via-purple-800 to-gray-900 bg-clip-text text-transparent"
                  style={{
                    backgroundSize: '200% auto',
                    animation: 'text-shine 3s ease-in-out infinite'
                  }}
                >
                  TeacherRank
                </span>
              </div>
              
              <div className="hidden md:flex items-center gap-6 lg:gap-10">
                <button 
                  onClick={() => navigate('/how-it-works')} 
                  className={`transition-colors font-semibold ${location.pathname === '/how-it-works' ? 'text-white bg-purple-600/40 px-3 py-1 rounded-lg' : 'text-gray-100 hover:text-white'}`}
                >
                  How It Works
                </button>
                <button 
                  onClick={() => navigate('/about')} 
                  className={`transition-colors font-semibold ${location.pathname === '/about' ? 'text-white bg-purple-600/40 px-3 py-1 rounded-lg' : 'text-gray-100 hover:text-white'}`}
                >
                  About
                </button>
                <button 
                  onClick={() => navigate('/terms')} 
                  className={`transition-colors font-semibold ${location.pathname === '/terms' ? 'text-white bg-purple-600/40 px-3 py-1 rounded-lg' : 'text-gray-100 hover:text-white'}`}
                >
                  Terms
                </button>
                <button 
                  onClick={() => navigate('/privacy')} 
                  className={`transition-colors font-semibold ${location.pathname === '/privacy' ? 'text-white bg-purple-600/40 px-3 py-1 rounded-lg' : 'text-gray-100 hover:text-white'}`}
                >
                  Privacy
                </button>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              <button 
                onClick={() => navigate('/'))
                className="px-4 sm:px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm sm:text-base rounded-full hover:from-purple-700 hover:to-purple-800 transition-all touch-friendly font-semibold"
                style={{
                  boxShadow: "0 0 20px rgba(168, 85, 247, 0.4), 0 0 30px rgba(168, 85, 247, 0.2)",
                }}
              >
                Enter App
              </button>

              {/* Mobile Menu Button */}
              <button
                onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                className="md:hidden p-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transition-all touch-friendly"
                aria-label="Toggle menu"
              >
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  {isMobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>

          {/* Mobile Menu Dropdown */}
          {isMobileMenuOpen && (
            <div className="md:hidden mt-2 mx-4">
              <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-4">
                <div className="flex flex-col gap-2">
                  <button 
                    onClick={() => {
                      navigate('/how-it-works');
                      setIsMobileMenuOpen(false);
                    }} 
                    className={`text-left px-4 py-3 rounded-lg transition-colors font-semibold ${location.pathname === '/how-it-works' ? 'bg-purple-600/40 text-white' : 'text-gray-100 hover:bg-purple-900/30 hover:text-white'}`}
                  >
                    How It Works
                  </button>
                  <button 
                    onClick={() => {
                      navigate('/about');
                      setIsMobileMenuOpen(false);
                    }} 
                    className={`text-left px-4 py-3 rounded-lg transition-colors font-semibold ${location.pathname === '/about' ? 'bg-purple-600/40 text-white' : 'text-gray-100 hover:bg-purple-900/30 hover:text-white'}`}
                  >
                    About
                  </button>
                  <button 
                    onClick={() => {
                      navigate('/terms');
                      setIsMobileMenuOpen(false);
                    }} 
                    className={`text-left px-4 py-3 rounded-lg transition-colors font-semibold ${location.pathname === '/terms' ? 'bg-purple-600/40 text-white' : 'text-gray-100 hover:bg-purple-900/30 hover:text-white'}`}
                  >
                    Terms
                  </button>
                  <button 
                    onClick={() => {
                      navigate('/privacy');
                      setIsMobileMenuOpen(false);
                    }} 
                    className={`text-left px-4 py-3 rounded-lg transition-colors font-semibold ${location.pathname === '/privacy' ? 'bg-purple-600/40 text-white' : 'text-gray-100 hover:bg-purple-900/30 hover:text-white'}`}
                  >
                    Privacy
                  </button>
                  
                  <div className="mt-2 pt-4 border-t border-purple-500/20">
                    <button 
                      onClick={() => {
                        navigate('/app');
                        setIsMobileMenuOpen(false);
                      }}
                      className="w-full px-6 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-all font-semibold"
                      style={{
                        boxShadow: "0 0 15px rgba(168, 85, 247, 0.3), 0 0 25px rgba(168, 85, 247, 0.15)",
                      }}
                    >
                      Enter App
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </nav>

        {/* Main Content */}
        <main className="relative z-20 pt-20">
          {children}
        </main>
      </div>
    </div>
  );
};
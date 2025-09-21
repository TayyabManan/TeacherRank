import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Helmet } from "react-helmet-async";
import { useStats } from "../hooks/useStats";
import { useTeachersOptimized } from "../hooks/useTeachersOptimized";
import { AvatarImage } from "../components/AvatarImage";
import "../styles/landing.css";
import "../styles/mobile.css";

const LandingPage = () => {
  const navigate = useNavigate();
  const { data: stats } = useStats();
  const { data: teachers } = useTeachersOptimized();
  const [isVisible, setIsVisible] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  // Close mobile menu when navigating
  const handleNavigation = (path: string) => {
    navigate(path);
    setMobileMenuOpen(false);
  };

  // Get 9 teachers for orbital animation (3 per ring)
  const orbitingTeachers = teachers?.data
    ?.slice(0, 9)
    .map((teacher, index) => ({
      ...teacher,
      ring: Math.floor(index / 3) + 1, // Distribute 3 teachers per ring
    })) || [
    { id: 1, name: "Dr. Smith", avatar_url: null, ring: 1 },
    { id: 2, name: "Prof. Johnson", avatar_url: null, ring: 1 },
    { id: 3, name: "Dr. Williams", avatar_url: null, ring: 1 },
    { id: 4, name: "Prof. Brown", avatar_url: null, ring: 2 },
    { id: 5, name: "Dr. Davis", avatar_url: null, ring: 2 },
    { id: 6, name: "Prof. Miller", avatar_url: null, ring: 2 },
    { id: 7, name: "Dr. Wilson", avatar_url: null, ring: 3 },
    { id: 8, name: "Prof. Moore", avatar_url: null, ring: 3 },
    { id: 9, name: "Dr. Taylor", avatar_url: null, ring: 3 },
  ];


  return (
    <>
      <Helmet>
        <title>Teacher Rank - Rate and Review Your Teachers</title>
        <meta
          name="description"
          content="Discover and rate the best educators at your institution. Join thousands of students making informed decisions."
        />
      </Helmet>

      <div className="min-h-screen">
        {/* Main Hero Section with Purple Gradient */}
        <section className="relative min-h-[100dvh] flex flex-col">
          {/* Multi-layer gradient background to match the design */}
          {/* Base gradient - peachy cream to deep purple-blue */}
          <div className="absolute inset-0 bg-gradient-to-br from-[#FCE4EC] from-0% via-[#a78bfa] via-45% to-[#1e1b4b] to-100%" />
          {/* Purple accent layer */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent from-10% via-purple-500/40 via-50% to-indigo-950/90 to-80%" />
          {/* Dark overlay for depth on the right */}
          <div className="absolute inset-0 bg-gradient-to-l from-black/50 via-transparent to-transparent" />
          {/* Bottom shadow */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/30 via-transparent to-transparent" />

          {/* Header Navigation */}
          <nav className="fixed top-0 left-0 right-0 z-50 px-4 sm:px-6 lg:px-8 py-2 sm:py-3 md:py-4 lg:py-6 bg-white/20 backdrop-blur-lg border-b border-white/10">
            <div className="max-w-7xl mx-auto flex justify-between items-center">
              <div className="flex items-center gap-4 sm:gap-8">
                <div className="flex items-center gap-2">
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
                    onClick={() => navigate("/how-it-works")}
                    className="text-gray-100 hover:text-white transition-colors font-semibold"
                  >
                    How It Works
                  </button>
                  <button
                    onClick={() => navigate("/about")}
                    className="text-gray-100 hover:text-white transition-colors font-semibold"
                  >
                    About
                  </button>
                  <button
                    onClick={() => navigate("/terms")}
                    className="text-gray-100 hover:text-white transition-colors font-semibold"
                  >
                    Terms
                  </button>
                  <button
                    onClick={() => navigate("/privacy")}
                    className="text-gray-100 hover:text-white transition-colors font-semibold"
                  >
                    Privacy
                  </button>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => navigate("/app")}
                  className="px-4 sm:px-6 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm sm:text-base rounded-full hover:from-purple-700 hover:to-purple-800 transition-all touch-friendly font-semibold"
                  style={{
                    boxShadow: "0 0 20px rgba(168, 85, 247, 0.4), 0 0 30px rgba(168, 85, 247, 0.2)",
                  }}
                >
                  Enter App
                </button>
                
                {/* Mobile Menu Button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="md:hidden p-2 rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 transition-all touch-friendly"
                  aria-label="Toggle menu"
                >
                  <svg
                    className="w-6 h-6 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    {mobileMenuOpen ? (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    ) : (
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M4 6h16M4 12h16M4 18h16"
                      />
                    )}
                  </svg>
                </button>
              </div>
            </div>

            {/* Mobile Menu Dropdown */}
            {mobileMenuOpen && (
              <div className="md:hidden mt-2 mx-4">
                <div className="bg-black/60 backdrop-blur-xl rounded-2xl border border-purple-500/30 p-4">
                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => handleNavigation("/how-it-works")}
                      className="text-left px-4 py-3 text-white hover:bg-purple-900/30 rounded-lg transition-colors font-semibold"
                    >
                      How It Works
                    </button>
                    <button
                      onClick={() => handleNavigation("/about")}
                      className="text-left px-4 py-3 text-white hover:bg-purple-900/30 rounded-lg transition-colors font-semibold"
                    >
                      About
                    </button>
                    <button
                      onClick={() => handleNavigation("/terms")}
                      className="text-left px-4 py-3 text-white hover:bg-purple-900/30 rounded-lg transition-colors font-semibold"
                    >
                      Terms
                    </button>
                    <button
                      onClick={() => handleNavigation("/privacy")}
                      className="text-left px-4 py-3 text-white hover:bg-purple-900/30 rounded-lg transition-colors font-semibold"
                    >
                      Privacy
                    </button>
                    
                    <div className="mt-2 pt-4 border-t border-purple-500/20">
                      <button
                        onClick={() => handleNavigation("/app")}
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

          {/* Hero Content */}
          <div className="relative z-20 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 min-h-[calc(100vh-80px)] pt-20">
            <div className="max-w-7xl mx-auto w-full h-full flex items-center">
              <div className="flex flex-col lg:flex-row items-center justify-between gap-2 sm:gap-4 md:gap-6 lg:gap-10 hero-flex w-full">
              {/* Left Content */}
              <div
                className={`lg:w-1/2 text-center lg:text-left transition-all duration-1000 ${
                  isVisible
                    ? "opacity-100 translate-y-0"
                    : "opacity-0 translate-y-10"
                }`}
              >
                <h1
                  className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-semibold leading-tight mb-2 sm:mb-3 md:mb-4 hero-title-dynamic"
                  style={{
                    color: "#1a1a2e",
                    letterSpacing: "-0.02em",
                  }}
                >
                  <span className="block sm:inline">Find Your Best</span>
                  <br className="hidden sm:block" />
                  <span className="block sm:inline">Teachers, Rate &</span>
                  <br className="hidden sm:block" />
                  <span className="block sm:inline">Review to Help</span>
                  <br className="hidden sm:block" />
                  <span className="block sm:inline">Fellow Students –</span>
                  <br className="hidden sm:block" />
                  <span style={{ color: "white" }} className="block mt-2 sm:mt-0">
                    <span className="block sm:inline">Make Informed</span>
                    <br className="hidden sm:block" />
                    <span className="block sm:inline">Decisions Today!</span>
                  </span>
                </h1>

                <button
                  onClick={() => navigate("/app")}
                  className="px-5 sm:px-6 md:px-8 py-2.5 sm:py-3 md:py-3.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm sm:text-base md:text-lg rounded-full font-semibold hover:from-purple-700 hover:to-purple-800 transform hover:scale-105 transition-all duration-200 inline-flex items-center gap-3 touch-friendly"
                  style={{
                    boxShadow: "0 0 25px rgba(168, 85, 247, 0.5), 0 0 45px rgba(168, 85, 247, 0.3)",
                  }}
                >
                  Start Exploring
                  <svg
                    className="w-4 h-4 sm:w-5 sm:h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                </button>
              </div>

              {/* Right Content - Orbital Animation */}
              <div className="lg:w-1/2 flex items-center justify-center lg:mt-0">
                <div className="relative orbital-animation-container" style={{
                  width: 'clamp(260px, 40vw, min(400px, 50vh))',
                  height: 'clamp(260px, 40vw, min(400px, 50vh))'
                }}>
                  {/* Central Stats */}
                  <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-20">
                    <div className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl xl:text-6xl font-bold text-white mb-1 text-center">
                      {stats?.totalTeachers || 41}+
                      <div className="text-white/80 text-[10px] sm:text-xs md:text-sm">Teachers</div>
                    </div>
                  </div>

                  {/* Orbital Rings */}
                  <svg
                    className="absolute inset-0 w-full h-full"
                    viewBox="0 0 500 500"
                  >
                    <circle
                      cx="250"
                      cy="250"
                      r="100"
                      fill="none"
                      stroke="rgba(255,255,255,0.1)"
                      strokeWidth="1"
                    />
                    <circle
                      cx="250"
                      cy="250"
                      r="160"
                      fill="none"
                      stroke="rgba(255,255,255,0.08)"
                      strokeWidth="1"
                    />
                    <circle
                      cx="250"
                      cy="250"
                      r="230"
                      fill="none"
                      stroke="rgba(255,255,255,0.06)"
                      strokeWidth="1"
                    />
                  </svg>

                  {/* Orbiting Teachers - Ring 1 (Inner) */}
                  <div className="absolute inset-0 animate-spin-slow">
                    {orbitingTeachers
                      .filter((teacher) => teacher.ring === 1)
                      .map((teacher, index, arr) => {
                        const angle = (index * 360) / arr.length;
                        const radian = (angle * Math.PI) / 180;
                        const radius = 20; // 20% of container
                        const x = 50 + radius * Math.cos(radian);
                        const y = 50 + radius * Math.sin(radian);

                        return (
                          <div
                            key={teacher.id}
                            className="absolute w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12"
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            <div
                              className="w-full h-full rounded-full border border-purple-400/50 shadow-xl animate-spin-slow direction-reverse bg-gradient-to-br from-purple-400 to-pink-400"
                              style={{
                                boxShadow:
                                  "0 0 20px rgba(168, 85, 247, 0.5), 0 0 40px rgba(168, 85, 247, 0.3)",
                                backgroundImage: `url(${teacher.avatar_url && teacher.avatar_url !== 'null' 
                                  ? (window.location.hostname !== 'localhost' && teacher.avatar_url.includes('.edu.pk') 
                                      ? `/api/image-proxy?url=${encodeURIComponent(teacher.avatar_url)}` 
                                      : teacher.avatar_url)
                                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name || 'T')}&background=a855f7&color=fff&size=128&bold=true`})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                              }}
                            />
                          </div>
                        );
                      })}
                  </div>

                  {/* Orbiting Teachers - Ring 2 (Middle) */}
                  <div className="absolute inset-0 animate-spin-slower">
                    {orbitingTeachers
                      .filter((teacher) => teacher.ring === 2)
                      .map((teacher, index, arr) => {
                        const angle = (index * 360) / arr.length;
                        const radian = (angle * Math.PI) / 180;
                        const radius = 32; // 32% of container
                        const x = 50 + radius * Math.cos(radian);
                        const y = 50 + radius * Math.sin(radian);

                        return (
                          <div
                            key={teacher.id}
                            className="absolute w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12"
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            <div
                              className="w-full h-full rounded-full border border-blue-400/50 shadow-xl animate-spin-slower direction-reverse bg-gradient-to-br from-blue-400 to-cyan-400"
                              style={{
                                boxShadow:
                                  "0 0 20px rgba(59, 130, 246, 0.5), 0 0 40px rgba(59, 130, 246, 0.3)",
                                backgroundImage: `url(${teacher.avatar_url && teacher.avatar_url !== 'null' 
                                  ? (window.location.hostname !== 'localhost' && teacher.avatar_url.includes('.edu.pk') 
                                      ? `/api/image-proxy?url=${encodeURIComponent(teacher.avatar_url)}` 
                                      : teacher.avatar_url)
                                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name || 'T')}&background=3b82f6&color=fff&size=128&bold=true`})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                              }}
                            />
                          </div>
                        );
                      })}
                  </div>

                  {/* Orbiting Teachers - Ring 3 (Outer) */}
                  <div className="absolute inset-0 animate-spin-slowest direction-reverse">
                    {orbitingTeachers
                      .filter((teacher) => teacher.ring === 3)
                      .map((teacher, index, arr) => {
                        const angle = (index * 360) / arr.length;
                        const radian = (angle * Math.PI) / 180;
                        const radius = 46; // 46% of container
                        const x = 50 + radius * Math.cos(radian);
                        const y = 50 + radius * Math.sin(radian);

                        return (
                          <div
                            key={teacher.id}
                            className="absolute w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 lg:w-16 lg:h-16"
                            style={{
                              left: `${x}%`,
                              top: `${y}%`,
                              transform: 'translate(-50%, -50%)',
                            }}
                          >
                            <div
                              className="w-full h-full rounded-full shadow-xl animate-spin-slowest bg-gradient-to-br from-green-400 to-teal-400"
                              style={{
                                boxShadow:
                                  "0 0 20px rgba(52, 211, 153, 0.5), 0 0 40px rgba(52, 211, 153, 0.3)",
                                backgroundImage: `url(${teacher.avatar_url && teacher.avatar_url !== 'null' 
                                  ? (window.location.hostname !== 'localhost' && teacher.avatar_url.includes('.edu.pk') 
                                      ? `/api/image-proxy?url=${encodeURIComponent(teacher.avatar_url)}` 
                                      : teacher.avatar_url)
                                  : `https://ui-avatars.com/api/?name=${encodeURIComponent(teacher.name || 'T')}&background=34d399&color=fff&size=128&bold=true`})`,
                                backgroundSize: 'cover',
                                backgroundPosition: 'center'
                              }}
                            />
                          </div>
                        );
                      })}
                  </div>

                  {/* Floating UI Elements */}
                </div>
              </div>
            </div>
          </div>
        </div>
        </section>
        
      </div>
    </>
  );
};

export default LandingPage;

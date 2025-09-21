import React, { useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

const HowItWorks = () => {
  const navigate = useNavigate();
  const [activeStep, setActiveStep] = useState(0);

  const steps = [
    {
      number: '01',
      title: 'Sign Up or Browse',
      description: 'Create a free account or browse anonymously',
      icon: '👤',
      detail: 'No credit card required. Browse freely or sign up to contribute.'
    },
    {
      number: '02',
      title: 'Find Teachers',
      description: 'Search by name, institution, or department',
      icon: '🔍',
      detail: 'Our smart search helps you find exactly who you\'re looking for.'
    },
    {
      number: '03',
      title: 'Read Reviews',
      description: 'Get insights from real student experiences',
      icon: '📖',
      detail: 'Detailed ratings on teaching quality, difficulty, and workload.'
    },
    {
      number: '04',
      title: 'Share Feedback',
      description: 'Help future students with your reviews',
      icon: '⭐',
      detail: 'Your voice matters. Share constructive feedback to help others.'
    }
  ];

  const features = [
    { icon: '🔒', title: 'Anonymous', description: 'Protected identity' },
    { icon: '✅', title: 'Verified', description: 'Real reviews only' },
    { icon: '📊', title: 'Detailed', description: 'Multiple metrics' },
    { icon: '🏫', title: 'Organized', description: 'By institution' },
    { icon: '📱', title: 'Responsive', description: 'Any device' }
  ];

  return (
    <>
      <Helmet>
        <title>How It Works - Teacher Rank</title>
        <meta name="description" content="Learn how to use Teacher Rank to find the best teachers, read reviews, and share your educational experiences." />
      </Helmet>

      <div className="max-w-7xl mx-auto px-8 py-20">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="bg-black/40 backdrop-blur-md rounded-3xl p-8 border border-purple-500/20">
            <h1 className="text-5xl lg:text-6xl font-semibold mb-6 text-white">
              Simple, Transparent,<br/>
              Powerful
            </h1>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto font-medium">
              Finding the right teacher shouldn't be a gamble. Here's how we make it easy.
            </p>
          </div>
        </div>

        {/* Interactive Steps */}
        <div className="mb-20">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            {/* Steps Navigation */}
            <div className="space-y-4">
              {steps.map((step, index) => (
                <div
                  key={index}
                  onClick={() => setActiveStep(index)}
                  className={`cursor-pointer transition-all duration-300 ${
                    activeStep === index ? 'scale-105' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  <div className={`flex items-center gap-4 p-6 rounded-2xl backdrop-blur-md border ${
                    activeStep === index 
                      ? 'bg-purple-900/40 border-purple-500/40 shadow-xl' 
                      : 'bg-purple-900/20 border-purple-500/20'
                  }`}>
                    <div className={`text-4xl ${activeStep === index ? 'animate-bounce' : ''}`}>
                      {step.icon}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="text-sm font-bold text-purple-400">{step.number}</span>
                        <h3 className="text-xl font-semibold text-white">{step.title}</h3>
                      </div>
                      <p className="text-gray-300">{step.description}</p>
                    </div>
                    {activeStep === index && (
                      <div className="text-purple-400">
                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M9 5l7 7-7 7" />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Active Step Detail */}
            <div className="flex items-center justify-center">
              <div className="bg-black/40 backdrop-blur-md rounded-3xl p-12 border border-purple-500/20">
                <div className="text-6xl mb-6 animate-pulse">{steps[activeStep].icon}</div>
                <h3 className="text-2xl font-semibold text-white mb-4">
                  {steps[activeStep].title}
                </h3>
                <p className="text-lg text-gray-300 leading-relaxed">
                  {steps[activeStep].detail}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Features Grid */}
        <div className="mb-20">
          <div className="bg-black/40 backdrop-blur-md rounded-3xl p-8 border border-purple-500/20 mb-8">
            <h2 className="text-4xl font-semibold text-center mb-6 text-white">
              Why Choose Teacher Rank?
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {features.map((feature, index) => (
              <div key={index} className="text-center group">
                <div className="bg-purple-900/30 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30 hover:bg-purple-900/40 transition-all duration-300 hover:transform hover:-translate-y-2">
                  <div className="text-4xl mb-3">{feature.icon}</div>
                  <h3 className="font-semibold text-white mb-1">{feature.title}</h3>
                  <p className="text-xs text-gray-300">{feature.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <div className="inline-block bg-black/40 backdrop-blur-md rounded-3xl p-12 border border-purple-500/20">
            <h2 className="text-4xl font-semibold text-white mb-4">
              Ready to Start?
            </h2>
            <p className="text-xl text-gray-300 mb-8 max-w-2xl">
              Join thousands of students making smarter choices about their education.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => navigate('/'))
                className="px-8 py-4 bg-purple-600 text-white rounded-full font-semibold hover:bg-purple-700 transform hover:scale-105 transition-all duration-200 border border-purple-500/50"
                style={{
                  boxShadow: "0 0 20px rgba(168, 85, 247, 0.4), 0 0 40px rgba(168, 85, 247, 0.2)"
                }}
              >
                Browse Teachers Now
              </button>
              <button 
                onClick={() => navigate('/auth'))
                className="px-8 py-4 bg-purple-900/30 backdrop-blur-sm text-white rounded-full font-semibold hover:bg-purple-900/40 transition-all duration-200 border border-purple-500/30"
              >
                Create Free Account
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default HowItWorks;
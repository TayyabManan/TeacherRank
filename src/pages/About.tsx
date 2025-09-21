import React from 'react';
import { Helmet } from 'react-helmet-async';
import { useNavigate } from 'react-router-dom';

const About = () => {
  const navigate = useNavigate();

  const values = [
    {
      icon: '🎯',
      title: 'Transparency',
      description: 'Honest feedback for better decisions'
    },
    {
      icon: '🤝',
      title: 'Community',
      description: 'Students helping students succeed'
    },
    {
      icon: '⚖️',
      title: 'Fairness',
      description: 'Every voice matters equally'
    },
    {
      icon: '🚀',
      title: 'Innovation',
      description: 'Continuously improving education'
    }
  ];

  const stats = [
    { number: '50K+', label: 'Students' },
    { number: '10K+', label: 'Teachers' },
    { number: '100K+', label: 'Reviews' },
    { number: '4.8', label: 'Rating' }
  ];

  return (
    <>
      <Helmet>
        <title>About Us - Teacher Rank</title>
        <meta name="description" content="Learn about Teacher Rank's mission to help students make informed decisions through transparent teacher reviews and ratings." />
      </Helmet>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-16 lg:py-20">
        {/* Hero Section */}
        <div className="text-center mb-20">
          <div className="bg-black/40 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-purple-500/20">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-semibold mb-6 text-white break-words">
              Empowering Students<br/>
              Through Transparency
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-gray-300 max-w-3xl mx-auto font-medium px-2 sm:px-0">
              We believe every student deserves to know what they're signing up for. 
              Teacher Rank creates transparency in education through community-driven reviews.
            </p>
          </div>
        </div>

        {/* Stats Section */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-20">
          {stats.map((stat, index) => (
            <div key={index} className="text-center">
              <div className="inline-block bg-black/10 backdrop-blur-md rounded-2xl p-6 hover:bg-black/20 transition-colors">
                <div className="text-4xl font-bold text-white mb-2">{stat.number}</div>
                <div className="text-white/80 text-sm uppercase tracking-wider">{stat.label}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Mission Section */}
        <div className="grid lg:grid-cols-2 gap-12 items-center mb-20">
          <div className="bg-black/40 backdrop-blur-md rounded-3xl p-8 border border-purple-500/20">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold mb-6 text-white">
              Our Mission
            </h2>
            <p className="text-lg text-gray-300 mb-4 leading-relaxed">
              Teacher Rank was born from a simple observation: choosing the right teacher can make 
              or break your academic experience. Yet, students often go in blind.
            </p>
            <p className="text-lg text-gray-300 mb-6 leading-relaxed">
              We're changing that. Our platform gives students a voice and helps future students 
              make informed decisions. Because education is too important to leave to chance.
            </p>
           
          </div>
          <div className="flex items-center justify-center">
            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full blur-3xl opacity-30 animate-pulse"></div>
              <div className="relative text-[80px] sm:text-[100px] md:text-[120px] lg:text-[150px] filter drop-shadow-2xl">🎓</div>
            </div>
          </div>
        </div>

        {/* Values Section */}
        <div className="mb-20">
          <div className="bg-black/40 backdrop-blur-md rounded-3xl p-8 border border-purple-500/20 mb-8">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-semibold text-center mb-6 text-white">
              What We Stand For
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {values.map((value, index) => (
              <div key={index} className="group cursor-pointer">
                <div className="bg-purple-900/30 backdrop-blur-md rounded-2xl p-6 border border-purple-500/30 hover:bg-purple-900/40 transition-all duration-300 hover:transform hover:-translate-y-2">
                  <div className="text-5xl mb-4">{value.icon}</div>
                  <h3 className="text-xl font-semibold text-white mb-2">
                    {value.title}
                  </h3>
                  <p className="text-gray-300">
                    {value.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Team Section */}
        <div className="text-center">
          <div className="inline-block bg-black/40 backdrop-blur-md rounded-3xl p-12 border border-purple-500/20">
            <h2 className="text-3xl font-semibold text-white mb-4">
              Built By Students, For Students
            </h2>
            <p className="text-gray-300 max-w-2xl mx-auto mb-8 text-lg">
              We've been in your shoes. We know the struggle of choosing classes blindly. 
              That's why we built Teacher Rank – to give every student the information they deserve.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button 
                onClick={() => navigate('/how-it-works')}
                className="px-6 py-3 bg-purple-900/30 backdrop-blur-sm text-white rounded-full hover:bg-purple-900/40 transition-colors font-semibold border border-purple-500/30"
              >
                Learn More
              </button>
              <button 
                onClick={() => navigate('/'))
                className="px-6 py-3 bg-purple-600 text-white rounded-full hover:bg-purple-700 transition-colors font-semibold border border-purple-500/50"
                style={{
                  boxShadow: "0 0 15px rgba(168, 85, 247, 0.3), 0 0 25px rgba(168, 85, 247, 0.15)"
                }}
              >
                Start Rating
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default About;
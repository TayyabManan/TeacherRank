import React from 'react'
import { Link } from 'react-router-dom'

export function Footer() {
  const currentYear = new Date().getFullYear()

  const quickLinks = [
    { label: 'Home', path: '/' },
    { label: 'Dashboard', path: '/dashboard' },
    { label: 'FAQ', path: '/faq' },
    { label: 'Feedback', path: '/feedback' }
  ]

  const socialLinks = [
    {
      name: 'Portfolio',
      href: 'https://tayyabmanan.com/',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M7 2v11h3v9l7-12h-4l4-8z"/>
        </svg>
      )
    },
    {
      name: 'LinkedIn',
      href: 'https://www.linkedin.com/in/muhammad-tayyab-3962a2373/',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      )
    },
    {
      name: 'Upwork',
      href: 'https://www.upwork.com/users/~0155edcc7d42fc5b51',
      icon: (
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
          <path d="M18.561 13.158c-1.102 0-2.135-.467-3.074-1.227l.228-1.076.008-.042c.207-1.143.849-3.06 2.839-3.06 1.492 0 2.703 1.212 2.703 2.703-.001 1.489-1.212 2.702-2.704 2.702zm0-8.14c-2.539 0-4.51 1.649-5.31 4.366-1.22-1.834-2.148-4.036-2.687-5.892H7.828v7.112c-.002 1.406-1.141 2.546-2.547 2.548-1.405-.002-2.543-1.143-2.545-2.548V3.492H0v7.112c0 2.914 2.37 5.303 5.281 5.303 2.913 0 5.283-2.389 5.283-5.303v-1.19c.529 1.107 1.182 2.229 1.974 3.221l-1.673 7.873h2.797l1.213-5.71c1.063.679 2.285 1.109 3.686 1.109 3 0 5.439-2.452 5.439-5.45 0-3-2.439-5.439-5.439-5.439z"/>
        </svg>
      )
    }
  ]

  return (
    <>
      {/* Mobile Footer - Creative Single View */}
      <footer className="sm:hidden relative overflow-hidden">
        {/* Animated Background Gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-base-100 to-secondary/5" />
        
        <div className="relative px-4 py-6 space-y-4">
          {/* Floating Brand Card */}
          <div className="bg-base-100/80 backdrop-blur-sm rounded-2xl shadow-xl border border-primary/10 p-4">
            {/* Brand Header with Social Icons */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-gradient-to-br from-primary to-primary-focus rounded-lg flex items-center justify-center">
                  <span className="text-primary-content text-base">🎓</span>
                </div>
                <div>
                  <h3 className="text-base font-bold text-base-content">TeacherRank</h3>
                  <p className="text-xs text-base-content/60">Rate & Review</p>
                </div>
              </div>
              
              {/* Social Icons - Balanced size */}
              <div className="flex items-center gap-1">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    className="p-2 text-base-content/60 hover:text-primary hover:bg-primary/10 rounded-lg transition-all duration-200"
                    aria-label={social.name}
                  >
                    {React.cloneElement(social.icon as React.ReactElement, {
                      className: "w-4 h-4"
                    })}
                  </a>
                ))}
              </div>
            </div>
            
            {/* Quick Access Grid - Compact 2x2 */}
            <div className="grid grid-cols-2 gap-2">
              {quickLinks.map((link, index) => (
                <Link
                  key={link.path}
                  to={link.path}
                  className="bg-base-300 rounded-lg px-3 py-2 text-center hover:bg-primary/20 transition-all duration-200 group flex items-center justify-center"
                >
                  <div className="text-xs font-medium text-base-content group-hover:text-primary">
                    {link.label}
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Contact Strip */}
          <div className="bg-base-300 rounded-xl">
            <div className="rounded-xl p-3">
              <a 
                href="mailto:teacherrank.app@gmail.com"
                className="flex items-center justify-between group"
              >
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                    <svg className="w-4 h-4 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <div className="text-xs font-medium text-base-content">Get in Touch</div>
                    <div className="text-xs text-base-content/60">teacherrank.app@gmail.com</div>
                  </div>
                </div>
                <svg className="w-4 h-4 text-base-content/60 group-hover:text-primary transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
                </svg>
              </a>
            </div>
          </div>

          {/* Bottom Info - Minimal */}
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2 text-xs">
              <Link to="/privacy" className="text-base-content/60 hover:text-primary">Privacy</Link>
              <span className="text-base-content/30">•</span>
              <Link to="/terms" className="text-base-content/60 hover:text-primary">Terms</Link>
            </div>
            <p className="text-xs text-base-content/60">
              © {currentYear}
            </p>
          </div>

          {/* Developer Credit - Floating Badge */}
          <div className="flex justify-center">
            <a 
              href="https://github.com/TayyabManan"
              target="_blank"
              rel="noopener noreferrer" 
              className="inline-flex items-center gap-1.5 bg-neutral/5 backdrop-blur-sm rounded-full px-3 py-1.5 hover:bg-primary/10 transition-all duration-200 group"
            >
              <span className="text-xs text-base-content/60">Built with</span>
              <span className="text-xs">💜</span>
              <span className="text-xs font-medium text-primary group-hover:text-primary-focus">Tayyab Manan</span>
              <svg className="w-3 h-3 text-base-content/60 group-hover:text-primary" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
              </svg>
            </a>
          </div>
        </div>
      </footer>

      {/* Desktop Footer - Original unchanged */}
      <footer className="hidden sm:block bg-base-100 border-t border-base-300 w-full">
        <div className="max-w-7xl mx-auto px-4 py-8 lg:px-6">
          {/* Main Footer Content */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {/* Brand Section */}
            <div className="lg:col-span-2">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-gradient-to-r from-primary to-primary-focus rounded-xl flex items-center justify-center">
                  <span className="text-primary-content text-xl">🎓</span>
                </div>
                <div>
                  <h3 className="text-xl font-bold text-base-content">TeacherRank</h3>
                </div>
              </div>
              <p className="text-base-content/80 text-sm leading-relaxed mb-4 max-w-md">
                Empowering students and educators through transparent, constructive teacher reviews. 
                Building better learning experiences together.
              </p>
              <div className="flex items-center space-x-4">
                {socialLinks.map((social) => (
                  <a
                    key={social.name}
                    href={social.href}
                    className="text-base-content/60 hover:text-primary transition-colors duration-200 p-2 hover:bg-base-200 rounded-lg group"
                    aria-label={`Follow us on ${social.name}`}
                  >
                    {social.icon}
                  </a>
                ))}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-sm font-semibold text-base-content uppercase tracking-wide mb-4">
                Quick Links
              </h4>
              <ul className="space-y-2">
                {quickLinks.map((link) => (
                  <li key={link.path}>
                    <Link
                      to={link.path}
                      className="text-base-content/80 hover:text-primary text-sm transition-colors duration-200 block py-1"
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="text-sm font-semibold text-base-content uppercase tracking-wide mb-4">
                Contact
              </h4>
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-base-content/60 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 7.89a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  <a 
                    href="mailto:teacherrank.app@gmail.com" 
                    className="text-base-content/80 hover:text-primary text-sm transition-colors duration-200"
                  >
                    teacherrank.app@gmail.com
                  </a>
                </div>
                <div className="flex items-start gap-3">
                  <svg className="w-4 h-4 text-base-content/60 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span className="text-base-content/80 text-sm">
                    Online Platform
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Border */}
          <div className="border-t border-base-300/50 mt-8 pt-6">
            <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
              {/* Copyright */}
              <p className="text-sm text-base-content/60">
                © {currentYear} TeacherRank. All rights reserved.
              </p>

              {/* Additional Links */}
              <div className="flex items-center space-x-6">
                <Link
                  to="/privacy"
                  className="text-sm text-base-content/60 hover:text-primary transition-colors duration-200"
                >
                  Privacy
                </Link>
                <Link
                  to="/terms"
                  className="text-sm text-base-content/60 hover:text-primary transition-colors duration-200"
                >
                  Terms
                </Link>
                <a 
                  href="mailto:teacherrank.app@gmail.com" 
                  className="text-sm text-base-content/60 hover:text-primary transition-colors duration-200"
                >
                  Support
                </a>
              </div>
            </div>

            {/* Tagline */}
            <div className="text-center mt-4 pt-4 border-t border-base-200">
              <p className="text-xs text-base-content/60 italic">
                "Building bridges between students and educators through honest, constructive feedback."
              </p>
              <div className="mt-3 flex items-center justify-center gap-2">
                <span className="text-xs text-base-content/60">Made with 💜 by</span>
                <a 
                  href="https://github.com/TayyabManan" 
                  className="text-xs text-primary hover:text-primary-focus font-medium transition-colors duration-200 inline-flex items-center gap-1"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Tayyab Manan
                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/>
                  </svg>
                </a>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </>
  )
}
import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'

interface FAQItem {
  question: string
  answer: string
  category: 'general' | 'ratings' | 'account' | 'privacy' | 'technical'
}

const faqData: FAQItem[] = [
  // General Questions
  {
    category: 'general',
    question: 'What is TeacherRank?',
    answer: 'TeacherRank is a platform where students can rate and review their teachers to help other students make informed decisions about their education. It provides honest feedback about teaching quality, course difficulty, and overall experience.'
  },
  {
    category: 'general',
    question: 'Is TeacherRank free to use?',
    answer: 'Yes! TeacherRank is completely free for all students. You can browse reviews without an account, and creating an account to submit reviews is also free.'
  },
  {
    category: 'general',
    question: 'Who can see the reviews?',
    answer: 'All reviews are publicly visible to help students make informed decisions. However, reviewer identities can remain anonymous if you choose to submit an anonymous review.'
  },
  
  // Ratings & Reviews
  {
    category: 'ratings',
    question: 'Can I submit anonymous reviews?',
    answer: 'Yes, you can submit reviews anonymously without creating an account. Anonymous reviews help protect your privacy while still providing valuable feedback to other students.'
  },
  {
    category: 'ratings',
    question: 'Can I edit or delete my review?',
    answer: 'If you have an account and are logged in, you can edit or delete your own reviews from your dashboard. Anonymous reviews cannot be edited once submitted.'
  },
  {
    category: 'ratings',
    question: 'How is the average rating calculated?',
    answer: 'The average rating is calculated from all verified reviews for a teacher. Each review contributes equally to the overall rating, which is displayed on a 5-star scale.'
  },
  {
    category: 'ratings',
    question: 'What should I include in my review?',
    answer: 'Focus on constructive feedback about teaching style, course organization, communication, workload, and overall experience. Avoid personal attacks and keep reviews respectful and professional.'
  },
  {
    category: 'ratings',
    question: 'Are there guidelines for reviews?',
    answer: 'Yes! Reviews must be respectful, relevant, and based on actual experience. Profanity, discrimination, personal attacks, or false information will be removed. Multiple reviews for the same teacher by one user are not allowed.'
  },
  
  // Account Management
  {
    category: 'account',
    question: 'Do I need an account to browse reviews?',
    answer: 'No, you can browse and search for teacher reviews without creating an account. An account is only needed if you want to submit non-anonymous reviews or manage your review history.'
  },
  {
    category: 'account',
    question: 'What are the benefits of creating an account?',
    answer: 'With an account, you can: track your review history, edit or delete your reviews, build credibility as a reviewer, and access your personal dashboard.'
  },
  {
    category: 'account',
    question: 'How do I reset my password?',
    answer: 'Click on the "Sign In" button, then select "Forgot Password?" Enter your email address, and we\'ll send you instructions to reset your password.'
  },
  
  // Privacy & Safety
  {
    category: 'privacy',
    question: 'Is my personal information safe?',
    answer: 'Yes, we take privacy seriously. We use encryption to protect your data, never share personal information with third parties, and allow anonymous reviews to protect your identity.'
  },
  {
    category: 'privacy',
    question: 'Can teachers see who reviewed them?',
    answer: 'Teachers cannot see the identity of students who submit anonymous reviews. For registered users who choose to display their name, only the display name is shown, not email or other personal details.'
  },
  {
    category: 'privacy',
    question: 'What if I\'m concerned about retaliation?',
    answer: 'We recommend using the anonymous review feature if you have any concerns. Anonymous reviews protect your identity completely while still allowing you to share valuable feedback.'
  },
  
  // Technical & Support
  {
    category: 'technical',
    question: 'The website isn\'t loading properly. What should I do?',
    answer: 'Try clearing your browser cache, disabling ad blockers, using a different browser, or checking your internet connection. If problems persist, contact our support team.'
  },
  {
    category: 'technical',
    question: 'Can I suggest new features?',
    answer: 'Absolutely! We love hearing from our users. Send your suggestions to teacherrank.app@gmail.com or use the feedback form in your dashboard.'
  },
]

export default function FAQ() {
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [openItems, setOpenItems] = useState<Set<number>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')

  const categories = [
    { id: 'all', label: 'All Questions' },
    { id: 'general', label: 'General' },
    { id: 'ratings', label: 'Ratings & Reviews'},
    { id: 'account', label: 'Account'},
    { id: 'privacy', label: 'Privacy & Safety'},
    { id: 'technical', label: 'Technical Support'}
  ]

  const filteredFAQs = faqData.filter(item => {
    const matchesCategory = activeCategory === 'all' || item.category === activeCategory
    const matchesSearch = searchQuery === '' || 
      item.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      item.answer.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCategory && matchesSearch
  })

  const toggleItem = (index: number) => {
    const newOpenItems = new Set(openItems)
    if (newOpenItems.has(index)) {
      newOpenItems.delete(index)
    } else {
      newOpenItems.add(index)
    }
    setOpenItems(newOpenItems)
  }

  // Generate FAQ schema for SEO
  const faqSchema = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqData.map(item => ({
      "@type": "Question",
      "name": item.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": item.answer
      }
    }))
  }

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <Helmet>
        <title>Frequently Asked Questions - Teacher Rank | Student Guide</title>
        <meta name="description" content="Find answers to common questions about Teacher Rank. Learn how to rate teachers, submit reviews, manage your account, and understand our privacy policies." />
        <meta name="keywords" content="teacher rank faq, how to rate teachers, submit reviews, anonymous reviews, teacher rating guidelines" />
        <link rel="canonical" href="https://teacherrank.vercel.app/faq" />
        
        {/* Open Graph tags */}
        <meta property="og:title" content="FAQ - Teacher Rank" />
        <meta property="og:description" content="Find answers to common questions about rating teachers and using Teacher Rank." />
        <meta property="og:type" content="website" />
        <meta property="og:url" content="https://teacherrank.vercel.app/faq" />
        
        {/* FAQ Schema */}
        <script type="application/ld+json">
          {JSON.stringify(faqSchema)}
        </script>
        
        {/* BreadcrumbList */}
        <script type="application/ld+json">
          {JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            "itemListElement": [
              {
                "@type": "ListItem",
                "position": 1,
                "name": "Home",
                "item": "https://teacherrank.vercel.app"
              },
              {
                "@type": "ListItem",
                "position": 2,
                "name": "FAQ",
                "item": "https://teacherrank.vercel.app/faq"
              }
            ]
          })}
        </script>
      </Helmet>
      
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-4">
          Frequently Asked Questions
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Everything you need to know about using TeacherRank
        </p>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative">
          <input
            type="text"
            placeholder="Search for answers..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full px-4 py-3 pl-12 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 dark:text-white"
          />
          <svg
            className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
        </div>
      </div>

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 flex items-center gap-2 ${
              activeCategory === category.id
                ? 'bg-purple-500 text-white shadow-lg'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            
            <span>{category.label}</span>
            {category.id !== 'all' && (
              <span className="ml-1 text-xs opacity-70">
                ({faqData.filter(item => item.category === category.id).length})
              </span>
            )}
          </button>
        ))}
      </div>

      {/* FAQ Items */}
      {filteredFAQs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 dark:text-gray-400">
            No questions found matching your search.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredFAQs.map((item, index) => {
            const globalIndex = faqData.indexOf(item)
            const isOpen = openItems.has(globalIndex)
            
            return (
              <div
                key={globalIndex}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden transition-all duration-200 hover:shadow-md"
              >
                <button
                  onClick={() => toggleItem(globalIndex)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                >
                  <div className="flex-1 pr-4">
                    <h3 className="font-semibold text-gray-900 dark:text-white">
                      {item.question}
                    </h3>
                    <span className="inline-block mt-1 text-xs px-2 py-1 bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 rounded-full">
                      {categories.find(c => c.id === item.category)?.label}
                    </span>
                  </div>
                  <svg
                    className={`w-5 h-5 text-gray-500 dark:text-gray-400 transition-transform duration-200 ${
                      isOpen ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M19 9l-7 7-7-7"
                    />
                  </svg>
                </button>
                
                {isOpen && (
                  <div className="px-6 pb-4 text-gray-600 dark:text-gray-300 border-t border-gray-100 dark:border-gray-700 pt-4">
                    {item.answer}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Contact Support */}
      <div className="mt-12 p-6 bg-purple-50 dark:bg-purple-900/20 rounded-lg text-center">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
          Still have questions?
        </h3>
        <p className="text-gray-600 dark:text-gray-400 mb-4">
          Can't find the answer you're looking for? Our support team is here to help.
        </p>
        <a
          href="mailto:teacherrank.app@gmail.com"
          className="inline-flex items-center gap-2 px-6 py-3 bg-purple-500 text-white rounded-lg hover:bg-purple-600 transition-colors font-medium"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Contact Support
        </a>
      </div>
    </div>
  )
}
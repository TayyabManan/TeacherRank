import React, { useState } from 'react'
import { Helmet } from 'react-helmet-async'
import { jsonLd } from '../utils/jsonLd'
import { Reveal } from '../components/Reveal'
import { buttonClasses } from '../components/Button'
import { SearchInput } from '../components/SearchInput'

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
    <div className="max-w-content mx-auto py-8">
      <Helmet>
        <title>Frequently Asked Questions</title>
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
          {jsonLd(faqSchema)}
        </script>
        
        {/* BreadcrumbList */}
        <script type="application/ld+json">
          {jsonLd({
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
        <h1 className="text-3xl font-bold text-base-content mb-4">
          Frequently Asked Questions
        </h1>
        <p className="text-base-content/70">
          Everything you need to know about using TeacherRank
        </p>
      </div>

      {/* Search Bar */}
      <SearchInput
        value={searchQuery}
        onChange={setSearchQuery}
        aria-label="Search frequently asked questions"
        placeholder="Search for answers..."
        className="mb-6"
      />

      {/* Category Filters */}
      <div className="flex flex-wrap gap-2 mb-8">
        {categories.map(category => (
          <button
            key={category.id}
            onClick={() => setActiveCategory(category.id)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors duration-200 flex items-center gap-2 ${
              activeCategory === category.id
                ? 'bg-primary text-primary-content'
                : 'bg-base-200 text-base-content/70 hover:bg-base-300'
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
          <p className="text-base-content/70">
            No questions match your search. Try a different term.
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
                className="bg-base-100 rounded-lg border border-base-300 overflow-hidden transition-shadow duration-200 hover:shadow-sm"
              >
                <button
                  onClick={() => toggleItem(globalIndex)}
                  aria-expanded={isOpen}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-base-200 transition-colors"
                >
                  <div className="flex-1 pr-4">
                    <h2 className="font-semibold text-base text-base-content">
                      {item.question}
                    </h2>
                    <span className="inline-block mt-1 text-xs px-2 py-1 bg-primary/10 text-primary rounded-md">
                      {categories.find(c => c.id === item.category)?.label}
                    </span>
                  </div>
                  <svg
                    aria-hidden="true"
                    className={`w-5 h-5 text-base-content/70 transition-transform duration-200 ${
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
                
                {/* Always mounted; grid-rows 0fr -> 1fr gives a smooth height
                    transition both opening and closing without measuring height. */}
                <div
                  className={`accordion-rows ${
                    isOpen ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                  }`}
                >
                  <div className="overflow-hidden">
                    <div className="px-6 pb-4 text-base-content/70 leading-relaxed border-t border-base-300 pt-4">
                      {item.answer}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Contact Support */}
      <Reveal className="mt-12 p-6 bg-primary/5 rounded-lg text-center">
        <h2 className="text-lg font-semibold text-base-content mb-2">
          Still have questions?
        </h2>
        <p className="text-base-content/70 mb-4">
          Can't find the answer you're looking for? Our support team is here to help.
        </p>
        <a
          href="mailto:teacherrank.app@gmail.com"
          className={buttonClasses({ variant: 'primary', className: 'inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium' })}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Contact Support
        </a>
      </Reveal>
    </div>
  )
}
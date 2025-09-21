import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function TermsOfService() {
  const location = useLocation()
  const isAppContext = false // Remove app context check since we're moving to root paths
  
  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  // For app context, use standard white background
  if (isAppContext) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm p-8">
          <h1 className="text-4xl font-bold mb-8 text-gray-900 dark:text-white">Terms of Service</h1>
          
          <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <strong>Effective Date:</strong> January 1, 2025<br />
              <strong>Last Updated:</strong> January 1, 2025
            </p>
          </div>

          {renderContent(true)}
        </div>
      </div>
    )
  }

  // Landing page context with glassmorphic design
  return (
    <div className="max-w-4xl mx-auto px-8 py-20">
      <div className="bg-white dark:bg-gray-800 backdrop-blur-md rounded-3xl p-12 border border-gray-200 dark:border-gray-700">
        <h1 className="text-5xl font-semibold mb-8 text-gray-900 dark:text-white">Terms of Service</h1>

        <div className="mb-4 p-4 bg-gray-100 dark:bg-gray-700 backdrop-blur-sm rounded-lg">
          <p className="text-sm text-gray-800 dark:text-gray-200">
            <strong>Effective Date:</strong> January 1, 2025<br />
            <strong>Last Updated:</strong> January 1, 2025
          </p>
        </div>

        {renderContent(false)}
      </div>
    </div>
  )

  function renderContent(isApp: boolean) {
    const textClass = isApp ? "text-gray-700 dark:text-gray-300" : "text-gray-800 dark:text-gray-200"
    const headingClass = isApp ? "text-gray-900 dark:text-white" : "text-gray-900 dark:text-white"
    const subheadingClass = isApp ? "text-gray-800 dark:text-gray-100" : "text-gray-900 dark:text-gray-100"
    const bgAccentClass = isApp ? "bg-gray-50 dark:bg-gray-800" : "bg-gray-100 dark:bg-gray-700 backdrop-blur-sm"

    return (
      <>
        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>1. Agreement to Terms</h2>
          <p className={`mb-4 ${textClass}`}>
            By accessing or using TeacherRank ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you do not have permission to access the Service.
          </p>
          <p className={`mb-4 ${textClass}`}>
            These Terms apply to all visitors, users, and others who access or use the Service, including teachers, students, educational institutions, and general users.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>2. Description of Service</h2>
          <p className={`mb-4 ${textClass}`}>
            TeacherRank is an educational feedback platform that allows users to:
          </p>
          <ul className={`list-disc ml-6 mb-4 ${textClass}`}>
            <li>View profiles of teachers and educational instructors</li>
            <li>Submit ratings and reviews for teachers</li>
            <li>Search and filter teachers by institution and other criteria</li>
            <li>Access aggregated rating information</li>
            <li>Create and manage teacher profiles (authorized users only)</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>3. User Accounts</h2>
          
          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>3.1 Account Creation</h3>
          <p className={`mb-4 ${textClass}`}>
            You may browse the Service without an account. To submit reviews or access certain features, you must create an account with accurate and complete information.
          </p>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>3.2 Account Security</h3>
          <p className={`mb-4 ${textClass}`}>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
          </p>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>3.3 Account Termination</h3>
          <p className={`mb-4 ${textClass}`}>
            We reserve the right to suspend or terminate accounts that violate these Terms or engage in harmful behavior.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>4. Content Guidelines</h2>
          
          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>4.1 User-Generated Content</h3>
          <p className={`mb-4 ${textClass}`}>
            By submitting content (reviews, ratings, comments), you grant TeacherRank a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content.
          </p>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>4.2 Prohibited Content</h3>
          <p className={`mb-4 ${textClass}`}>You may not submit content that:</p>
          <ul className={`list-disc ml-6 mb-4 ${textClass}`}>
            <li>Is false, misleading, or defamatory</li>
            <li>Contains personal attacks or harassment</li>
            <li>Includes profanity or inappropriate language</li>
            <li>Violates privacy rights or confidentiality</li>
            <li>Promotes discrimination or hate speech</li>
            <li>Contains spam or commercial content</li>
            <li>Violates any applicable laws</li>
          </ul>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>4.3 Content Moderation</h3>
          <p className={`mb-4 ${textClass}`}>
            We reserve the right to remove or modify content that violates these Terms. However, we are not obligated to monitor all content.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>5. Teacher Profiles</h2>
          
          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>5.1 Profile Creation</h3>
          <p className={`mb-4 ${textClass}`}>
            Teacher profiles may be created by authorized administrators or through our verification process. Unauthorized creation of teacher profiles is prohibited.
          </p>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>5.2 Profile Accuracy</h3>
          <p className={`mb-4 ${textClass}`}>
            Information in teacher profiles must be accurate and up-to-date. Teachers may request corrections through our support system.
          </p>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>5.3 Profile Removal</h3>
          <p className={`mb-4 ${textClass}`}>
            Teachers may request profile removal under certain circumstances, subject to our policies and applicable laws.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>6. Intellectual Property</h2>
          
          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>6.1 Service Content</h3>
          <p className={`mb-4 ${textClass}`}>
            All Service content (excluding user-generated content) is owned by TeacherRank and protected by intellectual property laws.
          </p>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>6.2 Limited License</h3>
          <p className={`mb-4 ${textClass}`}>
            We grant you a limited, non-exclusive license to access and use the Service for personal, non-commercial purposes.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>7. Privacy and Data Protection</h2>
          <p className={`mb-4 ${textClass}`}>
            Your use of the Service is subject to our Privacy Policy. By using the Service, you consent to our collection and use of your information as described in the Privacy Policy.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>8. Prohibited Activities</h2>
          <p className={`mb-4 ${textClass}`}>You may not:</p>
          <ul className={`list-disc ml-6 mb-4 ${textClass}`}>
            <li>Use the Service for illegal purposes</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Interfere with or disrupt the Service</li>
            <li>Use automated tools to scrape or collect data</li>
            <li>Impersonate others or create fake accounts</li>
            <li>Manipulate ratings or reviews</li>
            <li>Use the Service to harass or harm others</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>9. Disclaimers and Limitations</h2>
          
          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>9.1 Service Availability</h3>
          <p className={`mb-4 ${textClass}`}>
            The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free service.
          </p>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>9.2 Content Accuracy</h3>
          <p className={`mb-4 ${textClass}`}>
            We do not endorse or verify user-generated content. Ratings and reviews represent individual opinions and experiences.
          </p>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>9.3 Educational Decisions</h3>
          <p className={`mb-4 ${textClass}`}>
            TeacherRank is an informational tool. Users should not rely solely on our Service for important educational decisions.
          </p>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>9.4 Limitation of Liability</h3>
          <p className={`mb-4 ${textClass}`}>
            To the fullest extent permitted by law, TeacherRank shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the Service.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>10. Indemnification</h2>
          <p className={`mb-4 ${textClass}`}>
            You agree to indemnify and hold TeacherRank harmless from any claims, damages, or expenses (including reasonable attorneys' fees) arising from:
          </p>
          <ul className={`list-disc ml-6 mb-4 ${textClass}`}>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of another party</li>
            <li>Your content or use of the Service</li>
          </ul>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>11. Modifications to Service and Terms</h2>
          
          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>11.1 Service Changes</h3>
          <p className={`mb-4 ${textClass}`}>
            We reserve the right to modify, suspend, or discontinue the Service at any time without notice.
          </p>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>11.2 Terms Updates</h3>
          <p className={`mb-4 ${textClass}`}>
            We may revise these Terms at any time. Material changes will be notified via email or Service announcement. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>12. Dispute Resolution</h2>
          
          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>12.1 Informal Resolution</h3>
          <p className={`mb-4 ${textClass}`}>
            We encourage users to contact us first to resolve disputes informally.
          </p>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>12.2 Binding Arbitration</h3>
          <p className={`mb-4 ${textClass}`}>
            Any disputes not resolved informally shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.
          </p>

          <h3 className={`text-xl font-semibold mt-6 mb-3 ${subheadingClass}`}>12.3 Class Action Waiver</h3>
          <p className={`mb-4 ${textClass}`}>
            You agree to resolve disputes on an individual basis and waive any right to participate in class action suits.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>13. Governing Law</h2>
          <p className={`mb-4 ${textClass}`}>
            These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law provisions. For users outside the United States, local laws may apply.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>14. Severability</h2>
          <p className={`mb-4 ${textClass}`}>
            If any provision of these Terms is found to be unenforceable, the remaining provisions will continue to be valid and enforceable.
          </p>
        </section>

        <section className="mb-8">
          <h2 className={`text-2xl font-semibold mt-8 mb-4 ${headingClass}`}>15. Contact Information</h2>
          <p className={`mb-4 ${textClass}`}>
            For questions about these Terms of Service, please contact us:
          </p>
          <div className={`p-4 ${bgAccentClass} rounded-lg`}>
            <p className={textClass}>
              <strong>Support:</strong> teacherrank.app@gmail.com<br />
              <strong>Response Time:</strong> Within 2-3 business days
            </p>
          </div>
        </section>

        <div className={`mt-12 p-6 rounded-lg ${isApp ? 'bg-blue-50 dark:bg-gray-800' : 'bg-gray-100 dark:bg-gray-800'}`}>
          <p className={`text-center font-semibold mb-4 ${isApp ? 'text-gray-700 dark:text-gray-300' : 'text-gray-800 dark:text-gray-200'}`}>
            By using TeacherRank, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link
              to="/"
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white text-sm sm:text-base rounded-full font-semibold hover:from-purple-700 hover:to-purple-800 transition-all touch-friendly text-center"
            >
              I Agree - Return to Home
            </Link>
            <Link
              to="/privacy"
              className="px-4 sm:px-6 py-2 sm:py-2.5 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-full font-semibold hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors border border-gray-300 dark:border-gray-600 text-sm sm:text-base text-center"
            >
              View Privacy Policy
            </Link>
          </div>
        </div>
      </>
    )
  }
}
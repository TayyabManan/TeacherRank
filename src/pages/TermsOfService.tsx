import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'

export default function TermsOfService() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="max-w-reading mx-auto py-8 sm:py-12 lg:py-16">
      <Helmet>
        <title>Terms of Service</title>
      </Helmet>
      <div className="bg-base-100 rounded-lg p-5 sm:p-8 lg:p-12 border border-base-300">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6 lg:mb-8 text-base-content">Terms of Service</h1>

        <div className="mb-6 p-3 sm:p-4 bg-base-200 rounded-lg">
          <p className="text-xs sm:text-sm text-base-content/70">
            <strong>Effective Date:</strong> January 1, 2025<br />
            <strong>Last Updated:</strong> January 1, 2025
          </p>
        </div>

        {renderContent()}
      </div>
    </div>
  )

  function renderContent() {
    const textClass = "text-base-content/80"
    const headingClass = "text-base-content"
    const subheadingClass = "text-base-content"
    const bgAccentClass = "bg-base-200"

    return (
      <div className="prose-content">
        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>1. Agreement to Terms</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            By accessing or using TeacherRank ("Service"), you agree to be bound by these Terms of Service ("Terms"). If you disagree with any part of these terms, you do not have permission to access the Service.
          </p>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            These Terms apply to all visitors, users, and others who access or use the Service, including teachers, students, educational institutions, and general users.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>2. Description of Service</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            TeacherRank is an educational feedback platform that allows users to:
          </p>
          <ul className={`list-disc ml-4 sm:ml-6 mb-4 space-y-1 sm:space-y-2 ${textClass}`}>
            <li>View profiles of teachers and educational instructors</li>
            <li>Submit ratings and reviews for teachers</li>
            <li>Search and filter teachers by institution and other criteria</li>
            <li>Access aggregated rating information</li>
            <li>Create and manage teacher profiles (authorized users only)</li>
          </ul>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>3. User Accounts</h2>
          
          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>3.1 Account Creation</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            You may browse the Service without an account. To submit reviews or access certain features, you must create an account with accurate and complete information.
          </p>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>3.2 Account Security</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            You are responsible for maintaining the confidentiality of your account credentials and for all activities under your account.
          </p>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>3.3 Account Termination</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            We reserve the right to suspend or terminate accounts that violate these Terms or engage in harmful behavior.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>4. Content Guidelines</h2>
          
          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>4.1 User-Generated Content</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            By submitting content (reviews, ratings, comments), you grant TeacherRank a non-exclusive, worldwide, royalty-free license to use, display, and distribute your content.
          </p>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>4.2 Prohibited Content</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>You may not submit content that:</p>
          <ul className={`list-disc ml-4 sm:ml-6 mb-4 space-y-1 sm:space-y-2 ${textClass}`}>
            <li>Is false, misleading, or defamatory</li>
            <li>Contains personal attacks or harassment</li>
            <li>Includes profanity or inappropriate language</li>
            <li>Violates privacy rights or confidentiality</li>
            <li>Promotes discrimination or hate speech</li>
            <li>Contains spam or commercial content</li>
            <li>Violates any applicable laws</li>
          </ul>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>4.3 Content Moderation</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            We reserve the right to remove or modify content that violates these Terms. However, we are not obligated to monitor all content.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>5. Teacher Profiles</h2>
          
          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>5.1 Profile Creation</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            Teacher profiles may be created by authorized administrators or through our verification process. Unauthorized creation of teacher profiles is prohibited.
          </p>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>5.2 Profile Accuracy</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            Information in teacher profiles must be accurate and up-to-date. Teachers may request corrections through our support system.
          </p>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>5.3 Profile Removal</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            Teachers may request profile removal under certain circumstances, subject to our policies and applicable laws.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>6. Intellectual Property</h2>
          
          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>6.1 Service Content</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            All Service content (excluding user-generated content) is owned by TeacherRank and protected by intellectual property laws.
          </p>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>6.2 Limited License</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            We grant you a limited, non-exclusive license to access and use the Service for personal, non-commercial purposes.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>7. Privacy and Data Protection</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            Your use of the Service is subject to our Privacy Policy. By using the Service, you consent to our collection and use of your information as described in the Privacy Policy.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>8. Prohibited Activities</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>You may not:</p>
          <ul className={`list-disc ml-4 sm:ml-6 mb-4 space-y-1 sm:space-y-2 ${textClass}`}>
            <li>Use the Service for illegal purposes</li>
            <li>Attempt to gain unauthorized access to our systems</li>
            <li>Interfere with or disrupt the Service</li>
            <li>Use automated tools to scrape or collect data</li>
            <li>Impersonate others or create fake accounts</li>
            <li>Manipulate ratings or reviews</li>
            <li>Use the Service to harass or harm others</li>
          </ul>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>9. Disclaimers and Limitations</h2>
          
          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>9.1 Service Availability</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            The Service is provided "as is" without warranties of any kind. We do not guarantee uninterrupted or error-free service.
          </p>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>9.2 Content Accuracy</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            We do not endorse or verify user-generated content. Ratings and reviews represent individual opinions and experiences.
          </p>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>9.3 Educational Decisions</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            TeacherRank is an informational tool. Users should not rely solely on our Service for important educational decisions.
          </p>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>9.4 Limitation of Liability</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            To the fullest extent permitted by law, TeacherRank shall not be liable for any indirect, incidental, special, consequential, or punitive damages resulting from your use or inability to use the Service.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>10. Indemnification</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            You agree to indemnify and hold TeacherRank harmless from any claims, damages, or expenses (including reasonable attorneys' fees) arising from:
          </p>
          <ul className={`list-disc ml-4 sm:ml-6 mb-4 space-y-1 sm:space-y-2 ${textClass}`}>
            <li>Your violation of these Terms</li>
            <li>Your violation of any rights of another party</li>
            <li>Your content or use of the Service</li>
          </ul>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>11. Modifications to Service and Terms</h2>
          
          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>11.1 Service Changes</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            We reserve the right to modify, suspend, or discontinue the Service at any time without notice.
          </p>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>11.2 Terms Updates</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            We may revise these Terms at any time. Material changes will be notified via email or Service announcement. Continued use after changes constitutes acceptance.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>12. Dispute Resolution</h2>
          
          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>12.1 Informal Resolution</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            We encourage users to contact us first to resolve disputes informally.
          </p>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>12.2 Binding Arbitration</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            Any disputes not resolved informally shall be resolved through binding arbitration in accordance with the rules of the American Arbitration Association.
          </p>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>12.3 Class Action Waiver</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            You agree to resolve disputes on an individual basis and waive any right to participate in class action suits.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>13. Governing Law</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            These Terms shall be governed by and construed in accordance with the laws of the United States, without regard to conflict of law provisions. For users outside the United States, local laws may apply.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>14. Severability</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            If any provision of these Terms is found to be unenforceable, the remaining provisions will continue to be valid and enforceable.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>15. Contact Information</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            For questions about these Terms of Service, please contact us:
          </p>
          <div className={`p-4 ${bgAccentClass} rounded-lg`}>
            <p className={textClass}>
              <strong>Support:</strong> teacherrank.app@gmail.com<br />
              <strong>Response Time:</strong> Within 2-3 business days
            </p>
          </div>
        </section>

        <div className="mt-8 sm:mt-12 p-4 sm:p-6 rounded-lg bg-base-200">
          <p className="text-center text-sm sm:text-base font-semibold mb-3 sm:mb-4 text-base-content/80">
            By using TeacherRank, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-3 sm:gap-4">
            <Link
              to="/"
              className="px-5 sm:px-6 py-2.5 bg-primary text-primary-content text-sm sm:text-base rounded-lg font-semibold hover:bg-primary-focus transition-colors touch-friendly text-center"
            >
              I Agree - Return to Home
            </Link>
            <Link
              to="/privacy"
              className="px-5 sm:px-6 py-2.5 bg-base-100 text-base-content rounded-lg font-semibold hover:bg-base-300 transition-colors border border-base-300 text-sm sm:text-base text-center"
            >
              View Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    )
  }
}
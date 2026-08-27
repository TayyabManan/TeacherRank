import React, { useEffect } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { Helmet } from '../components/Meta'

export default function PrivacyPolicy() {
  const location = useLocation()

  useEffect(() => {
    window.scrollTo(0, 0)
  }, [])

  return (
    <div className="max-w-reading mx-auto py-8 sm:py-12 lg:py-16">
      <Helmet>
        <title>Privacy policy</title>
      </Helmet>
      <div className="bg-base-100 rounded-lg p-5 sm:p-8 lg:p-12 border border-base-300">
        <h1 className="text-3xl sm:text-4xl font-bold mb-6 lg:mb-8 text-base-content">Privacy policy</h1>

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

    return (
      <div className="prose-content">
        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>1. Introduction</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            Welcome to TeacherRank ("we," "our," or "us"). We are committed to protecting your personal information and your right to privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our teacher rating and feedback platform.
          </p>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            By using TeacherRank, you agree to the collection and use of information in accordance with this policy. If you do not agree with our policies and practices, please do not use our services.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>2. Information We Collect</h2>
          
          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>2.1 Information You Provide</h3>
          <ul className={`list-disc ml-4 sm:ml-6 mb-4 space-y-1 sm:space-y-2 ${textClass}`}>
            <li><strong>Account Information:</strong> Email address, password (encrypted), and optional profile information</li>
            <li><strong>Teacher Profiles:</strong> Name, institution, designation, city, LinkedIn URL, bio, and avatar (for teachers or authorized administrators)</li>
            <li><strong>Ratings and Reviews:</strong> Numerical ratings, written feedback, and timestamps</li>
            <li><strong>Communication Data:</strong> Information you provide when contacting support</li>
          </ul>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>2.2 Information Collected Automatically</h3>
          <ul className={`list-disc ml-4 sm:ml-6 mb-4 space-y-1 sm:space-y-2 ${textClass}`}>
            <li><strong>Usage Data:</strong> Pages visited, features used, search queries, and interaction patterns</li>
            <li><strong>Device Information:</strong> Browser type, operating system, device type, and screen resolution</li>
            <li><strong>Performance Metrics:</strong> Page load times, error logs, and Core Web Vitals (via Web Vitals API)</li>
            <li><strong>IP Address:</strong> Used for security, rate limiting, and general location (country/city level)</li>
          </ul>

          <h3 className={`text-base sm:text-lg lg:text-xl font-semibold mt-4 sm:mt-6 mb-2 sm:mb-3 ${subheadingClass}`}>2.3 Cookies and Similar Technologies</h3>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            We use cookies and similar tracking technologies to track activity on our Service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>3. How We Use Your Information</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>We use the collected information for various purposes:</p>
          <ul className={`list-disc ml-4 sm:ml-6 mb-4 space-y-1 sm:space-y-2 ${textClass}`}>
            <li>To provide and maintain our Service</li>
            <li>To notify you about changes to our Service</li>
            <li>To provide customer support</li>
            <li>To gather analysis or valuable information to improve our Service</li>
            <li>To monitor the usage of our Service</li>
            <li>To detect, prevent and address technical issues</li>
            <li>To ensure the integrity and fairness of reviews</li>
            <li>To comply with legal obligations</li>
          </ul>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>4. Data Sharing and Disclosure</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            We do not sell, trade, or rent your personal information to third parties. We may share your information in the following situations:
          </p>
          <ul className={`list-disc ml-4 sm:ml-6 mb-4 space-y-1 sm:space-y-2 ${textClass}`}>
            <li><strong>Public Information:</strong> Teacher reviews and ratings are publicly visible (reviewer names are optional)</li>
            <li><strong>Service Providers:</strong> With trusted third-party services that help us operate our platform (e.g., Supabase for database, Vercel for hosting)</li>
            <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
            <li><strong>Business Transfers:</strong> In connection with a merger, acquisition, or sale of assets</li>
          </ul>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>5. Data Security</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            We implement appropriate technical and organizational security measures to protect your personal information:
          </p>
          <ul className={`list-disc ml-4 sm:ml-6 mb-4 space-y-1 sm:space-y-2 ${textClass}`}>
            <li>Encryption of passwords using industry-standard bcrypt hashing</li>
            <li>Secure HTTPS connections for all data transmissions</li>
            <li>Row-level security policies in our database</li>
            <li>Regular security audits and updates</li>
            <li>Limited access to personal information on a need-to-know basis</li>
          </ul>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>6. Data Retention</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            We retain your personal information for as long as necessary to provide our services and fulfill the purposes outlined in this Privacy Policy. Specifically:
          </p>
          <ul className={`list-disc ml-4 sm:ml-6 mb-4 space-y-1 sm:space-y-2 ${textClass}`}>
            <li><strong>Account Data:</strong> Retained until account deletion is requested</li>
            <li><strong>Reviews and Ratings:</strong> Retained indefinitely as part of our service's core functionality</li>
            <li><strong>Usage Logs:</strong> Retained for 90 days for security and analytics purposes</li>
            <li><strong>Cookie Data:</strong> Session cookies expire when you close your browser; persistent cookies expire after 30 days</li>
          </ul>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>7. Your Rights and Choices</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>You have the following rights regarding your personal information:</p>
          <ul className={`list-disc ml-4 sm:ml-6 mb-4 space-y-1 sm:space-y-2 ${textClass}`}>
            <li><strong>Access:</strong> Request a copy of your personal information</li>
            <li><strong>Correction:</strong> Request correction of inaccurate information</li>
            <li><strong>Deletion:</strong> Request deletion of your account and associated data</li>
            <li><strong>Portability:</strong> Request your data in a portable format</li>
            <li><strong>Opt-out:</strong> Opt-out of marketing communications</li>
            <li><strong>Anonymous Reviews:</strong> Choose to submit reviews without creating an account</li>
          </ul>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            To exercise these rights, please contact us at teacherrank.app@gmail.com
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>8. Children's Privacy</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            Our Service is intended for users who are at least 13 years old. We do not knowingly collect personal information from children under 13. If you are a parent or guardian and believe your child has provided us with personal information, please contact us immediately.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>9. Third-Party Services</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>Our Service uses the following third-party services:</p>
          <ul className={`list-disc ml-4 sm:ml-6 mb-4 space-y-1 sm:space-y-2 ${textClass}`}>
            <li><strong>Supabase:</strong> Database and authentication services (Privacy: supabase.com/privacy)</li>
            <li><strong>Vercel:</strong> Hosting and deployment (Privacy: vercel.com/legal/privacy-policy)</li>
            <li><strong>Google Fonts:</strong> Typography services (Privacy: policies.google.com/privacy)</li>
          </ul>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>10. International Data Transfers</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            Your information may be transferred to and maintained on servers located outside of your state, province, country, or other governmental jurisdiction where data protection laws may differ. Your consent to this Privacy Policy followed by your submission of such information represents your agreement to that transfer.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>11. Changes to This Privacy Policy</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            We may update our Privacy Policy from time to time. We will notify you of any changes by posting the new Privacy Policy on this page and updating the "Last Updated" date. You are advised to review this Privacy Policy periodically for any changes.
          </p>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>12. Contact Us</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            If you have any questions about this Privacy Policy or our data practices, please contact us:
          </p>
          <div className={`ml-6 mb-4 ${textClass}`}>
            <p><strong>Email:</strong> teacherrank.app@gmail.com</p>
            <p><strong>Website:</strong> teacherrank.vercel.app</p>
          </div>
        </section>

        <section className="mb-6 sm:mb-8">
          <h2 className={`text-lg sm:text-xl lg:text-2xl font-semibold mt-4 sm:mt-6 lg:mt-8 mb-3 sm:mb-4 ${headingClass}`}>13. Supervisory Authority</h2>
          <p className={`mb-3 sm:mb-4 text-sm sm:text-base ${textClass}`}>
            EU residents have the right to lodge a complaint with their local data protection supervisory authority if they believe their rights under GDPR have been violated.
          </p>
        </section>

        <div className="mt-8 sm:mt-12 p-4 sm:p-6 rounded-lg bg-base-200">
          <p className="text-center text-sm sm:text-base font-semibold text-base-content/80">
            By using TeacherRank, you acknowledge that you have read and understood this Privacy Policy.
          </p>
          <div className="flex justify-center mt-3 sm:mt-4">
            <Link
              to="/"
              className="px-5 sm:px-6 py-2.5 bg-primary text-primary-content text-sm sm:text-base rounded-lg font-semibold hover:bg-primary-focus transition-colors touch-friendly"
            >
              Return to Home
            </Link>
          </div>
        </div>
      </div>
    )
  }
}
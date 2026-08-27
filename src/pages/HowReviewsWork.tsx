import React from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from '../components/Meta'
import { PageHero } from '../components/PageHero'
import { SectionHeading } from '../components/SectionHeading'
import { buttonClasses } from '../components/Button'
import { StarSolidIcon } from '../components/icons'
import {
  TOP_RATED_MIN_AVG,
  TOP_RATED_MIN_REVIEWS,
  MIN_REVIEWS_FOR_DISTRIBUTION,
} from '../lib/reviewStandards'

/**
 * The trust page — the platform's signature. Everything on it must stay TRUE
 * to the running system (rate limits are migration 015, the comment rule is
 * ratingSchema, the Top-rated gate is TeacherListing/TeacherProfile). If a
 * mechanic changes, change this page in the same commit — an out-of-date
 * transparency page is worse than none.
 */
export default function HowReviewsWork() {
  return (
    <div className="max-w-content mx-auto space-y-6">
      <Helmet>
        <title>How reviews work</title>
        <meta
          name="description"
          content="How TeacherRank ratings work: what gets checked before a review goes up, what we don't verify, how anonymity is protected, and the exact thresholds behind the numbers."
        />
        <link rel="canonical" href="https://teacherrank.vercel.app/how-reviews-work" />
      </Helmet>

      <PageHero
        icon={<StarSolidIcon className="w-6 h-6" />}
        title="How reviews work"
        description="Ratings are only useful if you can trust them. This page explains how the whole system works, including the parts we don't verify."
      />

      <section className="space-y-3">
        <SectionHeading as="h2">Writing a review</SectionHeading>
        <div className="prose-content text-base-content/80 text-sm md:text-base">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Anyone can rate a teacher from 0.5 to 5 stars, in half-star steps. A written comment is optional for ratings of 3 stars and up.</li>
            <li><strong className="text-base-content">Low ratings need a reason.</strong> A rating of 2 stars or less requires a short written explanation. A bare 1-star with nothing behind it helps no one, and it isn't fair to the teacher.</li>
            <li>One review per teacher per person. Submitting again updates your existing review instead of adding a second one. With an account, you can also edit or delete your reviews any time from your dashboard.</li>
            <li>Comments are capped at 500 characters, and links aren't allowed in them.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading as="h2">Anonymous reviews and your privacy</SectionHeading>
        <div className="prose-content text-base-content/80 text-sm md:text-base">
          <p>You don't need an account to review a teacher, and anonymous reviews show no name, just "Anonymous student".</p>
          <p>To stop one person from posting the same review over and over, an anonymous review carries a technical device signal. Here is exactly how that is handled:</p>
          <ul className="list-disc pl-5 space-y-1.5">
            <li>It is used for one thing: letting the same device <em>update</em> its own review of the same teacher instead of duplicating it.</li>
            <li>It is never shown publicly, and it is not readable through the public data interface.</li>
            <li>We never use it to connect your reviews across different teachers, and nothing on the site displays reviews grouped by device.</li>
          </ul>
          <p>If you'd rather not rely on that, sign in. Signed-in reviews are tied to your account instead, and you control the display name. The <Link to="/privacy" className="text-primary hover:text-primary-focus underline">privacy policy</Link> covers data handling in full.</p>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading as="h2">What keeps ratings honest</SectionHeading>
        <div className="prose-content text-base-content/80 text-sm md:text-base">
          <ul className="list-disc pl-5 space-y-1.5">
            <li><strong className="text-base-content">Rate limits are enforced in the database</strong>, not just in the app: an anonymous reviewer is limited to one review per teacher per day per network address, and each teacher can receive at most 20 anonymous reviews per hour. Bursts of manufactured reviews hit a wall even if someone bypasses the app.</li>
            <li>Automatic checks screen comments for profanity and spam patterns before they submit. These checks are strongest in English today; flagged or suspicious content is also surfaced to moderators for human review.</li>
            <li><strong className="text-base-content">What we don't verify:</strong> we can't confirm that a reviewer actually took a class with the teacher, because no enrollment records are available to us. We'd rather say that plainly than imply a verification that doesn't exist. The safeguards above take its place.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading as="h2">Moderation</SectionHeading>
        <div className="prose-content text-base-content/80 text-sm md:text-base">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>Moderators can remove a review that breaks the rules (personal attacks, discrimination, spam, false information) or flag it for follow-up. <strong className="text-base-content">They cannot edit what you wrote.</strong> A review is either yours, word for word, or it's removed.</li>
            <li>Teacher pages don't appear automatically: every teacher request is reviewed by a moderator before going live, and the requester is emailed when it's approved, declined, or needs more detail.</li>
            <li>Teachers and institutes cannot pay to improve, hide, or remove reviews. There are no sponsored placements anywhere on the site.</li>
          </ul>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading as="h2">What the numbers mean</SectionHeading>
        <div className="prose-content text-base-content/80 text-sm md:text-base">
          <ul className="list-disc pl-5 space-y-1.5">
            <li>A teacher's average is the plain mean of their current reviews: every review counts equally, and a deleted review leaves the average immediately.</li>
            <li>An average is always shown together with its review count. A 4.8 from 3 reviews and a 4.8 from 130 reviews are not the same evidence, and we won't present them as if they were.</li>
            <li>The star-by-star breakdown appears on a teacher's page once they have {MIN_REVIEWS_FOR_DISTRIBUTION} or more reviews. Below that, a histogram implies more data than actually exists.</li>
          </ul>
        </div>
        <div className="bg-base-100 border border-base-300 rounded-lg shadow-sm p-4 md:p-5 text-sm text-base-content/80">
          <p className="font-semibold text-base-content mb-1">The "Top rated" rule, published</p>
          <p className="m-0">
            The <span className="text-xs font-medium text-primary bg-primary/10 rounded-md px-2 py-0.5">Top rated</span> badge
            {/* Rendered from lib/reviewStandards.ts — the same constants the
                badge checks, so the published rule can't drift from the code. */}
            requires an average of <span className="tabular-nums font-medium text-base-content">{TOP_RATED_MIN_AVG}+</span> from at least{' '}
            <span className="tabular-nums font-medium text-base-content">{TOP_RATED_MIN_REVIEWS} reviews</span>. A perfect score from two reviews
            doesn't earn it, because volume is part of credibility.
          </p>
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading as="h2">Spotted a problem?</SectionHeading>
        <div className="prose-content text-base-content/80 text-sm md:text-base">
          <p>
            If a review looks fake, abusive, or targets the wrong person, tell us. Include the teacher's name and what's
            wrong, and a moderator will look at it.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link to="/feedback" className={buttonClasses({ variant: 'primary' })}>
            Report via feedback
          </Link>
          <a href="mailto:teacherrank.app@gmail.com" className={buttonClasses({ variant: 'outline' })}>
            Email us
          </a>
        </div>
      </section>
    </div>
  )
}

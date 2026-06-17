import { PASSWORD_CRITERIA } from '../lib/validation';

interface Props {
  password: string;
}

/**
 * Live requirements checklist shown under the sign-up password field. Each
 * criterion flips from muted to success as the user types. Criteria come from
 * PASSWORD_CRITERIA so this stays in sync with the Zod schema.
 */
export function PasswordChecklist({ password }: Props) {
  return (
    <ul className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1" aria-label="Password requirements">
      {PASSWORD_CRITERIA.map((c) => {
        const met = c.test(password);
        return (
          <li
            key={c.id}
            className={`flex items-center gap-1.5 text-xs transition-colors duration-200 ${
              met ? 'text-success' : 'text-base-content/50'
            }`}
          >
            {met ? (
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            ) : (
              <svg className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="9" strokeWidth="2" />
              </svg>
            )}
            <span>
              {c.label}
              <span className="sr-only">{met ? ' — met' : ' — not met'}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

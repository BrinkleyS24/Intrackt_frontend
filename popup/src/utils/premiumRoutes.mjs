// Where the popup's Premium links land. Kept free of React and chrome.* so it runs under `node --test`.
//
// A Premium member who tapped "Your next move on this interview -> Open" landed on /upgrade, the
// pricing page, which only said "You're on Premium" (persona report 2026-10-15). Only free users
// should ever be sent to pricing; members go to the page that does the job.

/** The web path for "Your next move" on an application in this stage, for a Premium member. */
export function nextMovePath(statusKey) {
  // Interview Prep lists live interviews and opens the practice workspace for each one.
  if (statusKey === 'interviewed') return '/interview-prep';
  // Next Actions holds the follow-up and close-out steps for applications still waiting.
  return '/next-actions';
}

/**
 * The web path a generic Premium link opens. Free users go to pricing, tagged with where they came
 * from; members go to their dashboard (the pricing page has nothing for them).
 */
export function premiumLinkPath(userPlan, source) {
  if (userPlan === 'premium') return '/dashboard';
  const tag = typeof source === 'string' && /^[a-z0-9_]{1,40}$/.test(source) ? `?source=${source}` : '';
  return `/upgrade${tag}`;
}

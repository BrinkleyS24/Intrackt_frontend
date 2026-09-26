/**
 * Apply Gate from the popup: read the posting in the tab the user is looking at, and turn the
 * backend's verdict into the few lines a popup can hold.
 *
 * The web page asks the user to copy a job description out of one tab and paste it into another.
 * Checking the role where the user already is removes that step; the call, the reasons and the
 * decision buttons are the same ones the web page shows, so the two never disagree.
 */

/**
 * Runs INSIDE the job page via chrome.scripting.executeScript, so it must stay self-contained:
 * no imports, no closures, nothing from module scope. Read-only — it never changes the page.
 *
 * Structured data first. Most applicant-tracking systems (Greenhouse, Lever, Workday, Ashby,
 * iCIMS) and the big boards publish a schema.org JobPosting with a clean title, employer and
 * description, which is far better input than a page full of navigation. The page's main text
 * is the fallback, with a cheap check that it reads like a posting at all.
 */
export function extractJobPostingFromPage() {
  const MAX_CHARS = 60000;
  const PLATFORM_NAMES = /^(linkedin|indeed|glassdoor|ziprecruiter|monster|dice|wellfound|greenhouse|lever|workday|ashby|icims|smartrecruiters|jobvite|builtin|built in)$/i;
  const clean = (value) => String(value || '')
    .replace(/ /g, ' ')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
  // DOMParser builds an inert document: no scripts run and no images load, unlike innerHTML.
  const htmlToText = (html) => {
    const withBreaks = String(html || '')
      .replace(/<li[^>]*>/gi, '\n• ')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|ul|ol|h[1-6]|section)>/gi, '\n');
    const doc = new DOMParser().parseFromString(withBreaks, 'text/html');
    return clean(doc.body ? doc.body.textContent : '');
  };
  const employer = (value) => {
    const name = clean(typeof value === 'string' ? value : value && value.name);
    return PLATFORM_NAMES.test(name) ? '' : name;
  };

  const postings = [];
  for (const script of document.querySelectorAll('script[type="application/ld+json"]')) {
    let data;
    try { data = JSON.parse(script.textContent || ''); } catch (_) { continue; }
    const stack = [data];
    while (stack.length) {
      const node = stack.pop();
      if (!node || typeof node !== 'object') continue;
      if (Array.isArray(node)) { stack.push(...node); continue; }
      const type = node['@type'];
      if (type === 'JobPosting' || (Array.isArray(type) && type.includes('JobPosting'))) postings.push(node);
      if (node['@graph']) stack.push(node['@graph']);
    }
  }
  const structured = postings.find((posting) => posting && (posting.description || posting.title));
  if (structured) {
    return {
      source: 'structured',
      url: location.href,
      title: clean(structured.title).slice(0, 200),
      company: employer(structured.hiringOrganization).slice(0, 200),
      description: htmlToText(structured.description).slice(0, MAX_CHARS),
      looksLikeJob: true,
    };
  }

  const root = document.querySelector([
    '[data-automation-id="jobPostingDescription"]',
    '.jobs-description',
    '#job-details',
    '#jobDescriptionText',
    '.job-description',
    '[class*="job-description"]',
    '[class*="jobDescription"]',
    'main',
    'article',
    '[role="main"]',
  ].join(', ')) || document.body;
  const description = clean(root ? root.innerText : '').slice(0, MAX_CHARS);
  const heading = clean(document.querySelector('h1') && document.querySelector('h1').innerText);
  const siteName = document.querySelector('meta[property="og:site_name"]');
  // Greenhouse's current boards publish no structured data and no site name, but title the page
  // "Job Application for <role> at <Company>" and label the logo "<Company> Logo" (read on a live
  // posting, 2026-09-25).
  const titleAt = /\bat\s+([^|–—]+?)\s*$/i.exec(clean(document.title));
  const logo = document.querySelector('img[alt$=" logo" i]');
  const company = employer(siteName && siteName.getAttribute('content'))
    || employer(titleAt && titleAt[1])
    || employer(logo && logo.getAttribute('alt').replace(/\s+logo$/i, ''));
  // Two posting-shaped section words and enough text to be a posting, not a search page.
  const sectionHits = (description.match(/\b(responsibilities|qualifications|requirements|what you('|’)ll do|about the role|about you|experience with|preferred|benefits)\b/gi) || []).length;
  return {
    source: 'page',
    url: location.href,
    title: (heading || clean(document.title)).slice(0, 200),
    company: company.slice(0, 200),
    description,
    looksLikeJob: description.length >= 600 && sectionHits >= 2,
  };
}

const DECISIONS = {
  APPLY: { key: 'apply', label: 'Apply', tone: 'positive' },
  APPLY_WITH_STRATEGY: { key: 'apply_with_care', label: 'Apply with care', tone: 'brand' },
  FIX_THEN_APPLY: { key: 'fix_first', label: 'Fix first', tone: 'attention' },
  SKIP: { key: 'skip', label: 'Skip', tone: 'risk' },
};

// The same buttons, in the same order, as the web page's decisionActionsForDisplayDecision.
const ACTIONS = {
  apply: [
    { action: 'applied', label: 'Apply now', primary: true },
    { action: 'skipped', label: 'Skip anyway' },
  ],
  apply_with_care: [
    { action: 'applied', label: 'Apply, tailored', primary: true },
    { action: 'fixed', label: 'Fix first' },
    { action: 'skipped', label: 'Skip role' },
  ],
  fix_first: [
    { action: 'fixed', label: "I'll fix first", primary: true },
    { action: 'applied', label: 'Apply anyway' },
    { action: 'skipped', label: 'Skip role' },
  ],
  skip: [
    { action: 'skipped', label: 'Skip this role', primary: true },
    { action: 'applied', label: 'Apply anyway' },
  ],
};

function decisionFromLegacy(verdict, decision) {
  const legacy = String(decision || '').toLowerCase();
  if (legacy === 'apply_now') return DECISIONS.APPLY;
  if (legacy === 'apply_with_caveats') return DECISIONS.APPLY_WITH_STRATEGY;
  if (legacy === 'fix_first') return DECISIONS.FIX_THEN_APPLY;
  if (legacy === 'skip') return DECISIONS.SKIP;
  if (verdict === 'not_recommended') return DECISIONS.SKIP;
  if (verdict === 'risky') return DECISIONS.FIX_THEN_APPLY;
  if (verdict === 'potential_fit') return DECISIONS.APPLY_WITH_STRATEGY;
  if (verdict) return DECISIONS.APPLY;
  return null;
}

/**
 * The popup's view of one Apply Gate response: small enough to cache in chrome.storage, and made
 * only of what the backend said — no call is invented when it gave none.
 */
export function summarizeApplyGateResult(result) {
  if (!result || typeof result !== 'object') return null;
  if (result.insufficientProfile) {
    return {
      kind: 'needs_resume',
      message: String(result.insufficientProfileMessage || '').trim()
        || 'Apply Gate needs your résumé to check a role against it.',
    };
  }
  const explanation = result.explanation || {};
  const display = explanation.display_decision || null;
  const decision = (display && DECISIONS[display.action]) || decisionFromLegacy(result.verdict, explanation.decision);
  if (!decision) return { kind: 'unavailable' };

  const headline = String((display && display.headline) || '').trim() || decision.label;
  const subtext = String((display && display.subtext) || explanation.primary_reason || '').trim();
  const reasons = (Array.isArray(result.reasons) ? result.reasons : [])
    .map((reason) => String(reason || '').trim())
    .filter((reason) => reason && reason !== subtext && reason !== headline)
    .slice(0, 3);
  const resumeSource = result.resumeDocument && result.resumeDocument.source;

  return {
    kind: 'verdict',
    id: result.id || null,
    decision,
    headline,
    subtext,
    reasons,
    actions: ACTIONS[decision.key],
    jobTitle: result.jobTitle || null,
    companyName: result.companyName || null,
    usedDefaultResume: !resumeSource || resumeSource === 'default' || resumeSource === 'seeded_from_legacy',
  };
}

/** What the popup says after the user records a decision. */
export function describeRecordedAction(action) {
  if (action === 'applied') return 'Saved: you applied. Applendium will match the reply from your inbox.';
  if (action === 'fixed') return 'Saved: fixing first. Check it again once your résumé is updated.';
  if (action === 'skipped') return 'Saved: skipped. It counts toward what Apply Gate learns about your search.';
  return 'Saved.';
}

export const APPLY_GATE_LAST_CHECK_KEY = 'applendiumApplyGateLastCheck';
/** A cached check is shown again for the same posting for a day; after that it is re-run. */
export const APPLY_GATE_LAST_CHECK_TTL_MS = 24 * 60 * 60 * 1000;

/** Same posting, ignoring tracking parameters and fragments that change on every visit. */
export function samePostingUrl(a, b) {
  const normalize = (value) => {
    try {
      const url = new URL(String(value || ''));
      for (const key of [...url.searchParams.keys()]) {
        if (/^(utm_|ref|refId|trackingId|trk|src|source|gh_src|lever-source)/i.test(key)) url.searchParams.delete(key);
      }
      url.hash = '';
      return url.toString().replace(/\/$/, '');
    } catch (_) {
      return '';
    }
  };
  const left = normalize(a);
  return Boolean(left) && left === normalize(b);
}

/** "later today", "tomorrow", or "Tue, Sep 30" — when a free user's next weekly check opens. */
export function describeNextFreeCheck(nextAvailableAt, now = new Date()) {
  const at = new Date(nextAvailableAt || '');
  if (Number.isNaN(at.getTime())) return 'next week';
  const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(at) - startOfDay(now)) / 86_400_000);
  if (days <= 0) return 'later today';
  if (days === 1) return 'tomorrow';
  return at.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

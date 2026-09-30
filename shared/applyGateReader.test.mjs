// The popup's page reader, run against page shapes it has to get right.
//
//   node --test shared/applyGateReader.test.mjs
//
// jsdom lives in the web app's node_modules; the extension has no DOM test dependency of its own.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const jsdomPath = join(here, '..', '..', 'web', 'node_modules', 'jsdom');
const source = readFileSync(join(here, 'applyGateCheck.js'), 'utf8');
const { extractJobPostingFromPage } = await import(`data:text/javascript,${encodeURIComponent(source)}`);

const DESCRIPTION = `Job Summary
The office receptionist/intake coordinator plays a crucial role in the efficient operation of a
psychotherapy private practice by providing exceptional customer service to patients and visitors.
Responsibilities
Greet patients, answer phones, schedule appointments and manage intake paperwork for new clients.
Maintain accurate records in the practice management system and coordinate with clinicians daily.
Qualifications
High school diploma or equivalent. One year of front desk or medical office experience preferred.
Benefits
Paid time off. Full-time, Tuesday through Saturday. Pay is $22 to $27 an hour depending on experience,
with a quiet office, a small caring team and a supportive supervisor who trains every new hire.`;

function withPage(html, url, run) {
  const { JSDOM } = createRequire(import.meta.url)(jsdomPath);
  const dom = new JSDOM(html, { url });
  const { window } = dom;
  // jsdom has no layout, so no innerText; textContent is the same text for these fixtures.
  Object.defineProperty(window.HTMLElement.prototype, 'innerText', {
    get() { return this.textContent; },
  });
  const saved = {};
  for (const key of ['document', 'location', 'Node', 'DOMParser']) {
    saved[key] = globalThis[key];
    globalThis[key] = window[key];
  }
  try {
    return run();
  } finally {
    for (const [key, value] of Object.entries(saved)) globalThis[key] = value;
  }
}

test('Indeed feed with a job pane: the selected job, not the greeting or the other listings', { skip: !existsSync(jsdomPath) }, () => {
  // The founder's screenshot, 2026-09-29: the check came back titled "Welcome, Samantha" and
  // cited a certification from a different listing on the page.
  const html = `<html><head><title>Job Search | Indeed</title>
    <meta property="og:site_name" content="Indeed"></head><body><main>
    <h1>Welcome, Samantha</h1>
    <section class="feed">
      <div class="card"><h2>Dental Front Desk Receptionist</h2><p>Park Smiles West</p></div>
      <div class="card"><h2>Phlebotomist</h2><p>Phlebotomy certification required.</p></div>
    </section>
    <div class="pane">
      <div class="header"><h2>Medical Office Receptionist/Intake Coordinator-Tues-Sat</h2>
        <div>Nurture Your Nature Psychotherapy LCSW PC</div></div>
      <div id="jobDescriptionText">${DESCRIPTION}</div>
    </div></main></body></html>`;

  const posting = withPage(html, 'https://www.indeed.com/?vjk=c0fee8d7e654656c', extractJobPostingFromPage);

  assert.equal(posting.title, 'Medical Office Receptionist/Intake Coordinator-Tues-Sat');
  assert.match(posting.description, /psychotherapy private practice/);
  assert.doesNotMatch(posting.description, /Phlebotomy certification/);
  assert.doesNotMatch(posting.description, /Welcome, Samantha/);
  assert.equal(posting.looksLikeJob, true);
});

test("Indeed's named header wins when it is present", { skip: !existsSync(jsdomPath) }, () => {
  const html = `<html><head><title>Indeed</title></head><body>
    <h1>Welcome, Samantha</h1>
    <div><h2 data-testid="jobsearch-JobInfoHeader-title">Dental Front Desk Receptionist - job post</h2>
      <div data-testid="inlineHeader-companyName">Park Smiles West</div>
      <div id="jobDescriptionText">${DESCRIPTION}</div></div></body></html>`;

  const posting = withPage(html, 'https://www.indeed.com/viewjob?jk=1', extractJobPostingFromPage);

  assert.equal(posting.title, 'Dental Front Desk Receptionist');
  assert.equal(posting.company, 'Park Smiles West');
});

test('a single-posting page still takes its title from the page heading', { skip: !existsSync(jsdomPath) }, () => {
  const html = `<html><head><title>Job Application for QA Engineer at Acme</title></head><body>
    <h1>QA Engineer</h1><main>${DESCRIPTION}</main></body></html>`;

  const posting = withPage(html, 'https://boards.greenhouse.io/acme/jobs/1', extractJobPostingFromPage);

  assert.equal(posting.title, 'QA Engineer');
  assert.equal(posting.company, 'Acme');
});

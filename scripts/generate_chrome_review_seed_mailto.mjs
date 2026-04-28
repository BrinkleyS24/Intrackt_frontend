import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const projectRoot = path.resolve(path.dirname(__filename), '..');
const seedPath = path.join(projectRoot, 'chrome-store', 'reviewer-seed-emails.json');
const outputPath = path.join(projectRoot, 'chrome-store', 'reviewer-seed-mailto.html');

const reviewerEmail = (process.env.REVIEWER_GMAIL || process.argv[2] || '').trim();
const seedEmails = JSON.parse(fs.readFileSync(seedPath, 'utf8'));

if (!/^[^\s@]+@gmail\.com$/i.test(reviewerEmail)) {
  console.error('Set REVIEWER_GMAIL to the dedicated reviewer Gmail address, or pass it as the first argument.');
  console.error('Example: $env:REVIEWER_GMAIL = "applendiumreview@gmail.com"; npm run review:seed-drafts');
  process.exit(1);
}

function gmailComposeUrl({ subject, body }) {
  const params = new URLSearchParams({
    view: 'cm',
    fs: '1',
    to: reviewerEmail,
    su: subject,
    body,
  });
  return `https://mail.google.com/mail/?${params.toString()}`;
}

const links = seedEmails.map((email, index) => {
  const url = gmailComposeUrl(email);
  return `
    <li>
      <a href="${url}" target="_blank" rel="noopener noreferrer">
        ${index + 1}. [${email.category}] ${email.subject}
      </a>
      <div class="meta">${email.company} - ${email.position}</div>
    </li>`;
}).join('\n');

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Applendium Reviewer Gmail Seed Drafts</title>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.5; margin: 32px; color: #202124; }
    main { max-width: 760px; }
    code { background: #f1f3f4; padding: 2px 5px; border-radius: 4px; }
    li { margin: 14px 0; }
    a { color: #0b57d0; font-weight: 600; }
    .meta { color: #5f6368; font-size: 13px; }
    .warning { border-left: 4px solid #fbbc04; padding: 10px 14px; background: #fff8e1; }
  </style>
</head>
<body>
  <main>
    <h1>Applendium Reviewer Gmail Seed Drafts</h1>
    <p>Recipient reviewer Gmail account: <code>${reviewerEmail}</code></p>
    <div class="warning">
      Open these links while signed into a sender Gmail account that is <strong>not</strong> the reviewer account.
      Send all eight messages, then sign into Applendium with the reviewer account and run Refresh.
    </div>
    <ol>
      ${links}
    </ol>
  </main>
</body>
</html>
`;

fs.writeFileSync(outputPath, html);
console.log(`Wrote ${outputPath}`);
console.log(`Recipient: ${reviewerEmail}`);

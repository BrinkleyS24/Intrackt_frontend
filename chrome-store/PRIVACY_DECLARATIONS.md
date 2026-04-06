# Applendium Chrome Web Store Privacy Declarations

This file is the submission-side reference for the Chrome Web Store privacy fields. Verify the dashboard labels at submission time and keep them aligned with both the extension behavior and the public privacy policy.

## Manifest Permissions In Scope

- `identity`: Google sign-in and OAuth launch flow
- `storage`: cached popup state, auth state, quota state, and local extension settings
- `alarms`: background sync scheduling and watchdog alarms
- `notifications`: user-visible sync and classification notifications

## OAuth Scopes In Scope

- `openid`
- `email`
- `profile`
- `https://www.googleapis.com/auth/gmail.readonly`

## Data The Extension Uses

- Account identifiers:
  - Google email address
  - Firebase-authenticated user ID
  - basic profile fields needed for sign-in state
- Gmail-derived data:
  - message metadata
  - message content needed to identify and group job-application threads
- Derived application data:
  - company name
  - role name
  - lifecycle stage
  - timestamps
  - user corrections
- Operational data:
  - sync status
  - quota state
  - diagnostic information needed for support and reliability

## Dashboard Answer Direction

- Data is used to provide the extension's core job-tracking functionality.
- Data is not sold.
- Data is not used for advertising.
- Data is not used for creditworthiness decisions.
- Data handling in the Chrome Web Store privacy fields must match:
  - `https://applendium.com/privacy`
  - the shipped extension behavior
  - the manifest permissions and OAuth scopes

## Data Types To Review Carefully In The Dashboard

Use the dashboard labels that best map to the product's actual behavior. The main categories likely touched by this extension are:

- Personally identifiable information:
  - email address
  - user/account identifier
- Personal communications:
  - Gmail message content and metadata used for job-tracking classification
- App activity or product interaction data:
  - sync state
  - tracked application records
  - corrections or support-oriented diagnostics

Do not declare categories the extension does not use.

## Public URLs

- Privacy policy: `https://applendium.com/privacy`
- Support: `https://applendium.com/support`
- Premium status page: `https://applendium.com/upgrade`

## Official References

- Listing requirements: https://developer.chrome.com/docs/webstore/program-policies/listing-requirements
- Store listing fields: https://developer.chrome.com/docs/webstore/cws-dashboard-listing/
- Google Workspace user data policy: https://developers.google.com/workspace/workspace-api-user-data-developer-policy

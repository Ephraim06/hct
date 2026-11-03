# Happy Cape Tours

Static website for https://www.happycapetours.com/. The root HTML, assets and images can be served directly; no production Node server is required.

## Development

Use Node 22 or newer, then run:

```sh
npm ci
npm run build
npm run check
npm test
```

`npm run build` synchronizes the shared header, mobile navigation, footer and policy links from `templates/` into every page, then compiles Tailwind into `assets/tailwind.min.css`. Edit shared sections in the templates so the build preserves the changes. Page content remains in the individual HTML files. All core behavior lives in `assets/site.js`; common overrides and accessibility styles live in `assets/site.css`.

The generated CSS is committed so GitHub Pages can serve the site without a build integration. Run the build when changing Tailwind class names.

## Images

Original photos remain under `images/`. `npm run images` regenerates responsive WebP variants under `images/optimized/`, updates image markup and records dimensions in `assets/image-manifest.json`. Run `npm run build` and checks afterwards. Retain original images for future edits. Logos and favicons keep their original format.

## Enquiries

The contact form posts to `https://formspree.io/f/meaaveoz`. It supports native HTML POST without JavaScript. With JavaScript it sends FormData with an `Accept: application/json` header, disables repeat submission, handles delivery errors/timeouts and only clears fields after an accepted response. Enquiry content is not stored locally or logged to the console.

Every tour page links to the form with a `tour` query parameter. The value must match one of the tour options in `contact.html` to preselect it.

Tests simulate Formspree responses and never send external enquiries. Verify the Formspree account's recipient, activation, allowed domains and plan settings, then submit one real enquiry from the deployed site to confirm delivery. Changes here do not deploy automatically unless the repository's hosting integration does so after a push.

## Content to maintain

Keep tour prices, entry fees, pickup requirements and cancellation arrangements current. The booking-information page asks customers to confirm conditions before committing; it does not invent a universal refund policy. The privacy notice describes the implemented enquiry flow and third-party services. Unsupported numerical rating badges and obvious placeholder team profiles have been removed; verified business content and existing customer quotations are preserved.

Browser visual QA remains required for mobile/desktop layout and actual contrast. Automated checks cover local destinations, metadata, image variants, form fields and semantic landmarks. DOM tests cover enquiry success/failures, duplicate prevention, filters, gallery and menu behavior, and FAQ state.

## Node backend and gallery administration

Open `/admin.html` on a static host or `/admin` when using the Node server. The admin dashboard adapts the official shadcn/ui Sidebar-07 and its accessible Radix UI controls; it uses the site's gold, cream and navy palette.

New uploads are optimized to WebP, stored in the private Neon `assets` bucket and saved as drafts in Postgres. Captions, alternative text, categories, display order and publishing status can be edited. Only published uploads are readable by public visitors. Existing repository gallery photos remain visible; the admin dashboard manages new uploads.

```sh
npm run build
npm run typecheck
npm run check
npm test
npm start
npm run check:local
```

The Node server serves the website and `/api/*` locally on port 3000. It never serves `.env`, source code, dependencies or repository internals. The deployed Neon Function serves API requests; the existing static host continues to serve the public site and dashboard.

### Neon setup and activation

The selected project is `empty-term-22108704`, organization `org-ancient-brook-49888768`. Services are declared in `neon.ts`. `.neon` selects the current working branch; it and all credential files are ignored by Git.

The first administrator requested by the owner is `info@happycapetours.com`. Authorizing an email is separate from creating an account: the user chooses their own password on the admin page and verifies the emailed code. No password is embedded in code or committed. A new signup does not grant administrator privileges. The server checks the verified Neon Auth identity against `gallery_admins` on every admin request.

Development branch activation, once database changes are approved:

```sh
npx neon@latest checkout gallery-development
npm run migrate
npm run admin:grant -- info@happycapetours.com
npx neon@latest neon-auth domain add https://www.happycapetours.com
npx neon@latest neon-auth domain add https://happycapetours.com
npx neon@latest deploy
npm run test:integration
```

`test:integration` uses real Neon services on a non-production branch. It creates a disposable `.invalid` identity and image, tests sign-in/session/authorization/upload/publishing/download/sign-out, then removes only its own fixtures. It refuses to run on production. Test-only verification is set through the database for that disposable identity; the application has no verification bypass for real users.

After those checks pass:

```sh
npx neon@latest checkout production
npm run migrate
npm run admin:grant -- info@happycapetours.com
npx neon@latest neon-auth domain add https://www.happycapetours.com
npx neon@latest neon-auth domain add https://happycapetours.com
npx neon@latest deploy
npm run build
```

Deploy the root HTML, `assets/` and `images/` to the existing frontend host afterwards. `assets/backend-config.js` contains only the selected branch's public API and Auth URLs. Rebuild after switching branches; never publish a development build as production. Set `APP_API_URL=http://localhost:3000/api` before building when deliberately testing browser requests against the local API.

Production password-reset links need a configured custom SMTP sender in Neon Auth. Verification codes work with Neon's shared provider. Configure SMTP through Neon rather than adding sender credentials to browser code. Authentication UI handles loading/errors, verification and password recovery, but real email delivery and the administrator's first sign-in require the mailbox owner.

### Implementation status

Production activation is complete. The gallery schema and administrator grant for `info@happycapetours.com` were applied to development and production. Real Neon service integration tests passed on the isolated development branch, and read-only production checks passed for Postgres, storage, API health, authorization and trusted website origins. The frontend configuration has been rebuilt against production. The mailbox owner must create their account and verify its email code. The updated frontend has been published to GitHub Pages, and both website admin URLs have been verified. See `BACKEND-SETUP.md` for the validation record.

Signup is available at `http://localhost:3000/admin`, `https://www.happycapetours.com/admin.html`, and `https://happycapetours.com/admin.html`. Start the local server with `npm start`. Neon Auth allows localhost, and the API accepts exact localhost/loopback origins on IDE preview ports (including 5500 and 5173). Lookalike domains are rejected.

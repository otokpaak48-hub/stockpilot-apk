# Contributing to StockPilot

Thank you for contributing to StockPilot! This is a proprietary project owned by ObandeTechHub, but we welcome bug reports, feature suggestions, and pull requests from license-key holders.

## Reporting bugs

Open an issue at https://github.com/obandetechhub/stockpilot-apk/issues with:

1. **App version** (Settings → About)
2. **Android version** (Settings → About phone)
3. **Device model**
4. **Steps to reproduce**
5. **Expected vs. actual behavior**
6. **Screenshot or screen recording** (if applicable)
7. **Activity Log export** (Activity Log view → tap Export) — this helps us trace the issue through the audit trail

## Suggesting features

Open an issue with the `enhancement` label. Describe:
- The business problem you're trying to solve
- Your current workaround (if any)
- The proposed solution
- Whether this should be a Starter / Business / Premium feature

## Pull requests

PRs are welcome from contributors with an active StockPilot license. To submit:

1. Fork the repo
2. Create a branch: `git checkout -b feature/my-feature`
3. Make your changes — keep diffs focused (one feature per PR)
4. Test on at least one physical Android device
5. Ensure `npm run build` succeeds with no errors
6. Open a PR with a clear description + screenshots

### Code style

- TypeScript strict mode (enforced by tsconfig.json)
- ESLint + Next.js core-web-vitals config (`.eslintrc.json`)
- Prettier defaults (no config file — IDE defaults)
- Components: PascalCase, one per file
- Hooks: camelCase prefixed with `use-`
- lib files: kebab-case
- Tailwind for styling — no inline `style=` unless dynamic value

### Security considerations

- NEVER commit plaintext license keys, PINs, or tier upgrade keys — they live in `download/` which is gitignored
- NEVER commit `.env.local`, keystore files, or `keystore.properties`
- All user input must pass through Zod schemas (`lib/security.ts`)
- Sensitive DB writes must include hash-chained audit entries (`lib/audit-log.ts`)
- New API endpoints must include JWT auth + HMAC signature (`lib/sync-engine.ts → apiCall()`)

### Testing

This repo doesn't currently have automated tests (manual testing only). If you add a feature, please document the test steps in your PR description.

## License

By contributing, you agree that your contributions will be licensed under the proprietary StockPilot license (see [LICENSE](./LICENSE)). ObandeTechHub retains all commercial rights.

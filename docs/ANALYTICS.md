# Analytics

Administrators can open **Dashboard → Analytics** at `/dashboard/analytics`.
The page checks the signed-in account's existing `users.is_admin` flag in the
service layer before running any cross-tenant queries. Ordinary users receive a
404, and agent actors cannot call the reporting service, including agents owned
by administrators. No account is automatically promoted.

To enable an existing operator account, run this through your trusted database
administration connection:

```sql
UPDATE users SET is_admin = true WHERE lower(email) = lower('connor.lagana@gmail.com');
```

The 7/30/90-day selector controls signup cohorts and hosted-site traffic. Platform
inventory cards show current totals regardless of the selected period. Acquisition
sources come from existing first-touch signup attribution (`site:` referrals and
`utm:` campaigns); direct also includes unknown attribution. Activation rates use
signups as the denominator, not the previous milestone. Milestones are independent.
The operator command `pnpm admin funnel 30` uses the same calendar-day cohort.

Activation is reconstructed from retained site, connection and content records,
not an immutable event history. Deletion, unpublishing and republishing can change
these results. Newly registered users may not yet have had 24 hours to publish.

Traffic is for hosted sites, not the platform marketing pages. There is currently
no marketing-visitor denominator for visitor-to-signup conversion. Anonymous
visitor hashes rotate daily and are site-specific, so a person returning on
multiple days or visiting multiple sites is counted more than once. Traffic is
retained for 90 days. Historical traffic totals can include sites subsequently
deleted or suspended; the top-sites list shows currently available sites only.

Individual site analytics remain available under **Sites → site → Analytics**,
including daily traffic, top pages, source categories and referring domains.

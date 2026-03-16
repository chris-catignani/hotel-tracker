# https://developers.google.com/gemini-code-assist/docs/customize-gemini-behavior-github

- do not make comments that just say to add `data-testid` properties
- do not make comments that are not actionable (e.g. something is well structured, or well documented, or the change was required due to a change in that same PR elsewhere). UNLESS the comment is really important
- do not suggest changing `string | number` or `string | number | null` types to plain `number` or `number | null`. This is an intentional pattern throughout the codebase: Prisma `Decimal` fields serialize as strings in JSON API responses, so these mixed types are required. All call sites already wrap with `Number()` where arithmetic is needed.
- do not suggest moving display-formatting logic (such as `pruneHotelName`) inside shared components like `BookingCard`. These components are reused in multiple contexts (e.g. dashboard and bookings list) where different formatting behavior is needed. Applying transformations at the call site is intentional.

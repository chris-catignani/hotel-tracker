# https://developers.google.com/gemini-code-assist/docs/customize-gemini-behavior-github

- do not make comments that just say to add `data-testid` properties
- do not make comments that are not actionable (e.g. something is well structured, or well documented, or the change was required due to a change in that same PR elsewhere). UNLESS the comment is really important
- do not make comments about user auth security issues. We have not yet implemented auth. Once we do, we can start adding PR comments about it

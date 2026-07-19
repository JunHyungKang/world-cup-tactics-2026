# Benchmark basis

Adapted from `epoko77-ai/im-not-ai` at commit
`3120cb81e3b9910ba393cd8289864c583f0ac50a` (MIT License):

- preserve meaning, facts, numbers, names, quotations, and register;
- edit only diagnosed spans;
- flag translationese, mechanical parallelism, passive constructions,
  formulaic conclusions, excessive English, and decorative formatting;
- warn above a 30 percent change rate and reject above 50 percent;
- check the revised copy again for newly introduced artificial phrasing.

Project adaptations:

- claim-boundary preservation outranks stylistic smoothness;
- football terms may remain loanwords when they are the clearer Korean usage;
- official quotes, licenses, audit receipts, hashes, event IDs, and historical
  records are immutable;
- UI copy must stay synchronized with accessibility names, tests, captions,
  screenshots, planning PDF, and demo evidence.

Copyright (c) 2026 epoko77-ai. Used under the MIT License. Source:
https://github.com/epoko77-ai/im-not-ai

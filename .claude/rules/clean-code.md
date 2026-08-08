# Clean code

Write it like a careful human senior dev, not AI-generated. Before writing: does it need to exist? already in this repo (a `src/components/common/` component, a hook in `src/hooks/`, a util, a Radix primitive)? one line? Take the highest rung that works.

- No narrating comments; comment only non-obvious *why*. No defensive over-engineering. Match the surrounding file.
- Reuse before adding. No `any`. No dead code / debug spam.
- This project is graded on DRY/KISS/SOLID. That means *fewer* moving parts, not more layers — an interface with one implementation and no second caller coming is a finding, not architecture. The one abstraction that earns its keep is `NewsSource`, because there are genuinely four implementations with different capabilities.

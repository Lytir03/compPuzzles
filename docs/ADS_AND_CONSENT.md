# Advertising and consent guardrails

Advertising is disabled during public beta. `AdSlot` defines fixed, vendor-
neutral placement boundaries but injects no SDK and accepts no arbitrary HTML.
Production must use:

```text
ADS_ENABLED=false
ADS_PLACEHOLDERS_ENABLED=false
```

Developers can preview reserved geometry locally with
`ADS_PLACEHOLDERS_ENABLED=true`. Preview mode makes no network request.

## Approved placements

- Dashboard: banner between game cards and recent history.
- Leaderboard/profile: after a complete content section.
- Active ranked layout: non-sticky 160×600 side rail only at 1440px and wider,
  separated from the board/controls by 48px.
- Never on authentication screens, navigation, modals, keypad/control regions
  or above the result. Never show active-game ads on mobile.

Auto-ads, anchors, overlays and layout-shifting units are prohibited. An ad
must be labelled “Advertisement” and must not resemble a game control.

## Future enablement gate

Before adding an ad provider:

1. complete Italian legal/fiscal review and obtain the real publisher ID;
2. update Privacy/Cookie/Terms and the processor/transfer register;
3. integrate a Google-certified CMP using the current TCF requirement, with
   equally prominent Accept and Reject actions and a permanent preferences link;
4. keep contextual/non-personalised ads as the only allowed mode;
5. load no provider script, cookie or ad request before the required consent;
6. add exact CSP domains rather than wildcard sources and retest Turnstile,
   authentication and ranked play;
7. publish `ads.txt` only with the real publisher entry;
8. verify placements at mobile/tablet/desktop sizes and with assistive tech.

“Non-personalised” does not mean cookieless: consent requirements must be
re-evaluated against current Google and Italian Garante guidance at launch.

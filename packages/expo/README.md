# @formcoach/expo — deferred

Not implemented. Spec section 24 (open decision #4) explicitly leaves whether Expo ships
in the first release or a later milestone as an open product decision, and section 25's
recommended sequence builds native Android/iOS + React Native first, then adds Expo via
a config plugin once that core is stable.

When this is picked up, it should be a thin config plugin that:

- Installs the native Android/iOS dependencies `@formcoach/react-native` needs.
- Applies required native configuration (permissions, usage-description strings).
- Targets Expo **custom development builds** only — Expo Go cannot load the custom
  native modules this SDK requires (spec 8.3), and that limitation should be
  documented loudly, not discovered by a customer.

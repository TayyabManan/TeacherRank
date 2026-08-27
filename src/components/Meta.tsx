import React from 'react';
import { Helmet as HelmetBase, HelmetProps } from 'react-helmet-async';

/**
 * App-wide Helmet with `defer={false}`.
 *
 * react-helmet-async's default commits head changes inside a
 * requestAnimationFrame, and browsers never run rAF callbacks in hidden tabs —
 * so a profile opened in a background tab (ctrl+click, the natural
 * compare-teachers flow) kept index.html's generic title until focused, and
 * users couldn't tell their tabs apart. `defer={false}` applies synchronously.
 *
 * The prop only works on the EMITTING instance (verified by test: setting it
 * on the always-mounted template Helmet does nothing for page Helmets), so
 * every component must import Helmet from here, not from 'react-helmet-async'
 * — pageTitles.test.tsx enforces that.
 */
export function Helmet(props: HelmetProps & { children?: React.ReactNode }) {
  return <HelmetBase defer={false} {...props} />;
}

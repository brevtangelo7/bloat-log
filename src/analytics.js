import posthog from 'posthog-js';

let initialised = false;

export function initAnalytics() {
  const key = import.meta.env.VITE_POSTHOG_KEY;
  if (!key) {
    console.info('[bloat-log] Posthog key not set — analytics disabled.');
    return;
  }
  if (initialised) return;
  posthog.init(key, {
    api_host: 'https://us.i.posthog.com',
    person_profiles: 'identified_only',
    capture_pageview: true,
  });
  initialised = true;
}

export function identify(user, profile) {
  if (!initialised || !user) return;
  posthog.identify(user.id, {
    email: user.email,
    display_name: profile?.display_name || null,
  });
}

export function resetAnalytics() {
  if (!initialised) return;
  posthog.reset();
}

export function track(event, props = {}) {
  if (!initialised) return;
  posthog.capture(event, props);
}

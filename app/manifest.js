export default function manifest() {
  return {
    name: 'FitTrack — Your Personal Fitness Companion',
    short_name: 'FitTrack',
    description: 'Track workouts, nutrition, sleep, and progress. Reach your fitness goals.',
    start_url: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0a0a0f',
    theme_color: '#22d3ee',
    categories: ['health', 'fitness', 'lifestyle'],
    icons: [
      {
        src: '/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    screenshots: [],
  };
}

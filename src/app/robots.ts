import type { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/dashboard',
        '/admin',
        '/profile',
        '/projects/',
        '/share/', // Protege los enlaces compartidos públicos de ser indexados por Google
        '/api/',
      ],
    },
  };
}

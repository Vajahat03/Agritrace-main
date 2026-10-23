import { NextRequest, NextResponse } from 'next/server';

const NEWS_API_KEY = process.env.NEXT_PUBLIC_NEWS_API_KEY || 'de57c90197174eb9ac237be653a995ce';

const CURATED_TOPICS = [
  {
    title: 'Precision Drip Fertigation Yields 25% Boost for Indian Tomato & Onion Growers',
    description: 'Farmers adopting sensor-guided micro-irrigation and balanced water-soluble N-P-K schedules report substantial reduction in input costs and enhanced produce shelf life.',
    url: 'https://agricoop.nic.in/',
    urlToImage: 'https://images.unsplash.com/photo-1592982537447-7440770cbfc9?w=800&auto=format&fit=crop&q=80',
    publishedAt: new Date().toISOString(),
    source: { name: 'National Agriculture Bureau' },
    category: 'Technology & Irrigation',
  },
  {
    title: 'Kharif-Rabi APMC Mandi Arrivals: Price Trends Across Maharashtra & Karnataka',
    description: 'Analysis of wholesale market modal prices indicates strong demand for Grade-A uniform produce with verified post-harvest cooling and low transit bruising.',
    url: 'https://agmarknet.gov.in/',
    urlToImage: 'https://images.unsplash.com/photo-1618512496248-a07fe83aa8cb?w=800&auto=format&fit=crop&q=80',
    publishedAt: new Date().toISOString(),
    source: { name: 'APMC Market Monitor' },
    category: 'Market & Pricing',
  },
  {
    title: 'Biological Pest Management Protocols: Combating Fruit Borers and Early Blight',
    description: 'ICAR agronomy advisories encourage farmers to integrate Neem Seed Kernel Extract (NSKE 5%) and Trichoderma viride to minimize chemical pesticide residues for domestic and export mandis.',
    url: 'https://icar.org.in/',
    urlToImage: 'https://images.unsplash.com/photo-1592924357228-91a4daadcfea?w=800&auto=format&fit=crop&q=80',
    publishedAt: new Date().toISOString(),
    source: { name: 'ICAR Agronomy Research' },
    category: 'Crop Health & Pest Control',
  },
  {
    title: 'Decentralized Cold Storage Subsidies Announced for Smallholder Horticulture Clusters',
    description: 'New government schemes offer capital subsidies up to 50% for on-farm solar-powered cold rooms and active evaporative cooling storage for perishable vegetables.',
    url: 'https://nhb.gov.in/',
    urlToImage: 'https://images.unsplash.com/photo-1586771107445-d3ca888129ff?w=800&auto=format&fit=crop&q=80',
    publishedAt: new Date().toISOString(),
    source: { name: 'Horticulture Development Authority' },
    category: 'Schemes & Subsidies',
  },
  {
    title: 'Digital Traceability QR Codes Empower Direct Farmer-to-Vendor Contracts',
    description: 'Direct procurement platforms enable registered vendors to verify farm lot harvest dates, fertilizer logs, and AI freshness grades before dispatch.',
    url: 'https://agritrace.org/',
    urlToImage: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=800&auto=format&fit=crop&q=80',
    publishedAt: new Date().toISOString(),
    source: { name: 'AgriTrace Intelligence' },
    category: 'Supply Chain & Freshness',
  },
  {
    title: 'Post-Harvest Shelf Life Optimization for Leafy Vegetables and Grapes',
    description: 'Maintaining relative humidity above 90% and prompt pre-cooling curtails respiration rate by up to 35%, ensuring crispness upon market arrival.',
    url: 'https://icar.org.in/',
    urlToImage: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?w=800&auto=format&fit=crop&q=80',
    publishedAt: new Date().toISOString(),
    source: { name: 'Post-Harvest Scientific Review' },
    category: 'Harvest & Preservation',
  },
];

const INDIAN_NEWS_DOMAINS =
  'thehindubusinessline.com,thehindu.com,timesofindia.indiatimes.com,indianexpress.com,economictimes.indiatimes.com,livemint.com,financialexpress.com,krishijagran.com';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || searchParams.get('query') || 'agriculture OR farming OR crops OR harvest OR APMC';
  const category = searchParams.get('category');
  const pageSize = Number(searchParams.get('pageSize') || '12');

  try {
    // Ensure news is strictly scoped to Indian national agriculture & markets
    const hasIndiaContext =
      /india|indian|mandi|apmc|kisan|icar/i.test(query);
    const nationalQuery = hasIndiaContext
      ? query
      : `(${query}) AND (India OR Indian OR APMC OR Mandi OR Kisan OR ICAR)`;

    const searchTerm =
      category && category !== 'all' ? `(${nationalQuery}) AND (${category})` : nationalQuery;

    const url = `https://newsapi.org/v2/everything?q=${encodeURIComponent(
      searchTerm
    )}&domains=${INDIAN_NEWS_DOMAINS}&sortBy=publishedAt&language=en&pageSize=${pageSize}&apiKey=${NEWS_API_KEY}`;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'AgriTraceWeb/1.0',
      },
      next: { revalidate: 300 }, // Cache 5 min
    });

    if (res.ok) {
      const data = await res.json();
      if (data.status === 'ok' && data.articles?.length > 0) {
        const filtered = data.articles
          .filter((a: any) => a.title && !a.title.includes('[Removed]'))
          .map((a: any) => ({
            title: a.title,
            description: a.description || 'Full agricultural news analysis and farm report.',
            url: a.url,
            urlToImage: a.urlToImage || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=800&auto=format&fit=crop&q=80',
            publishedAt: a.publishedAt,
            source: a.source || { name: 'Agricultural Wire' },
            author: a.author || 'AgriTrace Desk',
            category: category || 'Farming Intelligence',
          }));

        if (filtered.length > 0) {
          return NextResponse.json({
            success: true,
            totalResults: filtered.length,
            articles: filtered,
          });
        }
      }
    }
  } catch (err) {
    console.warn('News API fetch failed, serving curated topics fallback:', err);
  }

  // Fallback to curated agricultural topics
  let results = CURATED_TOPICS;
  if (category && category !== 'all') {
    const catFiltered = CURATED_TOPICS.filter((t) =>
      t.category.toLowerCase().includes(category.toLowerCase())
    );
    if (catFiltered.length > 0) results = catFiltered;
  }

  return NextResponse.json({
    success: true,
    totalResults: results.length,
    articles: results,
  });
}

const Parser = require('rss-parser');
const fs = require('fs');
const path = require('path');

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'AWS-Cloud-News-Dashboard/1.0',
  },
});

const FEEDS = [
  { url: 'https://aws.amazon.com/about-aws/whats-new/recent/feed/', source: "AWS What's New" },
  { url: 'https://aws.amazon.com/blogs/aws/feed/', source: 'AWS News Blog' },
  { url: 'https://aws.amazon.com/blogs/architecture/feed/', source: 'AWS Architecture Blog' },
  { url: 'https://aws.amazon.com/blogs/security/feed/', source: 'AWS Security Blog' },
];

async function fetchFeed({ url, source }) {
  try {
    const feed = await parser.parseURL(url);
    return feed.items.map((item) => ({
      title: item.title ? item.title.trim() : 'Untitled',
      link: item.link || item.guid || '',
      pubDate: item.pubDate || item.isoDate || new Date().toISOString(),
      source,
    }));
  } catch (err) {
    console.warn(`[WARN] Failed to fetch feed "${source}" (${url}): ${err.message}`);
    return [];
  }
}

async function main() {
  console.log('Fetching AWS RSS feeds...');

  const results = await Promise.allSettled(FEEDS.map(fetchFeed));

  const allItems = results.flatMap((r) => (r.status === 'fulfilled' ? r.value : []));

  // Deduplicate by URL
  const seen = new Set();
  const unique = allItems.filter((item) => {
    if (!item.link || seen.has(item.link)) return false;
    seen.add(item.link);
    return true;
  });

  // Sort newest first
  unique.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));

  // Keep top 30
  const items = unique.slice(0, 30);

  const output = {
    lastUpdated: new Date().toISOString(),
    items,
  };

  const outputPath = path.join(__dirname, '..', 'news.json');
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2), 'utf8');

  console.log(`Done! Wrote ${items.length} items to news.json`);
  items.forEach((item, i) => {
    const date = new Date(item.pubDate).toLocaleDateString();
    console.log(`  [${i + 1}] [${item.source}] ${item.title.slice(0, 70)} (${date})`);
  });
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});

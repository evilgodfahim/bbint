const fs = require('fs');
const crypto = require('crypto');

const apiURLs = [
  "https://bonikbarta.com/api/post-lists/17?root_path=00000000010000000001",
  "https://bonikbarta.com/api/post-lists/18?root_path=00000000010000000001",
  "https://bonikbarta.com/api/post-lists/19?root_path=00000000010000000001",
  "https://bonikbarta.com/api/post-lists/20?root_path=00000000010000000001",
  "https://bonikbarta.com/api/post-lists/21?root_path=00000000010000000001",
  "https://bonikbarta.com/api/post-lists/22?root_path=00000000010000000001",
  "https://bonikbarta.com/api/post-lists/23?root_path=00000000010000000001"
];

const baseURL = "https://bonikbarta.com";
const siteURL = "https://bonikbarta.com";
const feedURL = "https://bonikbarta.com/feed.xml";

// Fetch all posts
async function fetchAll() {
  let allItems = [];

  for (let url of apiURLs) {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }
      });

      const text = await res.text();

      // Skip non-JSON responses
      if (!text.trim().startsWith('{')) {
        console.error("⚠️ Non-JSON response from", url);
        continue;
      }

      const data = JSON.parse(text);

      const items = (data.posts && Array.isArray(data.posts))
        ? data.posts
        : ((data.content && data.content.items) || []);

      allItems = allItems.concat(items);
    } catch (err) {
      console.error("❌ Failed to load from", url, err);
    }
  }

  // Sort by latest publish date
  allItems.sort((a, b) => new Date(b.first_published_at) - new Date(a.first_published_at));

  // Remove duplicates by link
  const seenLinks = new Set();
  const uniqueItems = [];
  for (const item of allItems) {
    const fullLink = (item.url_path || "").replace(/^\/home/, "");
    const normalizedLink = baseURL + fullLink;
    if (!seenLinks.has(normalizedLink)) {
      seenLinks.add(normalizedLink);
      uniqueItems.push(item);
    }
  }

  return uniqueItems;
}

// Generate GUID
function generateGUID(item) {
  const str = (item.title || '') + (item.excerpt || '') + (item.first_published_at || '');
  return crypto.createHash('md5').update(str).digest('hex');
}

// Generate RSS feed
function generateRSS(items) {
  const nowUTC = new Date().toUTCString();

  let rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>Bonikbarta Combined Feed</title>
    <link>${siteURL}</link>
    <atom:link href="${feedURL}" rel="self" type="application/rss+xml"/>
    <description>Latest articles from Bonikbarta</description>
    <language>bn</language>
    <lastBuildDate>${nowUTC}</lastBuildDate>
    <generator>GitHub Actions RSS Generator</generator>
`;

  items.forEach(item => {
    const fullLink = (item.url_path || "/").replace(/^\/home/, "");
    const articleUrl = baseURL + fullLink;
    const pubDate = item.first_published_at ? new Date(item.first_published_at).toUTCString() : nowUTC;
    const title = (item.title || "No title").replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const description = item.excerpt || item.summary || "No description available";
    const guid = generateGUID(item);

    rss += `    <item>
      <title>${title}</title>
      <link>${articleUrl}</link>
      <description><![CDATA[${description}]]></description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">${guid}</guid>
    </item>
`;
  });

  rss += '  </channel>\n</rss>';
  return rss;
}

// Main
(async () => {
  try {
    const items = await fetchAll();
    const rssContent = generateRSS(items.slice(0, 50)); // latest 50
    fs.writeFileSync('feed.xml', rssContent, { encoding: 'utf8' });
    console.log(`✅ RSS feed generated with ${items.length} unique articles.`);
  } catch (err) {
    console.error('❌ Error generating RSS:', err);
  }
})();

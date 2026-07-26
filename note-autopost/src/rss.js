import Parser from 'rss-parser';

const parser = new Parser({ timeout: 15000 });

export async function fetchFeed(rssUrl) {
    const feed = await parser.parseURL(rssUrl);
    return feed.items ?? [];
}

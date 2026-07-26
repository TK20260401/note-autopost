import { fetchFeed } from './rss.js';
import { loadPosted, savePosted } from './state.js';
import { buildXText, buildThreadsText } from './text.js';
import { postToX } from './x.js';
import { postToThreads } from './threads.js';

const RSS_URL = process.env.RSS_URL || 'https://note.com/YOUR_NOTE_ID/rss';

async function main() {
    const posted = await loadPosted();
    const items = await fetchFeed(RSS_URL);

  if (posted.size === 0 && process.env.INIT === '1') {
        items.forEach(function (i) { posted.add(i.link); });
        await savePosted(posted);
        console.log('Initialized: ' + posted.size + ' items marked as posted');
        return;
  }

  const fresh = items.filter(function (i) { return !posted.has(i.link); }).reverse();
    if (fresh.length === 0) {
          console.log('No new items');
          return;
    }

  for (const item of fresh) {
        let xId;
        try {
                xId = await postToX(buildXText(item));
                console.log('X posted OK: ' + item.title + ' (' + xId + ')');
        } catch (e) {
                console.error('X post failed: ' + item.title + ' - ' + e.message);
                continue;
        }
        try {
                const thId = await postToThreads(buildThreadsText(item));
                console.log('Threads posted OK: ' + item.title + ' (' + thId + ')');
        } catch (e) {
                console.error('Threads post failed (X already posted): ' + item.title + ' - ' + e.message);
        }
        posted.add(item.link);
        await savePosted(posted);
  }
}

main().catch(function (e) {
    console.error(e);
    process.exit(1);
});

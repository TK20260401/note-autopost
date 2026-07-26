import { TwitterApi } from 'twitter-api-v2';
function makeClient() {
    const { X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET } = process.env;
    if (!X_API_KEY || !X_API_SECRET || !X_ACCESS_TOKEN || !X_ACCESS_SECRET) {
          throw new Error('X auth credentials missing (environment variables)');
    }
    return new TwitterApi({
          appKey: X_API_KEY,
          appSecret: X_API_SECRET,
          accessToken: X_ACCESS_TOKEN,
          accessSecret: X_ACCESS_SECRET,
    });
}

export async function postToX(text) {
    const client = makeClient();
    const res = await client.v2.tweet(text);
    return res && res.data && res.data.id;
}

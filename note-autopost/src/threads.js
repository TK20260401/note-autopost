const GRAPH = 'https://graph.threads.net/v1.0';

export async function postToThreads(text) {
    const userId = process.env.THREADS_USER_ID;
    const token = process.env.THREADS_TOKEN;
    if (!userId || !token) {
          throw new Error('Threads auth credentials missing (environment variables)');
    }

  const createUrl = new URL(GRAPH + '/' + userId + '/threads');
    createUrl.searchParams.set('media_type', 'TEXT');
    createUrl.searchParams.set('text', text);
    createUrl.searchParams.set('access_token', token);

  const createRes = await fetch(createUrl, { method: 'POST' });
    if (!createRes.ok) {
          const errText = await createRes.text();
          throw new Error('Threads container creation failed: ' + createRes.status + ' ' + errText);
    }
    const createJson = await createRes.json();
    const creationId = createJson.id;

  await new Promise(function (resolve) { setTimeout(resolve, 3000); });

  const pubUrl = new URL(GRAPH + '/' + userId + '/threads_publish');
    pubUrl.searchParams.set('creation_id', creationId);
    pubUrl.searchParams.set('access_token', token);

  const pubRes = await fetch(pubUrl, { method: 'POST' });
    if (!pubRes.ok) {
          const errText2 = await pubRes.text();
          throw new Error('Threads publish failed: ' + pubRes.status + ' ' + errText2);
    }
    const pubJson = await pubRes.json();
    return pubJson.id;
}

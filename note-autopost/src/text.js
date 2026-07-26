const X_LIMIT = 280;
const THREADS_LIMIT = 500;

function buildBase(title, url, maxTitle) {
    const t = title.length > maxTitle ? title.slice(0, maxTitle - 1) + '…' : title;
    return `📝 新しい記事を公開しました\n\n「${t}」\n\n${url}\n\n#個人開発 #AIエンジニア #note`;
}

export function buildXText(item) {
    return buildBase(item.title, item.link, 80);
}

export function buildThreadsText(item) {
    return buildBase(item.title, item.link, 260);
}

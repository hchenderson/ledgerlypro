
import algoliasearch from 'algoliasearch/lite';

const appId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID;
const searchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY;
const indexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME;

if (!appId || !searchKey || !indexName) {
  if (process.env.NODE_ENV !== 'production') {
    console.warn('Algolia environment variables are not set. Search will not work.');
  }
}

export const searchClient = algoliasearch(appId || '', searchKey || '');
export const algoliaIndexName = indexName || '';

export const isAlgoliaConfigured = !!(appId && searchKey && indexName && searchKey !== 'PASTE_YOUR_SEARCH_ONLY_API_KEY_HERE');


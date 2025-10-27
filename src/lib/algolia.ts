
import algoliasearch from 'algoliasearch/lite';

export const algoliaAppId = process.env.NEXT_PUBLIC_ALGOLIA_APP_ID!;
export const algoliaSearchKey = process.env.NEXT_PUBLIC_ALGOLIA_SEARCH_KEY!;
export const algoliaIndexName = process.env.NEXT_PUBLIC_ALGOLIA_INDEX_NAME!;

export const isAlgoliaConfigured =
    Boolean(algoliaAppId && algoliaSearchKey && algoliaIndexName && algoliaSearchKey !== 'PASTE_YOUR_SEARCH_ONLY_API_KEY_HERE');

export const searchClient = isAlgoliaConfigured
    ? algoliasearch(algoliaAppId, algoliaSearchKey)
    : null;

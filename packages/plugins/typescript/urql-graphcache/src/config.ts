import { RawClientSideBasePluginConfig } from '@graphql-codegen/visitor-plugin-common';

/**
 * @description This plugin generates a generic for the `@urql/exchange-graphcache` (https://github.com/FormidableLabs/urql/exchanges/graphcache) config.
 */
export type UrqlGraphCacheConfig = RawClientSideBasePluginConfig & {
  offlineExchange?: boolean;
  /**
   * @description Optimize optimistic updater types based on actual field selections in mutations
   * @default false
   */
  optimizeOptimisticTypes?: boolean;
  /**
   * @description Module to import schema types (`Scalars`, `Maybe`, object types and field argument types) from, instead of expecting them in the same output file.
   */
  importSchemaTypesFrom?: string;
};

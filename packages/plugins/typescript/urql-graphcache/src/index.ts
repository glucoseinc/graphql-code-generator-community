import {
  FragmentDefinitionNode,
  GraphQLObjectType,
  GraphQLSchema,
  GraphQLType,
  GraphQLWrappingType,
  isEnumType,
  isInputObjectType,
  isInterfaceType,
  isListType,
  isNonNullType,
  isObjectType,
  isScalarType,
  isUnionType,
  isWrappingType,
  Kind,
  SelectionSetNode,
  TypeNode,
  visit,
} from 'graphql';
import { PluginFunction, Types } from '@graphql-codegen/plugin-helpers';
import { convertFactory, ConvertFn } from '@graphql-codegen/visitor-plugin-common';
import { UrqlGraphCacheConfig } from './config.js';

type GraphQLFlatType = Exclude<TypeNode, GraphQLWrappingType>;

const unwrapType = (type: null | undefined | TypeNode): GraphQLFlatType | null =>
  isWrappingType(type) ? unwrapType(type.ofType as any) : type || null;

const getObjectTypes = (schema: GraphQLSchema): GraphQLObjectType[] => {
  const typeMap = schema.getTypeMap();
  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  const subscriptionType = schema.getSubscriptionType();

  const objectTypes: GraphQLObjectType[] = [];

  for (const key in typeMap) {
    if (!typeMap[key] || !typeMap[key].name) continue;

    const type = typeMap[key];
    switch (type.name) {
      case '__Directive':
      case '__DirectiveLocation':
      case '__EnumValue':
      case '__InputValue':
      case '__Field':
      case '__Type':
      case '__TypeKind':
      case '__Schema':
        continue;
      default:
        if (!(type instanceof GraphQLObjectType)) continue;
    }

    if (type !== queryType && type !== mutationType && type !== subscriptionType) {
      objectTypes.push(type);
    }
  }

  return objectTypes;
};

function constructType(
  typeNode: GraphQLType,
  schema: GraphQLSchema,
  convertName: ConvertFn,
  config: UrqlGraphCacheConfig,
  nullable = true,
  allowString = false,
): string {
  if (isListType(typeNode)) {
    return nullable
      ? `Maybe<Array<${constructType(
          typeNode.ofType,
          schema,
          convertName,
          config,
          false,
          allowString,
        )}>>`
      : `Array<${constructType(typeNode.ofType, schema, convertName, config, false, allowString)}>`;
  }

  if (isNonNullType(typeNode)) {
    return constructType(typeNode.ofType, schema, convertName, config, false, allowString);
  }

  const type = schema.getType(typeNode.name);
  if (isScalarType(type)) {
    return nullable
      ? `Maybe<Scalars['${type.name}']['output']${allowString ? ' | string' : ''}>`
      : `Scalars['${type.name}']['output']${allowString ? ' | string' : ''}`;
  }

  const tsTypeName = convertName(typeNode.name, {
    prefix: config.typesPrefix,
    suffix: config.typesSuffix,
  });

  if (isUnionType(type) || isInputObjectType(type) || isObjectType(type)) {
    const finalType = `WithTypename<${tsTypeName}>${allowString ? ' | string' : ''}`;
    return nullable ? `Maybe<${finalType}>` : finalType;
  }

  if (isEnumType(type)) {
    const finalType = `${tsTypeName}${allowString ? ' | string' : ''}`;
    return nullable ? `Maybe<${finalType}>` : finalType;
  }

  if (isInterfaceType(type)) {
    const possibleTypes = schema.getPossibleTypes(type).map(possibleType => {
      const tsPossibleTypeName = convertName(possibleType.name, {
        prefix: config.typesPrefix,
        suffix: config.typesSuffix,
      });
      return `WithTypename<${tsPossibleTypeName}>`;
    });
    const finalType = allowString
      ? possibleTypes.join(' | ') + ' | string'
      : possibleTypes.join(' | ');
    return nullable ? `Maybe<${finalType}>` : finalType;
  }

  throw new Error(`Unhandled type ${type}`);
}

const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

function getKeysConfig(
  schema: GraphQLSchema,
  convertName: ConvertFn,
  config: UrqlGraphCacheConfig,
) {
  const keys = getObjectTypes(schema).reduce((keys, type) => {
    keys.push(
      `${type.name}?: (data: WithTypename<${convertName(type.name, {
        prefix: config.typesPrefix,
        suffix: config.typesSuffix,
      })}>) => null | string`,
    );
    return keys;
  }, [] as string[]);

  return 'export type GraphCacheKeysConfig = {\n  ' + keys.join(',\n  ') + '\n}';
}

function getResolversConfig(
  schema: GraphQLSchema,
  convertName: ConvertFn,
  config: UrqlGraphCacheConfig,
) {
  const objectTypes = [schema.getQueryType(), ...getObjectTypes(schema)];

  const resolvers = objectTypes.reduce((resolvers, parentType) => {
    if (parentType == null) return [];

    const fields = Object.entries(parentType.getFields()).reduce((fields, [fieldName, field]) => {
      const args = Object.entries(field.args);
      const argsName = args.length
        ? convertName(`${parentType.name}${capitalize(fieldName)}Args`, {
            prefix: config.typesPrefix,
            suffix: config.typesSuffix,
          })
        : 'Record<string, never>';
      fields.push(
        `${fieldName}?: GraphCacheResolver<WithTypename<` +
          `${convertName(parentType.name, {
            prefix: config.typesPrefix,
            suffix: config.typesSuffix,
          })}>, ${argsName}, ` +
          `${constructType(field.type, schema, convertName, config, false, true)}>`,
      );

      return fields;
    }, [] as string[]);

    resolvers.push(`  ${parentType.name}?: {\n    ` + fields.join(',\n    ') + '\n  }');

    return resolvers;
  }, [] as string[]);

  return resolvers;
}

function getRootUpdatersConfig(
  schema: GraphQLSchema,
  convertName: ConvertFn,
  config: UrqlGraphCacheConfig,
) {
  const [queryUpdaters, mutationUpdaters, subscriptionUpdaters] = [
    schema.getQueryType(),
    schema.getMutationType(),
    schema.getSubscriptionType(),
  ].map(rootType => {
    if (rootType) {
      const updaters: string[] = [];
      Object.values(rootType.getFields()).forEach(field => {
        const argsName = field.args.length
          ? convertName(`${rootType.name}${capitalize(field.name)}Args`, {
              prefix: config.typesPrefix,
              suffix: config.typesSuffix,
            })
          : 'Record<string, never>';

        updaters.push(
          `${field.name}?: GraphCacheUpdateResolver<{ ${field.name}: ${constructType(
            field.type,
            schema,
            convertName,
            config,
          )} }, ${argsName}>`,
        );
      });

      return updaters;
    }
    return null;
  });

  const typeUpdateResolvers = getObjectTypes(schema).reduce((resolvers, parentType) => {
    const fields = Object.entries(parentType.getFields()).reduce((fields, [fieldName, field]) => {
      const argsName = field.args.length
        ? convertName(`${parentType.name}${capitalize(fieldName)}Args`, {
            prefix: config.typesPrefix,
            suffix: config.typesSuffix,
          })
        : 'Record<string, never>';

      fields.push(
        `${field.name}?: GraphCacheUpdateResolver<${constructType(
          parentType,
          schema,
          convertName,
          config,
        )}, ${argsName}>`,
      );

      return fields;
    }, [] as string[]);

    resolvers.push(`  ${parentType.name}?: {\n    ` + fields.join(',\n    ') + '\n  }');

    return resolvers;
  }, [] as string[]);

  return {
    queryUpdaters,
    mutationUpdaters,
    subscriptionUpdaters,
    typeUpdateResolvers,
  };
}

interface MutationFieldSelection {
  mutationName: string;
  selectionSets: SelectionSetNode[];
}

const EMPTY_SELECTION_SET: SelectionSetNode = {
  kind: Kind.SELECTION_SET,
  selections: [],
};

/**
 * 選択セット内のフィールドを正規化します。
 * フィールドをスキーマ定義順でソートすることで、選択順序が異なっても同じ型として認識できるようにします。
 */
function normalizeSelectionSet(
  selectionSet: SelectionSetNode,
  schema: GraphQLSchema,
  baseTypeName: string,
): SelectionSetNode {
  const cleanTypeName = baseTypeName.replace(/WithTypename<|>/g, '').replace(/Maybe<|>/g, '');
  const baseType = schema.getType(cleanTypeName);

  if (!baseType || !isObjectType(baseType)) {
    return selectionSet;
  }

  const schemaFields = baseType.getFields();
  const fieldOrder = Object.keys(schemaFields);

  const normalizedSelections = [...selectionSet.selections]
    .filter(selection => selection.kind === 'Field')
    .sort((a, b) => {
      if (a.kind !== 'Field' || b.kind !== 'Field') return 0;

      const aIndex = fieldOrder.indexOf(a.name.value);
      const bIndex = fieldOrder.indexOf(b.name.value);

      // スキーマに定義されていないフィールドは末尾に
      if (aIndex === -1 && bIndex === -1) return 0;
      if (aIndex === -1) return 1;
      if (bIndex === -1) return -1;

      return aIndex - bIndex;
    })
    .map(selection => {
      if (selection.kind === 'Field' && selection.selectionSet) {
        // ネストした選択セットも再帰的に正規化
        let nestedTypeName = baseTypeName;
        const field = schemaFields[selection.name.value];
        if (field) {
          let unwrappedType = field.type;
          while (isNonNullType(unwrappedType) || isListType(unwrappedType)) {
            unwrappedType = unwrappedType.ofType;
          }
          if (isObjectType(unwrappedType)) {
            nestedTypeName = unwrappedType.name;
          }
        }

        return {
          ...selection,
          selectionSet: normalizeSelectionSet(selection.selectionSet, schema, nestedTypeName),
        };
      }
      return selection;
    });

  return {
    ...selectionSet,
    selections: normalizedSelections,
  };
}

/**
 * 選択セットから正規化されたキーを生成します。
 * このキーは選択フィールドの構造を表し、順序に依存しません。
 */
function getSelectionSetKey(
  selectionSet: SelectionSetNode,
  schema: GraphQLSchema,
  baseTypeName: string,
): string {
  const normalizedSet = normalizeSelectionSet(selectionSet, schema, baseTypeName);

  const fieldKeys = normalizedSet.selections
    .filter(selection => selection.kind === 'Field')
    .map(selection => {
      if (selection.kind !== 'Field') return '';

      const fieldName = selection.name.value;
      if (selection.selectionSet) {
        // ネストした型名を取得
        const cleanTypeName = baseTypeName.replace(/WithTypename<|>/g, '').replace(/Maybe<|>/g, '');
        const baseType = schema.getType(cleanTypeName);
        let nestedTypeName = baseTypeName;

        if (baseType && isObjectType(baseType)) {
          const field = baseType.getFields()[fieldName];
          if (field) {
            let unwrappedType = field.type;
            while (isNonNullType(unwrappedType) || isListType(unwrappedType)) {
              unwrappedType = unwrappedType.ofType;
            }
            if (isObjectType(unwrappedType)) {
              nestedTypeName = unwrappedType.name;
            }
          }
        }

        const nestedKey = getSelectionSetKey(selection.selectionSet, schema, nestedTypeName);
        return `${fieldName}{${nestedKey}}`;
      }
      return fieldName;
    })
    .join(',');

  return fieldKeys;
}

/**
 * GraphQLドキュメントからMutationの選択セットを抽出します。
 *
 * この関数は、プロジェクト内で使用されているすべてのMutationオペレーションを解析し、
 * 各Mutationフィールドで実際に選択されているフィールド（selectionSet）を取得します。
 * 同じMutationに対して複数の異なる選択セットがある場合、それらを配列として保持します。
 *
 * @example
 * ```graphql
 * mutation UpdateUserMutation($id: ID!, $name: String!) {
 *   updateUser(id: $id, name: $name) {
 *     id
 *     name
 *     profile {
 *       bio
 *     }
 *   }
 * }
 * ```
 *
 * 上記のクエリからは以下の情報が抽出されます：
 * - mutationName: "updateUser"
 * - selectionSets: [{ id, name, profile { bio } }] の構造
 *
 * @param documents - GraphQL Code Generatorから渡されるドキュメントファイルの配列
 * @returns Mutationフィールド名をキーとし、そのMutationの選択情報を値とするMap
 */
function extractMutationSelections(
  documents: Types.DocumentFile[],
): Map<string, MutationFieldSelection> {
  const mutationSelections = new Map<string, MutationFieldSelection>();

  documents.forEach(doc => {
    if (!doc.document) return;

    visit(doc.document, {
      OperationDefinition(node) {
        if (node.operation !== 'mutation') return;

        node.selectionSet.selections
          .filter(selection => selection.kind === 'Field')
          .forEach(selection => {
            const mutationName = selection.name.value;
            const currentSelectionSet = selection.selectionSet ?? EMPTY_SELECTION_SET;

            const existing = mutationSelections.get(mutationName);

            if (existing) {
              // 既存のMutationに新しい選択セットを追加
              existing.selectionSets.push(currentSelectionSet);
            } else {
              // 新しいMutationを追加
              mutationSelections.set(mutationName, {
                mutationName,
                selectionSets: [currentSelectionSet],
              });
            }
          });
      },
    });
  });

  return mutationSelections;
}

function buildOptimisticReturnType(
  selectionSet: SelectionSetNode,
  baseTypeName: string,
  schema: GraphQLSchema,
  convertName: ConvertFn,
  config: UrqlGraphCacheConfig,
): string {
  if (selectionSet.selections.length === 0) {
    return baseTypeName;
  }

  // 選択セットを正規化（フィールドをスキーマ定義順でソート）
  const normalizedSelectionSet = normalizeSelectionSet(selectionSet, schema, baseTypeName);
  const selectedFields: string[] = [];

  // GraphCacheでは常に__typenameが必要なので最初に追加
  selectedFields.push('__typename: string');

  normalizedSelectionSet.selections.forEach(selection => {
    if (selection.kind === 'Field') {
      const fieldName = selection.name.value;

      // __typenameは既に追加済みなのでスキップ
      if (fieldName === '__typename') {
        return;
      }

      // フィールドの型情報を取得
      const cleanTypeName = baseTypeName.replace(/WithTypename<|>/g, '').replace(/Maybe<|>/g, '');
      const baseType = schema.getType(cleanTypeName);
      if (baseType && isObjectType(baseType)) {
        const field = baseType.getFields()[fieldName];
        if (field) {
          const fieldType = constructType(field.type, schema, convertName, config, false);

          // ネストした選択がある場合は再帰的に処理
          if (selection.selectionSet) {
            let unwrappedType = field.type;
            // GraphQLの型をアンラップして実際の型を取得
            while (isNonNullType(unwrappedType) || isListType(unwrappedType)) {
              unwrappedType = unwrappedType.ofType;
            }

            if (isObjectType(unwrappedType)) {
              const nestedTypeName = convertName(unwrappedType.name, {
                prefix: config.typesPrefix,
                suffix: config.typesSuffix,
              });
              const optimizedNestedType = buildOptimisticReturnType(
                selection.selectionSet,
                `WithTypename<${nestedTypeName}>`,
                schema,
                convertName,
                config,
              );
              selectedFields.push(`${fieldName}: ${optimizedNestedType}`);
            } else {
              selectedFields.push(`${fieldName}: ${fieldType}`);
            }
          } else {
            selectedFields.push(`${fieldName}: ${fieldType}`);
          }
        }
      }
    }
  });

  if (selectedFields.length === 0) {
    return baseTypeName;
  }

  return `{ ${selectedFields.join(', ')} }`;
}

function buildOptimisticUnionType(
  selectionSets: SelectionSetNode[],
  baseTypeName: string,
  schema: GraphQLSchema,
  convertName: ConvertFn,
  config: UrqlGraphCacheConfig,
): string {
  if (selectionSets.length === 0) {
    return baseTypeName;
  }

  if (selectionSets.length === 1) {
    return buildOptimisticReturnType(selectionSets[0], baseTypeName, schema, convertName, config);
  }

  // 正規化されたキーを使用して重複する選択セットを除去
  const uniqueSelectionSets = new Map<string, SelectionSetNode>();

  selectionSets.forEach(selectionSet => {
    const key = getSelectionSetKey(selectionSet, schema, baseTypeName);
    if (!uniqueSelectionSets.has(key)) {
      uniqueSelectionSets.set(key, selectionSet);
    }
  });

  // 一意な選択セットから型を生成
  const types = Array.from(uniqueSelectionSets.values()).map(selectionSet =>
    buildOptimisticReturnType(selectionSet, baseTypeName, schema, convertName, config),
  );

  if (types.length === 1) {
    return types[0];
  }

  return types.map(type => `| ${type}`).join(' ');
}

function getOptimisticUpdatersConfig(
  schema: GraphQLSchema,
  documents: Types.DocumentFile[],
  convertName: ConvertFn,
  config: UrqlGraphCacheConfig,
): string[] | null {
  const mutationType = schema.getMutationType();
  if (!mutationType) return null;

  const optimistic: string[] = [];

  // 型の最適化が有効な場合のみMutation選択セットを抽出
  const mutationSelections = config.optimizeOptimisticTypes
    ? extractMutationSelections(documents)
    : new Map<string, MutationFieldSelection>();

  // すべてのMutationフィールドを処理
  Object.values(mutationType.getFields()).forEach(field => {
    const argsName = field.args.length
      ? convertName(`${capitalize(mutationType.name)}${capitalize(field.name)}Args`, {
          prefix: config.typesPrefix,
          suffix: config.typesSuffix,
        })
      : 'Record<string, never>';

    let outputType = constructType(field.type, schema, convertName, config);

    // 型の最適化が有効で、選択情報がある場合
    if (config.optimizeOptimisticTypes) {
      const selection = mutationSelections.get(field.name);

      if (selection && selection.selectionSets.length > 0) {
        let unwrappedType = field.type;
        // GraphQLの型をアンラップして実際の型を取得
        while (isNonNullType(unwrappedType) || isListType(unwrappedType)) {
          unwrappedType = unwrappedType.ofType;
        }

        if (isObjectType(unwrappedType)) {
          const baseTypeName = convertName(unwrappedType.name, {
            prefix: config.typesPrefix,
            suffix: config.typesSuffix,
          });

          const partialType = buildOptimisticUnionType(
            selection.selectionSets,
            `WithTypename<${baseTypeName}>`,
            schema,
            convertName,
            config,
          );

          // NonNullやListの包装を維持
          if (isNonNullType(field.type)) {
            if (isListType(field.type.ofType)) {
              outputType = `Array<${partialType}>`;
            } else {
              outputType = partialType;
            }
          } else if (isListType(field.type)) {
            outputType = `Maybe<Array<${partialType}>>`;
          } else {
            outputType = `Maybe<${partialType}>`;
          }
        }
      }
    }

    optimistic.push(
      `${field.name}?: GraphCacheOptimisticMutationResolver<` + `${argsName}, ` + `${outputType}>`,
    );
  });

  return optimistic.length > 0 ? optimistic : null;
}

function getImports(config: UrqlGraphCacheConfig): string {
  return `${config.useTypeImports ? 'import type' : 'import'} { ${
    config.offlineExchange ? 'offlineExchange' : 'cacheExchange'
  }, Resolver as GraphCacheResolver, UpdateResolver as GraphCacheUpdateResolver, OptimisticMutationResolver as GraphCacheOptimisticMutationResolver } from '@urql/exchange-graphcache';\n`;
}

export const plugin: PluginFunction<UrqlGraphCacheConfig, Types.ComplexPluginOutput> = (
  schema: GraphQLSchema,
  documents,
  config,
) => {
  const convertName = convertFactory(config);
  const imports = getImports(config);
  const keys = getKeysConfig(schema, convertName, config);
  const resolvers = getResolversConfig(schema, convertName, config);
  const { queryUpdaters, mutationUpdaters, subscriptionUpdaters, typeUpdateResolvers } =
    getRootUpdatersConfig(schema, convertName, config);
  const optimisticUpdaters = getOptimisticUpdatersConfig(schema, documents, convertName, config);

  const queryType = schema.getQueryType();
  const mutationType = schema.getMutationType();
  const subscriptionType = schema.getSubscriptionType();
  return {
    prepend: [imports],
    content: [
      `export type WithTypename<T extends { __typename?: ${config.defaultScalarType || 'any'} }> = Partial<T> & { __typename: NonNullable<T['__typename']> };`,

      keys,

      'export type GraphCacheResolvers = {\n' + resolvers.join(',\n') + '\n};',

      'export type GraphCacheOptimisticUpdaters = ' +
        (optimisticUpdaters ? '{\n  ' + optimisticUpdaters.join(',\n  ') + '\n};' : 'object;'),

      'export type GraphCacheUpdaters = {\n' +
        `  ${(queryType && queryType.name) || 'Mutation'}?: ` +
        (queryUpdaters ? `{\n    ${queryUpdaters.join(',\n    ')}\n  }` : 'object') +
        ',\n' +
        `  ${(mutationType && mutationType.name) || 'Mutation'}?: ` +
        (mutationUpdaters ? `{\n    ${mutationUpdaters.join(',\n    ')}\n  }` : 'object') +
        ',\n' +
        `  ${(subscriptionType && subscriptionType.name) || 'Subscription'}?: ` +
        (subscriptionUpdaters ? `{\n    ${subscriptionUpdaters.join(',\n    ')}\n  }` : 'object') +
        ',\n' +
        `${typeUpdateResolvers.join(',\n')}` +
        ',\n};',

      `export type GraphCacheConfig = Parameters<typeof ${
        config.offlineExchange ? 'offlineExchange' : 'cacheExchange'
      }>[0] & {\n` +
        '  updates?: GraphCacheUpdaters,\n' +
        '  keys?: GraphCacheKeysConfig,\n' +
        '  optimistic?: GraphCacheOptimisticUpdaters,\n' +
        '  resolvers?: GraphCacheResolvers,\n' +
        '};',
    ]
      .filter(Boolean)
      .join('\n\n'),
  };
};

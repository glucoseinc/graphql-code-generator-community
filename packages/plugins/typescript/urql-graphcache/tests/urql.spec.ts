import { buildSchema, parse } from 'graphql';
import { mergeOutputs } from '@graphql-codegen/plugin-helpers';
import '@graphql-codegen/testing';
import { plugin } from '../src/index.js';

describe('urql graphcache', () => {
  it('Should output the cache-generic correctly', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        todos: [Todo]
      }

      type Mutation {
        toggleTodo(id: ID!): Todo!
        toggleTodos(id: [ID!]!): [Todo!]!
        toggleTodosOptionalArray(id: [ID!]!): [Todo!]
        toggleTodosOptionalEntity(id: [ID!]!): [Todo]!
        toggleTodosOptional(id: [ID!]!): [Todo]
      }

      type Author {
        id: ID
        name: String
        friends: [Author]
        friendsPaginated(from: Int!, limit: Int!): [Author]
      }

      type Todo {
        id: ID
        text: String
        complete: Boolean
        author: Author
      }
    `);
    const result = mergeOutputs([await plugin(schema, [], {})]);
    expect(result).toMatchSnapshot();
  });

  it('Should output the cache-generic correctly (with unions)', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        media: [Media]
      }

      type Mutation {
        updateMedia(id: ID!): Media
      }

      union Media = Book | Movie

      type Book {
        id: ID
        title: String
        pages: Int
      }

      type Movie {
        id: ID
        title: String
        duration: Int
      }
    `);
    const result = mergeOutputs([await plugin(schema, [], {})]);
    expect(result).toMatchSnapshot();
  });

  it('Should output the cache-generic correctly (with interfaces)', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        schoolBooks: [CoolBook]
      }

      type Author {
        id: ID
        name: String
        friends: [Author]
        friendsPaginated(from: Int!, limit: Int!): [Author]
      }

      type Todo {
        id: ID
        text: String
        complete: Boolean
        author: Author
      }

      interface CoolBook {
        id: ID
        title: String
        author: Author
      }

      type Textbook implements CoolBook {
        id: ID
        title: String
        author: Author
        todo: Todo
      }
    `);
    const result = mergeOutputs([await plugin(schema, [], {})]);
    expect(result).toMatchSnapshot();
  });

  it('Should output the cache-generic correctly (with typesPrefix and typesSuffix)', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        todos: [Todo]
      }

      type Mutation {
        toggleTodo(id: ID!): Todo!
        toggleTodos(id: [ID!]!): [Todo!]!
        toggleTodosOptionalArray(id: [ID!]!): [Todo!]
        toggleTodosOptionalEntity(id: [ID!]!): [Todo]!
        toggleTodosOptional(id: [ID!]!): [Todo]
      }

      type Author {
        id: ID
        name: String
        friends: [Author]
        friendsPaginated(from: Int!, limit: Int!): [Author]
      }

      type Todo {
        id: ID
        text: String
        complete: Boolean
        author: Author
      }
    `);
    const result = mergeOutputs([
      await plugin(schema, [], { typesPrefix: 'Prefix', typesSuffix: 'Suffix' }),
    ]);
    expect(result).toMatchSnapshot();
  });

  it('should emit type imports if useTypeImports config value is used', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        todos: [Todo]
      }

      type Mutation {
        toggleTodo(id: ID!): Todo!
        toggleTodos(id: [ID!]!): [Todo!]!
        toggleTodosOptionalArray(id: [ID!]!): [Todo!]
        toggleTodosOptionalEntity(id: [ID!]!): [Todo]!
        toggleTodosOptional(id: [ID!]!): [Todo]
      }

      type Author {
        id: ID
        name: String
        friends: [Author]
        friendsPaginated(from: Int!, limit: Int!): [Author]
      }

      type Todo {
        id: ID
        text: String
        complete: Boolean
        author: Author
      }
    `);
    const result = mergeOutputs([await plugin(schema, [], { useTypeImports: true })]);

    expect(result).toBeSimilarStringTo(`\
import type { cacheExchange, Resolver as GraphCacheResolver, UpdateResolver as GraphCacheUpdateResolver, OptimisticMutationResolver as GraphCacheOptimisticMutationResolver } from '@urql/exchange-graphcache';
`);
  });

  it('should emit default scalar type if defaultScalarType config value is used', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        todos: [Todo]
      }

      type Mutation {
        toggleTodo(id: ID!): Todo!
        toggleTodos(id: [ID!]!): [Todo!]!
        toggleTodosOptionalArray(id: [ID!]!): [Todo!]
        toggleTodosOptionalEntity(id: [ID!]!): [Todo]!
        toggleTodosOptional(id: [ID!]!): [Todo]
      }

      type Author {
        id: ID
        name: String
        friends: [Author]
        friendsPaginated(from: Int!, limit: Int!): [Author]
      }

      type Todo {
        id: ID
        text: String
        complete: Boolean
        author: Author
      }
    `);
    const result = mergeOutputs([await plugin(schema, [], { defaultScalarType: 'unknown' })]);

    expect(result).toMatch(
      `export type WithTypename<T extends { __typename?: unknown }> = Partial<T> & { __typename: NonNullable<T['__typename']> };`,
    );
  });

  it('Should correctly name GraphCacheResolvers & GraphCacheOptimisticUpdaters with nonstandard mutationType names', async () => {
    const schema = buildSchema(/* GraphQL */ `
      schema {
        query: Query_Root
        mutation: Mutation_Root
      }

      type Query_Root {
        todos: [Todo]
      }

      type Mutation_Root {
        toggleTodo(id: ID!): Todo!
      }

      type Todo {
        id: ID
        text: String
        complete: Boolean
      }
    `);
    const result = mergeOutputs([await plugin(schema, [], {})]);
    expect(result).toMatchSnapshot();
  });

  it('Should correctly output GraphCacheOptimisticUpdaters when there are no mutations', async () => {
    const schema = buildSchema(/* GraphQL */ `
      schema {
        query: Query_Root
      }

      type Query_Root {
        todos: [Todo]
      }

      type Todo {
        id: ID
        text: String
        complete: Boolean
      }
    `);
    const result = mergeOutputs([await plugin(schema, [], {})]);
    expect(result).toMatchSnapshot();
  });

  it('Should optimize optimistic updater types based on actual field selections', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!, name: String!): User!
        createPost(title: String!, content: String!): Post!
      }

      type User {
        id: ID!
        name: String!
        profile: Profile
      }

      type Profile {
        bio: String
      }

      type Post {
        id: ID!
        title: String!
      }
    `);

    const updateUserMutation = parse(`
      mutation UpdateUserMutation($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          name
          profile {
            bio
          }
        }
      }
    `);

    const createPostMutation = parse(`
      mutation CreatePostMutation($title: String!, $content: String!) {
        createPost(title: $title, content: $content) {
          id
          title
        }
      }
    `);

    const documents = [
      { location: 'updateUser.graphql', document: updateUserMutation },
      { location: 'createPost.graphql', document: createPostMutation },
    ];

    const result = mergeOutputs([
      await plugin(schema, documents, { optimizeOptimisticTypes: true }),
    ]);

    expect(result).toContain(
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, { __typename: string, id: Scalars['ID'], name: Scalars['String'], profile: { __typename: string, bio: Scalars['String'] } }>",
    );
    expect(result).toContain(
      "createPost?: GraphCacheOptimisticMutationResolver<MutationCreatePostArgs, { __typename: string, id: Scalars['ID'], title: Scalars['String'] }>",
    );
  });

  it('Should use full types when optimizeOptimisticTypes is disabled', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!, name: String!): User!
      }

      type User {
        id: ID!
        name: String!
      }
    `);

    const updateUserMutation = parse(`
      mutation UpdateUserMutation($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          name
        }
      }
    `);

    const documents = [{ location: 'updateUser.graphql', document: updateUserMutation }];

    const result = mergeOutputs([
      await plugin(schema, documents, { optimizeOptimisticTypes: false }),
    ]);

    expect(result).toContain(
      'updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, WithTypename<User>>',
    );
  });

  it('Should handle mutations without documents when optimizeOptimisticTypes is enabled', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!, name: String!): User!
      }

      type User {
        id: ID!
        name: String!
      }
    `);

    const result = mergeOutputs([await plugin(schema, [], { optimizeOptimisticTypes: true })]);

    expect(result).toContain(
      'updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, WithTypename<User>>',
    );
  });

  it('Should handle multiple documents with different selections for the same mutation', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!, name: String!): User!
      }

      type User {
        id: ID!
        name: String!
        email: String!
        age: Int
        profile: Profile
      }

      type Profile {
        bio: String
        avatar: String
      }
    `);

    const updateUserMutation1 = parse(`
      mutation UpdateUserMutation1($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          name
        }
      }
    `);

    const updateUserMutation2 = parse(`
      mutation UpdateUserMutation2($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          email
          profile {
            bio
            avatar
          }
        }
      }
    `);

    const updateUserMutation3 = parse(`
      mutation UpdateUserMutation3($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          age
        }
      }
    `);

    const documents = [
      { location: 'updateUser1.graphql', document: updateUserMutation1 },
      { location: 'updateUser2.graphql', document: updateUserMutation2 },
      { location: 'updateUser3.graphql', document: updateUserMutation3 },
    ];

    const result = mergeOutputs([
      await plugin(schema, documents, { optimizeOptimisticTypes: true }),
    ]);

    expect(result).toContain(
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, | { __typename: string, id: Scalars['ID'], name: Scalars['String'] } | { __typename: string, id: Scalars['ID'], email: Scalars['String'], profile: { __typename: string, bio: Scalars['String'], avatar: Scalars['String'] } } | { __typename: string, id: Scalars['ID'], age: Scalars['Int'] }>",
    );
  });

  it('Should deduplicate identical selections from different documents for the same mutation', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!, name: String!): User!
      }

      type User {
        id: ID!
        name: String!
        email: String!
      }
    `);

    const updateUserMutation1 = parse(`
      mutation UpdateUserMutation1($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          name
        }
      }
    `);

    const updateUserMutation2 = parse(`
      mutation UpdateUserMutation2($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          name
        }
      }
    `);

    const updateUserMutation3 = parse(`
      mutation UpdateUserMutation3($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          email
        }
      }
    `);

    const documents = [
      { location: 'updateUser1.graphql', document: updateUserMutation1 },
      { location: 'updateUser2.graphql', document: updateUserMutation2 },
      { location: 'updateUser3.graphql', document: updateUserMutation3 },
    ];

    const result = mergeOutputs([
      await plugin(schema, documents, { optimizeOptimisticTypes: true }),
    ]);

    expect(result).toContain(
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, | { __typename: string, id: Scalars['ID'], name: Scalars['String'] } | { __typename: string, id: Scalars['ID'], email: Scalars['String'] }>",
    );
    expect(result).not.toContain(
      "| { __typename: string, id: Scalars['ID'], name: Scalars['String'] } | { __typename: string, id: Scalars['ID'], name: Scalars['String'] }",
    );
  });

  it('Should deduplicate selections with different field orders', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!, name: String!): User!
      }

      type User {
        id: ID!
        name: String!
      }
    `);

    const updateUserMutation1 = parse(`
      mutation UpdateUserMutation1($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          id
          name
        }
      }
    `);

    const updateUserMutation2 = parse(`
      mutation UpdateUserMutation2($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          name
          id
        }
      }
    `);

    const documents = [
      { location: 'updateUser1.graphql', document: updateUserMutation1 },
      { location: 'updateUser2.graphql', document: updateUserMutation2 },
    ];

    const result = mergeOutputs([
      await plugin(schema, documents, { optimizeOptimisticTypes: true }),
    ]);

    expect(result).toContain(
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, { __typename: string, id: Scalars['ID'], name: Scalars['String'] }>",
    );
    expect(result).not.toContain(
      "| { __typename: string, id: Scalars['ID'], name: Scalars['String'] } | { __typename: string, name: Scalars['String'], id: Scalars['ID'] }",
    );
  });

  it('Should handle field order normalization correctly', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!, name: String!): User!
      }

      type User {
        id: ID!
        name: String!
      }
    `);

    const documents = [
      {
        location: 'operations.graphql',
        document: parse(`
          mutation UpdateUserMutation1($id: ID!, $name: String!) {
            updateUser(id: $id, name: $name) {
              name
              id
            }
          }
        `),
      },
      {
        location: 'other.graphql',
        document: parse(`
          mutation UpdateUserMutation2($id: ID!, $name: String!) {
            updateUser(id: $id, name: $name) {
              id
              name
            }
          }
        `),
      },
    ];

    const result = await plugin(schema, documents, { optimizeOptimisticTypes: true });

    expect(result.content).toContain(
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, { __typename: string, id: Scalars['ID'], name: Scalars['String'] }>",
    );

    const optimisticUpdatersMatch = result.content.match(
      /export type GraphCacheOptimisticUpdaters = \{[^}]+\}/s,
    );
    expect(optimisticUpdatersMatch).toBeTruthy();
    expect(optimisticUpdatersMatch![0]).not.toContain('|');
  });
});

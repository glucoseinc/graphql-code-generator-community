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
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, { __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'], profile: Maybe<{ __typename: 'Profile', bio: Maybe<Scalars['String']['output']> }> }>",
    );
    expect(result).toContain(
      "createPost?: GraphCacheOptimisticMutationResolver<MutationCreatePostArgs, { __typename: 'Post', id: Scalars['ID']['output'], title: Scalars['String']['output'] }>",
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
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, | { __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'] } | { __typename: 'User', id: Scalars['ID']['output'], email: Scalars['String']['output'], profile: Maybe<{ __typename: 'Profile', bio: Maybe<Scalars['String']['output']>, avatar: Maybe<Scalars['String']['output']> }> } | { __typename: 'User', id: Scalars['ID']['output'], age: Maybe<Scalars['Int']['output']> }>",
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
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, | { __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'] } | { __typename: 'User', id: Scalars['ID']['output'], email: Scalars['String']['output'] }>",
    );
    expect(result).not.toContain(
      "| { __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'] } | { __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'] }",
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
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, { __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'] }>",
    );
    expect(result).not.toContain(
      "| { __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'] } | { __typename: 'User', name: Scalars['String']['output'], id: Scalars['ID']['output'] }",
    );
  });

  it('Should handle list type fields correctly in optimized types', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUserWithPosts(id: ID!): User!
        updateTeam(id: ID!): Team!
      }

      type User {
        id: ID!
        name: String!
        posts: [Post!]!
        tags: [String!]
        optionalPosts: [Post]
      }

      type Post {
        id: ID!
        title: String!
        content: String
      }

      type Team {
        id: ID!
        name: String!
        members: [User!]!
        projects: [String]
      }
    `);

    const updateUserMutation = parse(`
      mutation UpdateUserMutation($id: ID!) {
        updateUserWithPosts(id: $id) {
          id
          name
          posts {
            id
            title
          }
          tags
          optionalPosts {
            id
            content
          }
        }
      }
    `);

    const updateTeamMutation = parse(`
      mutation UpdateTeamMutation($id: ID!) {
        updateTeam(id: $id) {
          id
          name
          members {
            id
            name
          }
          projects
        }
      }
    `);

    const documents = [
      { location: 'updateUser.graphql', document: updateUserMutation },
      { location: 'updateTeam.graphql', document: updateTeamMutation },
    ];

    const result = mergeOutputs([
      await plugin(schema, documents, { optimizeOptimisticTypes: true }),
    ]);

    // Non-null list of non-null objects
    expect(result).toContain(
      "updateUserWithPosts?: GraphCacheOptimisticMutationResolver<MutationUpdateUserWithPostsArgs, { __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'], posts: Array<{ __typename: 'Post', id: Scalars['ID']['output'], title: Scalars['String']['output'] }>, tags: Maybe<Array<Scalars['String']['output']>>, optionalPosts: Maybe<Array<{ __typename: 'Post', id: Scalars['ID']['output'], content: Maybe<Scalars['String']['output']> }>> }>",
    );

    // Non-null list of non-null objects with nested selection
    expect(result).toContain(
      "updateTeam?: GraphCacheOptimisticMutationResolver<MutationUpdateTeamArgs, { __typename: 'Team', id: Scalars['ID']['output'], name: Scalars['String']['output'], members: Array<{ __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'] }>, projects: Maybe<Array<Scalars['String']['output']>> }>",
    );
  });

  it('Should handle nested list selections correctly', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateCompany(id: ID!): Company!
      }

      type Company {
        id: ID!
        name: String!
        departments: [Department!]!
      }

      type Department {
        id: ID!
        name: String!
        employees: [Employee]
        projects: [Project!]
      }

      type Employee {
        id: ID!
        name: String!
        skills: [String!]!
      }

      type Project {
        id: ID!
        title: String!
        tags: [String]
      }
    `);

    const updateCompanyMutation = parse(`
      mutation UpdateCompanyMutation($id: ID!) {
        updateCompany(id: $id) {
          id
          name
          departments {
            id
            name
            employees {
              id
              name
              skills
            }
            projects {
              id
              title
              tags
            }
          }
        }
      }
    `);

    const documents = [{ location: 'updateCompany.graphql', document: updateCompanyMutation }];

    const result = mergeOutputs([
      await plugin(schema, documents, { optimizeOptimisticTypes: true }),
    ]);

    // 深いネストのリスト型が正しく処理されることを確認
    expect(result).toContain(
      "updateCompany?: GraphCacheOptimisticMutationResolver<MutationUpdateCompanyArgs, { __typename: 'Company', id: Scalars['ID']['output'], name: Scalars['String']['output'], departments: Array<{ __typename: 'Department', id: Scalars['ID']['output'], name: Scalars['String']['output'], employees: Maybe<Array<{ __typename: 'Employee', id: Scalars['ID']['output'], name: Scalars['String']['output'], skills: Array<Scalars['String']['output']> }>>, projects: Maybe<Array<{ __typename: 'Project', id: Scalars['ID']['output'], title: Scalars['String']['output'], tags: Maybe<Array<Scalars['String']['output']>> }>> }> }>",
    );
  });

  it('Should handle union types in list fields correctly', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateFeed(id: ID!): Feed!
      }

      type Feed {
        id: ID!
        name: String!
        items: [FeedItem!]!
      }

      union FeedItem = Post | Video | Image

      type Post {
        id: ID!
        title: String!
        content: String
      }

      type Video {
        id: ID!
        title: String!
        duration: Int
      }

      type Image {
        id: ID!
        title: String!
        url: String!
      }
    `);

    const updateFeedMutation = parse(`
      mutation UpdateFeedMutation($id: ID!) {
        updateFeed(id: $id) {
          id
          name
          items {
            ... on Post {
              id
              title
              content
            }
            ... on Video {
              id
              title
              duration
            }
            ... on Image {
              id
              title
              url
            }
          }
        }
      }
    `);

    const documents = [{ location: 'updateFeed.graphql', document: updateFeedMutation }];

    const result = mergeOutputs([
      await plugin(schema, documents, { optimizeOptimisticTypes: true }),
    ]);

    // ユニオン型を含むリストが正しく処理されることを確認
    // 注意: この場合、ユニオン型の選択は現在の実装では完全に最適化されない可能性があります
    expect(result).toContain('items: Array<WithTypename<FeedItem>>');
  });

  it('Should use literal types for __typename fields', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!, name: String!): User!
        createPost(title: String!): Post!
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
      mutation CreatePostMutation($title: String!) {
        createPost(title: $title) {
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

    // __typename should be literal types, not string
    expect(result).toContain(
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, { __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'], profile: Maybe<{ __typename: 'Profile', bio: Maybe<Scalars['String']['output']> }> }>",
    );
    expect(result).toContain(
      "createPost?: GraphCacheOptimisticMutationResolver<MutationCreatePostArgs, { __typename: 'Post', id: Scalars['ID']['output'], title: Scalars['String']['output'] }>",
    );
  });

  it('Should handle fragments in mutation selections correctly', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!, name: String!): User!
        createPost(authorId: ID!, title: String!): Post!
      }

      type User {
        id: ID!
        name: String!
        email: String!
        profile: Profile
      }

      type Profile {
        bio: String
        avatar: String
        website: String
      }

      type Post {
        id: ID!
        title: String!
        content: String
        author: User!
      }
    `);

    const mutationWithFragments = parse(`
      fragment UserBasicInfo on User {
        id
        name
        email
      }

      fragment ProfileInfo on Profile {
        bio
        avatar
      }

      fragment PostInfo on Post {
        id
        title
        content
      }

      mutation UpdateUserMutation($id: ID!, $name: String!) {
        updateUser(id: $id, name: $name) {
          ...UserBasicInfo
          profile {
            ...ProfileInfo
            website
          }
        }
      }

      mutation CreatePostMutation($authorId: ID!, $title: String!) {
        createPost(authorId: $authorId, title: $title) {
          ...PostInfo
          author {
            ...UserBasicInfo
          }
        }
      }
    `);

    const documents = [{ location: 'mutations.graphql', document: mutationWithFragments }];

    const result = mergeOutputs([
      await plugin(schema, documents, { optimizeOptimisticTypes: true }),
    ]);

    // Fragmentが展開されて最適化された型が生成されることを確認
    expect(result).toContain(
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, { __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'], email: Scalars['String']['output'], profile: Maybe<{ __typename: 'Profile', bio: Maybe<Scalars['String']['output']>, avatar: Maybe<Scalars['String']['output']>, website: Maybe<Scalars['String']['output']> }> }>",
    );
    expect(result).toContain(
      "createPost?: GraphCacheOptimisticMutationResolver<MutationCreatePostArgs, { __typename: 'Post', id: Scalars['ID']['output'], title: Scalars['String']['output'], content: Maybe<Scalars['String']['output']>, author: { __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'], email: Scalars['String']['output'] } }>",
    );
  });

  it('Should handle inline fragments correctly', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!, role: String!): User!
      }

      interface User {
        id: ID!
        name: String!
        email: String!
      }

      type AdminUser implements User {
        id: ID!
        name: String!
        email: String!
        adminLevel: Int!
        permissions: [String!]!
      }

      type RegularUser implements User {
        id: ID!
        name: String!
        email: String!
        subscriptionLevel: String
      }
    `);

    const mutationWithInlineFragments = parse(`
      mutation UpdateUserMutation($id: ID!, $role: String!) {
        updateUser(id: $id, role: $role) {
          id
          name
          email
          ... on AdminUser {
            adminLevel
            permissions
          }
          ... on RegularUser {
            subscriptionLevel
          }
        }
      }
    `);

    const documents = [{ location: 'updateUser.graphql', document: mutationWithInlineFragments }];

    const result = mergeOutputs([
      await plugin(schema, documents, { optimizeOptimisticTypes: true }),
    ]);

    // インラインFragmentが正しく処理されることを確認
    expect(result).toContain(
      'updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs,',
    );
    // インラインFragmentの場合、実際に選択されているフィールドのみを含む最適化された型のユニオンが生成される
    expect(result).toContain(
      "{ __typename: 'AdminUser', id: Scalars['ID']['output'], name: Scalars['String']['output'], email: Scalars['String']['output'], adminLevel: Scalars['Int']['output'], permissions: Array<Scalars['String']['output']> } | { __typename: 'RegularUser', id: Scalars['ID']['output'], name: Scalars['String']['output'], email: Scalars['String']['output'], subscriptionLevel: Maybe<Scalars['String']['output']> }",
    );
  });

  it('Should handle nested fragments correctly', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateCompany(id: ID!): Company!
      }

      type Company {
        id: ID!
        name: String!
        departments: [Department!]!
      }

      type Department {
        id: ID!
        name: String!
        manager: Employee
        employees: [Employee!]!
      }

      type Employee {
        id: ID!
        name: String!
        email: String!
        position: String
        profile: EmployeeProfile
      }

      type EmployeeProfile {
        bio: String
        skills: [String!]!
        experience: Int
      }
    `);

    const mutationWithNestedFragments = parse(`
      fragment EmployeeProfileInfo on EmployeeProfile {
        bio
        skills
        experience
      }

      fragment EmployeeBasicInfo on Employee {
        id
        name
        email
        position
      }

      fragment EmployeeFullInfo on Employee {
        ...EmployeeBasicInfo
        profile {
          ...EmployeeProfileInfo
        }
      }

      fragment DepartmentInfo on Department {
        id
        name
        manager {
          ...EmployeeBasicInfo
        }
        employees {
          ...EmployeeFullInfo
        }
      }

      mutation UpdateCompanyMutation($id: ID!) {
        updateCompany(id: $id) {
          id
          name
          departments {
            ...DepartmentInfo
          }
        }
      }
    `);

    const documents = [
      { location: 'updateCompany.graphql', document: mutationWithNestedFragments },
    ];

    const result = mergeOutputs([
      await plugin(schema, documents, { optimizeOptimisticTypes: true }),
    ]);

    // ネストしたFragmentが正しく展開されて最適化された型が生成されることを確認
    expect(result).toContain(
      "updateCompany?: GraphCacheOptimisticMutationResolver<MutationUpdateCompanyArgs, { __typename: 'Company', id: Scalars['ID']['output'], name: Scalars['String']['output'], departments: Array<{ __typename: 'Department', id: Scalars['ID']['output'], name: Scalars['String']['output'], manager: Maybe<{ __typename: 'Employee', id: Scalars['ID']['output'], name: Scalars['String']['output'], email: Scalars['String']['output'], position: Maybe<Scalars['String']['output']> }>, employees: Array<{ __typename: 'Employee', id: Scalars['ID']['output'], name: Scalars['String']['output'], email: Scalars['String']['output'], position: Maybe<Scalars['String']['output']>, profile: Maybe<{ __typename: 'EmployeeProfile', bio: Maybe<Scalars['String']['output']>, skills: Array<Scalars['String']['output']>, experience: Maybe<Scalars['Int']['output']> }> }> }> }>",
    );
  });

  it('Should handle circular fragment references without stack overflow', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!): User!
      }

      type User {
        id: ID!
        name: String!
        friends: [User!]!
      }
    `);

    // 循環Fragment参照を含むクエリ
    const mutationWithCircularFragments = parse(`
      fragment UserInfo on User {
        id
        name
        friends {
          ...UserInfo
        }
      }

      mutation UpdateUserMutation($id: ID!) {
        updateUser(id: $id) {
          ...UserInfo
        }
      }
    `);

    const documents = [{ location: 'updateUser.graphql', document: mutationWithCircularFragments }];

    // スタックオーバーフローを起こさずに処理されることを確認
    const result = await plugin(schema, documents, { optimizeOptimisticTypes: true });
    expect(result).toBeDefined();
  });

  it('Should handle mutual circular fragment references without stack overflow', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!): User!
      }

      type User {
        id: ID!
        name: String!
        friends: [User!]!
        posts: [Post!]!
      }

      type Post {
        id: ID!
        title: String!
        author: User!
      }
    `);

    // 相互循環Fragment参照を含むクエリ（User ↔ Post ↔ User）
    const mutationWithMutualCircularFragments = parse(`
      fragment UserInfo on User {
        id
        name
        posts {
          ...PostInfo
        }
      }

      fragment PostInfo on Post {
        id
        title
        author {
          ...UserInfo
        }
      }

      mutation UpdateUserMutation($id: ID!) {
        updateUser(id: $id) {
          ...UserInfo
        }
      }
    `);

    const documents = [
      { location: 'updateUser.graphql', document: mutationWithMutualCircularFragments },
    ];

    // スタックオーバーフローを起こさずに処理されることを確認
    const result = await plugin(schema, documents, { optimizeOptimisticTypes: true });
    expect(result).toBeDefined();
    expect(result.content).toContain('updateUser?: GraphCacheOptimisticMutationResolver');
  });

  it('Should handle complex multi-fragment circular references', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateCompany(id: ID!): Company!
      }

      type Company {
        id: ID!
        name: String!
        departments: [Department!]!
      }

      type Department {
        id: ID!
        name: String!
        company: Company!
        employees: [Employee!]!
      }

      type Employee {
        id: ID!
        name: String!
        department: Department!
        colleagues: [Employee!]!
      }
    `);

    // 3つのFragmentが複雑に相互参照するクエリ（Company → Department → Employee → Department → Company）
    const mutationWithComplexCircularFragments = parse(`
      fragment CompanyInfo on Company {
        id
        name
        departments {
          ...DepartmentInfo
        }
      }

      fragment DepartmentInfo on Department {
        id
        name
        company {
          id
          name
        }
        employees {
          ...EmployeeInfo
        }
      }

      fragment EmployeeInfo on Employee {
        id
        name
        department {
          ...DepartmentInfo
        }
        colleagues {
          id
          name
          department {
            id
            name
          }
        }
      }

      mutation UpdateCompanyMutation($id: ID!) {
        updateCompany(id: $id) {
          ...CompanyInfo
        }
      }
    `);

    const documents = [
      { location: 'updateCompany.graphql', document: mutationWithComplexCircularFragments },
    ];

    // スタックオーバーフローを起こさずに処理されることを確認
    const result = await plugin(schema, documents, { optimizeOptimisticTypes: true });
    expect(result).toBeDefined();
    expect(result.content).toContain('updateCompany?: GraphCacheOptimisticMutationResolver');
  });

  it('Should not generate duplicate properties when fragments and direct fields overlap', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!, name: String!): User!
      }

      type User {
        id: ID!
        name: String!
        email: String!
        profile: Profile
      }

      type Profile {
        bio: String
        avatar: String
      }
    `);

    const documents = [
      {
        location: 'test-mutation.graphql',
        document: parse(/* GraphQL */ `
          fragment UserBasicInfo on User {
            id
            name
            email
          }

          mutation UpdateUserMutation($id: ID!, $name: String!) {
            updateUser(id: $id, name: $name) {
              ...UserBasicInfo
              id
              name
              profile {
                bio
              }
            }
          }
        `),
      },
    ];

    const result = await plugin(schema, documents, { optimizeOptimisticTypes: true });

    // 期待される型定義：重複するフィールドが統合されること
    expect(result.content).toContain(
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, { __typename: 'User', id: Scalars['ID']['output'], name: Scalars['String']['output'], email: Scalars['String']['output'], profile: Maybe<{ __typename: 'Profile', bio: Maybe<Scalars['String']['output']> }> }>",
    );
  });

  it('Should handle nested field deduplication correctly when fragments and direct fields overlap', async () => {
    const schema = buildSchema(/* GraphQL */ `
      type Mutation {
        updateUser(id: ID!): User!
      }

      type User {
        id: ID!
        profile: Profile
      }

      type Profile {
        bio: String
        avatar: String
      }
    `);

    const documents = [
      {
        location: 'test-nested-mutation.graphql',
        document: parse(/* GraphQL */ `
          fragment UserProfileInfo on User {
            profile {
              bio
              avatar
            }
          }

          mutation UpdateUserMutation($id: ID!) {
            updateUser(id: $id) {
              id
              ...UserProfileInfo
              profile {
                bio
              }
            }
          }
        `),
      },
    ];

    const result = await plugin(schema, documents, { optimizeOptimisticTypes: true });

    // 期待される型定義：ネストされたフィールドでもprofile.bioが重複せずに統合されること
    expect(result.content).toContain(
      "updateUser?: GraphCacheOptimisticMutationResolver<MutationUpdateUserArgs, { __typename: 'User', id: Scalars['ID']['output'], profile: Maybe<{ __typename: 'Profile', bio: Maybe<Scalars['String']['output']>, avatar: Maybe<Scalars['String']['output']> }> }>",
    );
  });

  describe('importSchemaTypesFrom', () => {
    const schema = buildSchema(/* GraphQL */ `
      type Query {
        todo(id: ID!): Todo
        node(id: ID!): Node
      }

      type Mutation {
        toggleTodo(id: ID!): Todo!
      }

      interface Node {
        id: ID!
      }

      type Todo implements Node {
        id: ID!
        text: String
        state: TodoState
      }

      enum TodoState {
        OPEN
        DONE
      }
    `);

    const documents = [
      {
        location: 'test.graphql',
        document: parse(/* GraphQL */ `
          mutation ToggleTodo($id: ID!) {
            toggleTodo(id: $id) {
              id
              text
            }
          }
        `),
      },
    ];

    it('Should import schema types from the given module and reference them through the namespace', async () => {
      const result = await plugin(schema, documents, {
        importSchemaTypesFrom: './schemaTypes',
      });

      expect(result.prepend?.join('')).toContain(
        "import type * as SchemaTypes from './schemaTypes';",
      );

      expect(result.content).toContain(
        'Todo?: (data: WithTypename<SchemaTypes.Todo>) => null | string',
      );
      expect(result.content).toContain(
        "text?: GraphCacheResolver<WithTypename<SchemaTypes.Todo>, Record<string, never>, SchemaTypes.Scalars['String']['output'] | string>",
      );
      expect(result.content).toContain(
        'todo?: GraphCacheUpdateResolver<{ todo: SchemaTypes.Maybe<WithTypename<SchemaTypes.Todo>> }, SchemaTypes.QueryTodoArgs>',
      );
      expect(result.content).toContain(
        'toggleTodo?: GraphCacheOptimisticMutationResolver<SchemaTypes.MutationToggleTodoArgs',
      );
      expect(result.content).toContain('WithTypename<SchemaTypes.Todo>');
    });

    it('Should keep __typename literals free of the namespace', async () => {
      const result = await plugin(schema, documents, {
        importSchemaTypesFrom: './schemaTypes',
        optimizeOptimisticTypes: true,
      });

      expect(result.content).toContain("{ __typename: 'Todo'");
      expect(result.content).not.toContain("__typename: 'SchemaTypes.");
    });

    it('Should not change the output when the option is omitted', async () => {
      const withOption = await plugin(schema, documents, {
        importSchemaTypesFrom: './schemaTypes',
        optimizeOptimisticTypes: true,
      });
      const withoutOption = await plugin(schema, documents, { optimizeOptimisticTypes: true });

      expect(withoutOption.prepend?.join('')).not.toContain('SchemaTypes');
      expect(withoutOption.content).not.toContain('SchemaTypes.');
      expect(withOption.content.replaceAll('SchemaTypes.', '')).toBe(withoutOption.content);
    });
  });
});

let fetch = require('node-fetch');
let ApolloClient = require('apollo-client').default;
let {InMemoryCache} = require('apollo-cache-inmemory');
let {HttpLink} = require('apollo-link-http');

const client = new ApolloClient({
  link: new HttpLink({
    uri: 'https://subgraph.swapliquidity.org/subgraphs/name/swapliquidity/subgraph',
    fetch: fetch
  }),
  cache: new InMemoryCache(),
  shouldBatch: true
});

const healthClient = new ApolloClient({
  link: new HttpLink({
    uri: 'https://subgraph.bscswap.com/index-node/graphql',
    fetch: fetch
  }),
  cache: new InMemoryCache(),
  shouldBatch: true
});

const blockClient = new ApolloClient({
  link: new HttpLink({
    uri: 'https://api.bscgraph.org/subgraphs/name/bsc-blocks',
    fetch: fetch
  }),
  cache: new InMemoryCache()
});

const relayClient = 'https://subgraph.swapliquidity.org/subgraphs/name/swapliquidity/limitorders';

const swapClient = 'https://subgraph.swapliquidity.org/subgraphs/name/swapliquidity/subgraph';

module.exports = {
  client,
  healthClient,
  blockClient,
  relayClient,
  swapClient
};
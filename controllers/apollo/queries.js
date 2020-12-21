const gql = require('graphql-tag');
const FACTORY_ADDRESS = '0x553990F2CBA90272390f62C5BDb1681fFc899675';
const BUNDLE_ID = '1';

const queries = {
    TOKEN_SEARCH: gql`
  query tokens($value: String, $id: String) {
    asSymbol: tokens(where: { symbol_contains: $value }, orderBy: totalLiquidity, orderDirection: desc) {
      id
      symbol
      name
      totalLiquidity
    }
  }
`,
    PAIR_SEARCH: gql`
query pairs($tokens: [Bytes]!, $id: String) {
  as0: pairs(where: { token0_in: $tokens }) {
    id
    token0 {
      id
      symbol
      name
    }
    token1 {
      id
      symbol
      name
    }
    volumeUSD
  }
  as1: pairs(where: { token1_in: $tokens }) {
    id
    token0 {
      id
      symbol
      name
    }
    token1 {
      id
      symbol
      name
    }
    volumeUSD
  }
}
`,
    GET_SWAP_TRANSACTIONS: gql`
  query($allPairs: [Bytes]!, $time_to: Int!) {
    swaps(first: 1000, where: {timestamp_lte: $time_to, pair_in: $allPairs}, orderBy: timestamp, orderDirection: desc) {
      id
      timestamp
      pair {
        id
        token0 {
          id
          symbol
        }
        token1 {
          id
          symbol
        }
      }
      amount0In
      amount0Out
      amount1In
      amount1Out
      amountUSD
      sender
      to
    }
  }
`,
    LIVE_SWAP_TRANSACTIONS: gql`
  query($allPairs: [Bytes]!, $time_from: Int!, $time_to: Int!) {
    swaps(first: 1000, where: {timestamp_gte: $time_from, timestamp_lte: $time_to, pair_in: $allPairs}, orderBy: timestamp, orderDirection: desc) {
      id
      timestamp
      pair {
        id
        token0 {
          id
          symbol
        }
        token1 {
          id
          symbol
        }
      }
      amount0In
      amount0Out
      amount1In
      amount1Out
      amountUSD
      sender
      to      
    }
  }
`,
  MARKET_ORDER_TRANSACTIONS: gql`
  query( $time_from: Int!) {
    swaps(first: 1000, where: {timestamp_gte: $time_from}, orderBy: timestamp) {
      id
      timestamp
      pair {
        id
        token0 {
          id
          symbol
        }
        token1 {
          id
          symbol
        }
      }
      amount0In
      amount0Out
      amount1In
      amount1Out
      amountUSD
      sender
      to      
    }
  }
`,
    FILTERED_TRANSACTIONS: gql`
  query($pairAddress: Bytes!, $time_from: Int!, $time_to: Int!) {
    swaps(first: 1000, where: { pair: $pairAddress, timestamp_gte: $time_from, timestamp_lte: $time_to }, orderBy: timestamp, orderDirection: desc) {
      id
      timestamp
      amount0In
      amount0Out
      amount1In
      amount1Out
      amountUSD      
    }
  }
`,

    GET_ORDERS_BOOK: `
query getOrdersFromBlock($$fromBlock: BigInt, $toBlock: BigInt) {
  orders(first: 2, where:{status:open}, orderBy: createdAt, orderDirection: desc) {
    id
    inputToken
    outputToken
    minReturn
    owner
    secret
    witness
    module
    inputAmount
    createdTxHash
    blockNumber
    cancelledTxHash
    executedTxHash    
    status
    createdAt
    updatedAt
  }
}
`,
GET_ORDERS_BOOK: `
query getOrdersFromBlock($$fromBlock: BigInt, $toBlock: BigInt) {
  orders(first: 2, where:{status:open}, orderBy: createdAt, orderDirection: desc) {
    id
    inputToken
    outputToken
    minReturn
    owner
    secret
    witness
    module
    inputAmount
    createdTxHash
    blockNumber
    cancelledTxHash
    executedTxHash    
    status
    createdAt
    updatedAt
  }
}
`,
GET_BLOCK: gql`
  query blocks($timestampFrom: Int!, $timestampTo: Int!) {
    blocks(
      first: 1
      orderBy: timestamp
      orderDirection: asc
      where: { timestamp_gt: $timestampFrom, timestamp_lt: $timestampTo }
    ) {
      id
      number
      timestamp
    }
  }
`,
};

module.exports = function () {
    return queries;
};


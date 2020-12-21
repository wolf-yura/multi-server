 const gql= require( 'graphql-tag')

//--- defination of constants ------//
const FACTORY_ADDRESS = '0x553990F2CBA90272390f62C5BDb1681fFc899675'
const BUNDLE_ID = '1'
const timeframeOptions = {
  WEEK: '1 week',
  MONTH: '1 month',
  // THREE_MONTHS: '3 months',
  // YEAR: '1 year',
  ALL_TIME: 'All time'
}

// token list urls to fetch tokens from - use for warnings on tokens and pairs
// const SUPPORTED_LIST_URLS__NO_ENS = [`${window.location.protocol}//${window.location.host}/tokens.json`]

// hide from overview list
const OVERVIEW_TOKEN_BLACKLIST = []

// pair blacklist
const PAIR_BLACKLIST = []

/**
 * For tokens that cause erros on fee calculations
 */
const FEE_WARNING_TOKENS = []


const PairFields =/* =() => {
    return  */`
    fragment PairFields on Pair {
      id
      txCount
      token0 {
        id
        symbol
        name
        totalLiquidity
        derivedBNB
      }
      token1 {
        id
        symbol
        name
        totalLiquidity
        derivedBNB
      }
      reserve0
      reserve1
      reserveUSD
      totalSupply
      trackedReserveBNB
      reserveBNB
      volumeUSD
      untrackedVolumeUSD
      token0Price
      token1Price
      createdAtTimestamp
    }
  `;
// }
const PAIR_DATA = (pairAddress, block) => {
  const queryString = `
    ${PairFields}
    query pairs {
      pairs(${block ? `block: {number: ${block}}` : ``} where: { id: "${pairAddress}"} ) {
        ...PairFields
      }
    }`
  return gql(queryString)
}

const PAIRS_BULK = gql`
  ${PairFields}
  query pairs($allPairs: [Bytes]!) {
    pairs(where: { id_in: $allPairs }, orderBy: trackedReserveBNB, orderDirection: desc) {
      ...PairFields
    }
  }
`;
const BNB_PRICE = block => {
    const queryString = block
      ? `
      query bundles {
        bundles(where: { id: ${BUNDLE_ID} } block: {number: ${block}}) {
          id
          bnbPrice
        }
      }
    `
      : ` query bundles {
        bundles(where: { id: ${BUNDLE_ID} }) {
          id
          bnbPrice
        }
      }
    `
    return gql(queryString)
  }
 const GLOBAL_DATA = block => {
    const queryString = ` query bscswapFactories {
        bscswapFactories(
         ${block ? `block: { number: ${block}}` : ``}
         where: { id: "${FACTORY_ADDRESS}" }) {
          id
          totalVolumeUSD
          totalVolumeBNB
          untrackedVolumeUSD
          totalLiquidityUSD
          totalLiquidityBNB
          txCount
          pairCount
        }
      }`
    return gql(queryString)
  }


  const PAIRS_HISTORICAL_BULK = (block, pairs) => {
    let pairsString = `[`
    pairs.map(pair => {
      return (pairsString += `"${pair}"`)
    })
    pairsString += ']'
    let queryString = `
    query pairs {
      pairs(first: 200, where: {id_in: ${pairsString}}, block: {number: ${block}}, orderBy: trackedReserveBNB, orderDirection: desc) {
        id
        reserveUSD
        trackedReserveBNB
        volumeUSD
        untrackedVolumeUSD
      }
    }
    `
    return gql(queryString)
  }

module.exports = {
    PairFields,
    PAIRS_BULK,
    BNB_PRICE,
    GLOBAL_DATA,
    PAIRS_BULK,
    PAIR_DATA,
    PAIRS_HISTORICAL_BULK
}
const {PairFields, PAIRS_BULK, BNB_PRICE, GLOBAL_DATA} = require('./globalQuery');
const dayjs = require('dayjs');
const {getBlockFromTimestamp, getBlocksFromTimestamps, getPercentChange, get2DayPercentChange} = require('./index');
let utc = require('dayjs/plugin/utc')
let { client, blockClient } =require('../apollo/client');
let queries = require( '../apollo/queries')
let gql = require('graphql-tag');
const { models } = require('mongoose');

/**
 * Gets the current price  of BNB, 24 hour price, and % change between them
 */
const getBnbPrice = async () => {
    const utcCurrentTime = dayjs()
    const utcOneDayBack = utcCurrentTime
      .subtract(1, 'day')
      .startOf('minute')
      .unix()
  
    let bnbPrice = 0
    let bnbPriceOneDay = 0
    let priceChangeBNB = 0
  
    try {
      let oneDayBlock = await getBlockFromTimestamp(utcOneDayBack)
      let result = await client.query({
        query: BNB_PRICE(),
        fetchPolicy: 'cache-first'
      })
      
      let resultOneDay = await client.query({
        query: BNB_PRICE(oneDayBlock),
        fetchPolicy: 'cache-first'
      })
      const currentPrice = result?.data?.bundles[0]?.bnbPrice
      const oneDayBackPrice = resultOneDay?.data?.bundles[0]?.bnbPrice
      priceChangeBNB = getPercentChange(currentPrice, oneDayBackPrice)
      bnbPrice = currentPrice
      bnbPriceOneDay = oneDayBackPrice
    } catch (e) {
      console.log(e)
    }
  
    return [bnbPrice, bnbPriceOneDay, priceChangeBNB]
  }

  async function getGlobalData()
  {
    let [newPrice, oneDayPrice, priceChange] = await getBnbPrice();    
    let data = {}
    let oneDayData = {}
    let twoDayData = {}

    try {
        // get timestamps for the days
        const utcCurrentTime = dayjs()
        const utcOneDayBack = utcCurrentTime.subtract(1, 'day').unix()
        const utcTwoDaysBack = utcCurrentTime.subtract(2, 'day').unix()
        const utcOneWeekBack = utcCurrentTime.subtract(1, 'week').unix()
        const utcTwoWeeksBack = utcCurrentTime.subtract(2, 'week').unix()

        // get the blocks needed for time travel queries
        let [oneDayBlock, twoDayBlock, oneWeekBlock, twoWeekBlock] = await getBlocksFromTimestamps([
        utcOneDayBack,
        utcTwoDaysBack,
        utcOneWeekBack,
        utcTwoWeeksBack
        ])

        // fetch the global data
        let result = await client.query({
        query: GLOBAL_DATA(),
        fetchPolicy: 'cache-first'
        })
        data = result.data.bscswapFactories[0]

        // fetch the historical data
        let oneDayResult = await client.query({
        query: GLOBAL_DATA(oneDayBlock?.number),
        fetchPolicy: 'cache-first'
        })
        oneDayData = oneDayResult.data.bscswapFactories[0]

        let twoDayResult = await client.query({
        query: GLOBAL_DATA(twoDayBlock?.number),
        fetchPolicy: 'cache-first'
        })
        twoDayData = twoDayResult.data.bscswapFactories[0]

        let oneWeekResult = await client.query({
        query: GLOBAL_DATA(oneWeekBlock?.number),
        fetchPolicy: 'cache-first'
        })
        const oneWeekData = oneWeekResult.data.bscswapFactories[0]

        let twoWeekResult = await client.query({
        query: GLOBAL_DATA(twoWeekBlock?.number),
        fetchPolicy: 'cache-first'
        })
        const twoWeekData = twoWeekResult.data.bscswapFactories[0]

        if (data && oneDayData && twoDayData) {
        let [oneDayVolumeUSD, volumeChangeUSD] = get2DayPercentChange(
            data.totalVolumeUSD,
            oneDayData.totalVolumeUSD ? oneDayData.totalVolumeUSD : 0,
            twoDayData.totalVolumeUSD ? twoDayData.totalVolumeUSD : 0
        )

        const [oneDayTxns, txnChange] = get2DayPercentChange(
            data.txCount,
            oneDayData.txCount ? oneDayData.txCount : 0,
            twoDayData.txCount ? twoDayData.txCount : 0
        )

        // format the total liquidity in USD
        data.totalLiquidityUSD = data.totalLiquidityBNB * newPrice
        const liquidityChangeUSD = getPercentChange(
            data.totalLiquidityBNB * newPrice,
            oneDayData.totalLiquidityBNB * oneDayPrice
        )

        // add relevant fields with the calculated amounts
        data.oneDayVolumeUSD = oneDayVolumeUSD
        data.volumeChangeUSD = volumeChangeUSD
        data.liquidityChangeUSD = liquidityChangeUSD
        data.oneDayTxns = oneDayTxns
        data.txnChange = txnChange

        // add two-week data if we're at least two-weeks old
        if (twoWeekData) {
            const [oneWeekVolume, weeklyVolumeChange] = get2DayPercentChange(
            data.totalVolumeUSD,
            oneWeekData.totalVolumeUSD,
            twoWeekData.totalVolumeUSD
            )

            data.oneWeekVolume = oneWeekVolume
            data.weeklyVolumeChange = weeklyVolumeChange
        }
        }
    } catch (e) {
        console.log(e)
    }

    return data
  }



  module.exports = {
      getBnbPrice,
      getGlobalData
  }
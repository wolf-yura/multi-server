// import { BigNumber } from 'bignumber.js'
let BigNumber = require('big-number');
let dayjs = require('dayjs');
let ethers = require('ethers');
let utc = require('dayjs/plugin/utc')
let { client, blockClient } =require('../apollo/client');
let queries = require( '../apollo/queries')
let gql = require('graphql-tag')
// import _Decimal from 'decimal.js-light'
// import toFormat from 'toformat'
// import { timeframeOptions } from '../constants'
// import Numeral from 'numeral'

// format libraries
// const Decimal = toFormat(_Decimal)
// BigNumber.set({ EXPONENTIAL_AT: 50 })
dayjs.extend(utc)
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

const GET_BLOCKS = timestamps => {
  let queryString = 'query blocks {'
  queryString += timestamps.map(timestamp => {
    return `t${timestamp}:blocks(first: 1, orderBy: timestamp, orderDirection: desc, where: { timestamp_gt: ${timestamp}, timestamp_lt: ${timestamp +
      600} }) {  number }`
  })
  queryString += '}'
  return gql(queryString)
}

const GET_BLOCK = gql`
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
`
function getTimeframe(timeWindow) {
  const utcEndTime = dayjs.utc()
  // based on window, get starttime
  let utcStartTime
  switch (timeWindow) {
    case timeframeOptions.WEEK:
      utcStartTime =
        utcEndTime
          .subtract(1, 'week')
          .endOf('day')
          .unix() - 1
      break
    case timeframeOptions.MONTH:
      utcStartTime =
        utcEndTime
          .subtract(1, 'month')
          .endOf('day')
          .unix() - 1
      break
    case timeframeOptions.ALL_TIME:
      utcStartTime =
        utcEndTime
          .subtract(1, 'year')
          .endOf('day')
          .unix() - 1
      break
    default:
      utcStartTime =
        utcEndTime
          .subtract(1, 'year')
          .startOf('year')
          .unix() - 1
      break
  }
  return utcStartTime
}

function getPoolLink(token0Address, token1Address = null, remove = false) {
  if (!token1Address) {
    return (
      `https://swapliquidity.org/#/` +
      (remove ? `remove` : `add`) +
      `/${token0Address === '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' ? 'BNB' : token0Address}/${'BNB'}`
    )
  } else {
    return (
      `https://swapliquidity.org/#/` +
      (remove ? `remove` : `add`) +
      `/${token0Address === '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' ? 'BNB' : token0Address}/${token1Address === '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' ? 'BNB' : token1Address
      }`
    )
  }
}

function getSwapLink(token0Address, token1Address = null) {
  if (!token1Address) {
    return `https://swapliquidity.org/#/swap?inputCurrency=${token0Address}`
  } else {
    return `https://swapliquidity.org/#/swap?inputCurrency=${token0Address === '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' ? 'BNB' : token0Address
      }&outputCurrency=${token1Address === '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c' ? 'BNB' : token1Address}`
  }
}

function localNumber(val) {
  return Numeral(val).format('0,0')
}

const toNiceDate = date => {
  let x = dayjs.utc(dayjs.unix(date)).format('MMM DD')
  return x
}

const toWeeklyDate = date => {
  const formatted = dayjs.utc(dayjs.unix(date))
  date = new Date(formatted)
  const day = new Date(formatted).getDay()
  var lessDays = day === 6 ? 0 : day + 1
  var wkStart = new Date(new Date(date).setDate(date.getDate() - lessDays))
  var wkEnd = new Date(new Date(wkStart).setDate(wkStart.getDate() + 6))
  return dayjs.utc(wkStart).format('MMM DD') + ' - ' + dayjs.utc(wkEnd).format('MMM DD')
}

function getTimestampsForChanges() {
  const utcCurrentTime = dayjs()
  const t1 = utcCurrentTime
    .subtract(1, 'day')
    .startOf('minute')
    .unix()
  const t2 = utcCurrentTime
    .subtract(2, 'day')
    .startOf('minute')
    .unix()
  const tWeek = utcCurrentTime
    .subtract(1, 'week')
    .startOf('minute')
    .unix()
  return [t1, t2, tWeek]
}

async function splitQuery(query, localClient, vars, list, skipCount = 100) {
  let fetchedData = {}
  let allFound = false
  let skip = 0

  while (!allFound) {
    let end = list.length
    if (skip + skipCount < list.length) {
      end = skip + skipCount
    }
    let sliced = list.slice(skip, end)
    let query1 = query(...vars, sliced)    
    
    let result = await localClient.query({
      query: query1,
      fetchPolicy: 'cache-first'
    })
    fetchedData = {
      ...fetchedData,
      ...result.data
    }
    if (Object.keys(result.data).length < skipCount || skip + skipCount > list.length) {
      allFound = true
    } else {
      skip += skipCount
    }
  }
  
  return fetchedData
}


/**
 * @notice Fetches first block after a given timestamp
 * @dev Query speed is optimized by limiting to a 600-second period
 * @param {Int} timestamp in seconds
 */
async function getBlockFromTimestamp(timestamp) {
  const query = queries.GET_BLOCK;
  let result = await blockClient.query({
    query: GET_BLOCK,
    variables: {
      timestampFrom: timestamp,
      timestampTo: timestamp + 600
    },
    fetchPolicy: 'cache-first'
  })
  return result?.data?.blocks?.[0]?.number
}

/**
 * @notice Fetches block objects for an array of timestamps.
 * @dev blocks are returned in chronological order (ASC) regardless of input.
 * @dev blocks are returned at string representations of Int
 * @dev timestamps are returns as they were provided; not the block time.
 * @param {Array} timestamps
 */
async function getBlocksFromTimestamps(timestamps, skipCount = 500) {
  if (timestamps?.length === 0) {
    return []
  }

  let fetchedData = await splitQuery(GET_BLOCKS, blockClient, [], timestamps, skipCount)
  
  let blocks = []
  if (fetchedData) {
    for (var t in fetchedData) {
      if (fetchedData[t].length > 0) {
        blocks.push({
          timestamp: t.split('t')[1],
          number: fetchedData[t][0]['number']
        })
      }
    }
  }
  return blocks
}

async function getLiquidityTokenBalanceOvertime(account, timestamps) {
  // get blocks based on timestamps
  const blocks = await getBlocksFromTimestamps(timestamps)

  // get historical share values with time travel queries
  let result = await client.query({
    query: SHARE_VALUE(account, blocks),
    fetchPolicy: 'cache-first'
  })

  let values = []
  for (var row in result?.data) {
    let timestamp = row.split('t')[1]
    if (timestamp) {
      values.push({
        timestamp,
        balance: 0
      })
    }
  }
}

/**
 * @notice Example query using time travel queries
 * @dev TODO - handle scenario where blocks are not available for a timestamps (e.g. current time)
 * @param {String} pairAddress
 * @param {Array} timestamps
 */
async function getShareValueOverTime(pairAddress, timestamps) {
  if (!timestamps) {
    const utcCurrentTime = dayjs()
    const utcSevenDaysBack = utcCurrentTime.subtract(8, 'day').unix()
    timestamps = getTimestampRange(utcSevenDaysBack, 86400, 7)
  }

  // get blocks based on timestamps
  const blocks = await getBlocksFromTimestamps(timestamps)

  // get historical share values with time travel queries
  let result = await client.query({
    query: SHARE_VALUE(pairAddress, blocks),
    fetchPolicy: 'cache-first'
  })

  let values = []
  for (var row in result?.data) {
    let timestamp = row.split('t')[1]
    let sharePriceUsd = parseFloat(result.data[row]?.reserveUSD) / parseFloat(result.data[row]?.totalSupply)
    if (timestamp) {
      values.push({
        timestamp,
        sharePriceUsd,
        totalSupply: result.data[row].totalSupply,
        reserve0: result.data[row].reserve0,
        reserve1: result.data[row].reserve1,
        reserveUSD: result.data[row].reserveUSD,
        token0DerivedBNB: result.data[row].token0.derivedBNB,
        token1DerivedBNB: result.data[row].token1.derivedBNB,
        roiUsd: values && values[0] ? sharePriceUsd / values[0]['sharePriceUsd'] : 1,
        bnbPrice: 0,
        token0PriceUSD: 0,
        token1PriceUSD: 0
      })
    }
  }

  // add bnb prices
  let index = 0
  for (var brow in result?.data) {
    let timestamp = brow.split('b')[1]
    if (timestamp) {
      values[index].bnbPrice = result.data[brow].bnbPrice
      values[index].token0PriceUSD = result.data[brow].bnbPrice * values[index].token0DerivedBNB
      values[index].token1PriceUSD = result.data[brow].bnbPrice * values[index].token1DerivedBNB
      index += 1
    }
  }

  return values
}

/**
 * @notice Creates an evenly-spaced array of timestamps
 * @dev Periods include a start and end timestamp. For example, n periods are defined by n+1 timestamps.
 * @param {Int} timestamp_from in seconds
 * @param {Int} period_length in seconds
 * @param {Int} periods
 */
function getTimestampRange(timestamp_from, period_length, periods) {
  let timestamps = []
  for (let i = 0; i <= periods; i++) {
    timestamps.push(timestamp_from + i * period_length)
  }
  return timestamps
}

const toNiceDateYear = date => dayjs.utc(dayjs.unix(date)).format('MMMM DD, YYYY')

const isAddress = value => {
  try {
    return ethers.utils.getAddress(value.toLowerCase())
  } catch {
    return false
  }
}

const toK = num => {
  return Numeral(num).format('0.[00]a')
}

const setThemeColor = theme => document.documentElement.style.setProperty('--c-token', theme || '#333333')

const Big = number => new BigNumber(number)

const urls = {
  showTransaction: tx => `https://bscscan.com/tx/${tx}/`,
  showAddress: address => `https://www.bscscan.com/address/${address}/`,
  showToken: address => `https://www.bscscan.com/token/${address}/`,
  showBlock: block => `https://bscscan.com/block/${block}/`
}

const formatTime = unix => {
  const now = dayjs()
  const timestamp = dayjs.unix(unix)

  const inSeconds = now.diff(timestamp, 'second')
  const inMinutes = now.diff(timestamp, 'minute')
  const inHours = now.diff(timestamp, 'hour')
  const inDays = now.diff(timestamp, 'day')

  if (inHours >= 24) {
    return `${inDays} ${inDays === 1 ? 'day' : 'days'} ago`
  } else if (inMinutes >= 60) {
    return `${inHours} ${inHours === 1 ? 'hour' : 'hours'} ago`
  } else if (inSeconds >= 60) {
    return `${inMinutes} ${inMinutes === 1 ? 'minute' : 'minutes'} ago`
  } else {
    return `${inSeconds} ${inSeconds === 1 ? 'second' : 'seconds'} ago`
  }
}

const formatNumber = num => {
  return num.toString().replace(/(\d)(?=(\d{3})+(?!\d))/g, '$1,')
}

// using a currency library here in case we want to add more in future
var priceFormatter = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2
})

const toSignificant = (number, significantDigits) => {
  Decimal.set({ precision: significantDigits + 1, rounding: Decimal.ROUND_UP })
  const updated = new Decimal(number).toSignificantDigits(significantDigits)
  return updated.toFormat(updated.decimalPlaces(), { groupSeparator: '' })
}

const formattedNum = (number, usd = false, acceptNegatives = false) => {
  if (isNaN(number) || number === '' || number === undefined) {
    return usd ? '$0' : 0
  }
  let num = parseFloat(number)

  if (num > 500000000) {
    return (usd ? '$' : '') + toK(num.toFixed(0), true)
  }

  if (num === 0) {
    if (usd) {
      return '$0'
    }
    return 0
  }

  if (num < 0.0001 && num > 0) {
    return usd ? '< $0.0001' : '< 0.0001'
  }

  if (num > 1000) {
    return usd
      ? '$' + Number(parseFloat(num).toFixed(0)).toLocaleString()
      : '' + Number(parseFloat(num).toFixed(0)).toLocaleString()
  }

  if (usd) {
    if (num < 0.1) {
      return '$' + Number(parseFloat(num).toFixed(4))
    } else {
      let usdString = priceFormatter.format(num)
      return '$' + usdString.slice(1, usdString.length)
    }
  }

  return Number(parseFloat(num).toFixed(5))
}

function rawPercent(percentRaw) {
  let percent = parseFloat(percentRaw * 100)
  if (!percent || percent === 0) {
    return '0%'
  }
  if (percent < 1 && percent > 0) {
    return '< 1%'
  }
  return percent.toFixed(0) + '%'
}

/**
 * gets the amoutn difference plus the % change in change itself (second order change)
 * @param {*} valueNow
 * @param {*} value24HoursAgo
 * @param {*} value48HoursAgo
 */
const get2DayPercentChange = (valueNow, value24HoursAgo, value48HoursAgo) => {
  // get volume info for both 24 hour periods
  let currentChange = parseFloat(valueNow) - parseFloat(value24HoursAgo)
  let previousChange = parseFloat(value24HoursAgo) - parseFloat(value48HoursAgo)

  const adjustedPercentChange = (parseFloat(currentChange - previousChange) / parseFloat(previousChange)) * 100

  if (isNaN(adjustedPercentChange) || !isFinite(adjustedPercentChange)) {
    return [currentChange, 0]
  }
  return [currentChange, adjustedPercentChange]
}

/**
 * get standard percent change between two values
 * @param {*} valueNow
 * @param {*} value24HoursAgo
 */
const getPercentChange = (valueNow, value24HoursAgo) => {
  const adjustedPercentChange =
    ((parseFloat(valueNow) - parseFloat(value24HoursAgo)) / parseFloat(value24HoursAgo)) * 100
  if (isNaN(adjustedPercentChange) || !isFinite(adjustedPercentChange)) {
    return 0
  }
  return adjustedPercentChange
}

function isEquivalent(a, b) {
  var aProps = Object.getOwnPropertyNames(a)
  var bProps = Object.getOwnPropertyNames(b)
  if (aProps.length !== bProps.length) {
    return false
  }
  for (var i = 0; i < aProps.length; i++) {
    var propName = aProps[i]
    if (a[propName] !== b[propName]) {
      return false
    }
  }
  return true
}

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

async function getBnbPrice() {
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

module.exports = {
  getBlocksFromTimestamps,
  getBlockFromTimestamp,
  GET_BLOCKS,
  getPercentChange,
  get2DayPercentChange,
  getTimestampsForChanges
}
//  const FACTORY_ADDRESS = '0xCe8fd65646F2a2a897755A1188C04aCe94D2B8D0'
 const FACTORY_ADDRESS = '0x553990F2CBA90272390f62C5BDb1681fFc899675'

 const BUNDLE_ID = '1'

 const timeframeOptions = {
  WEEK: '1 week',
  MONTH: '1 month',
  // THREE_MONTHS: '3 months',
  // YEAR: '1 year',
  ALL_TIME: 'All time'
}

// hide from overview list
 const OVERVIEW_TOKEN_BLACKLIST = []

// pair blacklist
 const PAIR_BLACKLIST = []

/**
 * For tokens that cause erros on fee calculations
 */
 const FEE_WARNING_TOKENS = []

 module.exports = {
   timeframeOptions,
    FACTORY_ADDRESS,
    BUNDLE_ID,
    OVERVIEW_TOKEN_BLACKLIST,
    PAIR_BLACKLIST,
    FEE_WARNING_TOKENS
 }
/* eslint-env mocha */
/* eslint-disable no-unused-expressions */
import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'
import { chains, fundAddress, TEST_TIMEOUT } from '../common'
import config from '../config'
import { testTransaction } from './common'

process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '0'

chai.use(chaiAsPromised)

describe('Transactions', function () {
  this.timeout(TEST_TIMEOUT)

  before(async () => {
    await fundAddress(chains.nearWithJs, config.near.senderAddress)
  })

  describe('Near - Js', () => {
    testTransaction(chains.nearWithJs)
  })
})

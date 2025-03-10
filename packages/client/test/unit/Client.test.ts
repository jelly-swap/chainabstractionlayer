/* eslint-env mocha */

import Client from '../../lib'

import chai from 'chai'
import chaiAsPromised from 'chai-as-promised'

const { expect } = chai.use(chaiAsPromised)

describe('Client methods without providers', () => {
  let client: Client

  beforeEach(() => {
    client = new Client()
  })

  describe('generateBlock', () => {
    it('should throw NoProviderError', async () => {
      return expect(client.chain.generateBlock(1)).to.be.rejectedWith(/No provider provided/)
    })
  })

  describe('getBlockByNumber', () => {
    it('should throw NoProviderError', async () => {
      return expect(client.chain.getBlockByNumber(1)).to.be.rejectedWith(/No provider provided/)
    })
  })

  describe('getBlockHeight', () => {
    it('should throw NoProviderError', async () => {
      return expect(client.chain.getBlockHeight()).to.be.rejectedWith(/No provider provided/)
    })
  })

  describe('getTransactionByHash', () => {
    it('should throw NoProviderError', async () => {
      return expect(client.chain.getTransactionByHash('4545')).to.be.rejectedWith(/No provider provided/)
    })
  })
})

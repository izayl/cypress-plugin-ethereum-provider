import { Eip1193Bridge } from '@ethersproject/experimental/lib/eip1193-bridge'
import { JsonRpcProvider } from '@ethersproject/providers'
import { Wallet } from '@ethersproject/wallet'

console.log(process.env.TEST_PRIVATE_KEY)

const PRIVATE_KEY = process.env.TEST_PRIVATE_KEY

export const TEST_ADDRESS_NEVER_USE = new Wallet(PRIVATE_KEY).address

class CustomizedBridge extends Eip1193Bridge {
  chainId = 5

  async sendAsync(...args) {
    console.debug('sendAsync called', ...args)
    return this.send(...args)
  }
  async send(...args) {
    console.debug('send called', ...args)
    const isCallbackForm =
      typeof args[0] === 'object' && typeof args[1] === 'function'
    let callback
    let method
    let params
    if (isCallbackForm) {
      callback = args[1]
      method = args[0].method
      params = args[0].params
    } else {
      method = args[0]
      params = args[1]
    }
    if (method === 'eth_requestAccounts' || method === 'eth_accounts') {
      if (isCallbackForm) {
        callback({ result: [TEST_ADDRESS_NEVER_USE] })
      } else {
        return Promise.resolve([TEST_ADDRESS_NEVER_USE])
      }
    }
    if (method === 'eth_chainId') {
      if (isCallbackForm) {
        callback(null, { result: '0x5' })
      } else {
        return Promise.resolve('0x5')
      }
    }
    try {
      const result = await super.send(method, params)
      console.debug('result received', method, params, result)
      if (isCallbackForm) {
        callback(null, { result })
      } else {
        return result
      }
    } catch (error) {
      if (isCallbackForm) {
        callback(error, null)
      } else {
        throw error
      }
    }
  }
}
console.log('load ethereum plugin')

export const attachEthereumPlugin = (win: Window) => {
  console.log('before load', win.ethereum)
  const provider = new JsonRpcProvider(process.env.TEST_RPC_URL, 5)
  const signer = new Wallet(PRIVATE_KEY, provider)
  win.ethereum = new CustomizedBridge(signer, provider)
  console.log('attached', win.ethereum)
}

Cypress.on('window:before:load', attachEthereumPlugin)

Cypress.Commands.overwrite('visit', (originalFn, url, options) => {
  if (options && options.beforeOnload) {
    const origin = options.beforeOnload
    options.beforeOnload = (win: Cypress.AUTWindow) => {
      attachEthereumPlugin(win)
      origin(win)
    }

    return originalFn({
      url,
      ...options,
    })
  }

  return originalFn(url)
})

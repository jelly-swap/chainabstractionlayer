import { SwapParams, SwapProvider } from "@liquality/types";
import NodeProvider from "@liquality/node-provider";
import { PendingTxError } from "@liquality/errors";
import { addressToString } from "@liquality/utils";
import {
  fromBase64,
  toBase64,
  fromNearTimestamp,
  parseReceipt,
} from "@liquality/near-utils";

const ONE_DAY_IN_NS = 24 * 60 * 60 * 1000 * 1000 * 1000;

export default class NearSwapFindProvider
  extends NodeProvider
  implements Partial<SwapProvider> {
  constructor(url: string) {
    super({
      baseURL: url,
      responseType: "text",
      transformResponse: undefined, // https://github.com/axios/axios/issues/907,
    });
  }

  normalizeTransactionResponse(tx: any) {
    const normalizedTx = {
      hash: `${tx.hash}_${tx.signer_id}`,
      blockHash: tx.block_hash,
      sender: tx.signer_id,
      receiver: tx.receiver_id,
      rawHash: tx.hash,
    } as any;

    switch (tx.action_kind) {
      case "DEPLOY_CONTRACT": {
        const code = toBase64(tx.args.code_sha256);
        normalizedTx.code = code;
        break;
      }

      case "TRANSFER": {
        const value = tx.args.deposit;
        normalizedTx.value = value;
        break;
      }

      case "FUNCTION_CALL": {
        const method = tx.args.method_name;
        const args = fromBase64(tx.args.args_base64);

        switch (method) {
          case "init": {
            normalizedTx.swap = {
              method,
              secretHash: fromBase64(args.secretHash, "hex"),
              expiration: fromNearTimestamp(args.expiration),
              recipient: args.buyer,
            };
            break;
          }

          case "claim": {
            normalizedTx.swap = {
              method,
              secret: fromBase64(args.secret, "hex"),
            };

            break;
          }

          case "refund": {
            normalizedTx.swap = { method };
            break;
          }

          default: {
            normalizedTx.raw = { method, ...args };
            break;
          }
        }
        break;
      }

      default: {
        break;
      }
    }
    return normalizedTx;
  }

  async findAddressTransaction(
    address: string,
    predicate: (tx: any) => boolean,
    limit = 1024
  ) {
    let offset = this.getCurrentTimeInNs();

    for (let page = 1; ; page++) {
      const transactions = await this.nodeGet(
        `account/${address}/activity?offset=${offset}&limit=${limit}`
      );

      if (transactions.length === 0) {
        return;
      }

      const normalizedTransactions = {} as any;

      for (const tx of transactions) {
        normalizedTransactions[tx.hash] = {
          ...normalizedTransactions[tx.hash],
          ...this.normalizeTransactionResponse(tx),
        };
      }

      const tx = Object.values(normalizedTransactions).find(predicate) as any;

      if (tx) {
        const currentHeight = await this.getMethod("getBlockHeight")();
        const txBlockHeight = await this.getMethod("getBlockHeight")(
          tx.blockHash
        );

        tx.confirmations = currentHeight - txBlockHeight;
        return tx;
      }

      offset = offset - ONE_DAY_IN_NS;
    }
  }

  async findInitiateSwapTransaction(swapParams: SwapParams) {
    return this.findAddressTransaction(
      addressToString(swapParams.refundAddress),
      (tx: any) =>
        this.getMethod("doesTransactionMatchInitiation")(swapParams, tx)
    );
  }

  async findClaimSwapTransaction(
    swapParams: SwapParams,
    initiationTxHash: string
  ) {
    const initiationTransactionReceipt = await this.getMethod(
      "getTransactionReceipt"
    )(initiationTxHash);

    if (!initiationTransactionReceipt) {
      throw new PendingTxError(
        `Transaction receipt is not available: ${initiationTxHash}`
      );
    }

    const tx = await this.findAddressTransaction(
      addressToString(parseReceipt(initiationTransactionReceipt).receiver),
      (tx) => {
        if (tx.swap) {
          return tx.swap.method === "claim";
        }
      }
    );

    if (tx && tx.swap) {
      return { ...tx, secret: tx.swap.secret };
    }
  }

  async findRefundSwapTransaction(
    swapParams: SwapParams,
    initiationTxHash: string
  ) {
    const initiationTransactionReceipt = await this.getMethod(
      "getTransactionReceipt"
    )(initiationTxHash);

    if (!initiationTransactionReceipt) {
      throw new PendingTxError(
        `Transaction receipt is not available: ${initiationTxHash}`
      );
    }

    return this.findAddressTransaction(
      addressToString(parseReceipt(initiationTransactionReceipt).receiver),
      (tx) => {
        if (tx.swap) {
          return tx.swap.method === "refund";
        }
      }
    );
  }

  getCurrentTimeInNs() {
    return new Date().valueOf() * 1000 * 1000;
  }

  doesBlockScan() {
    return false;
  }
}

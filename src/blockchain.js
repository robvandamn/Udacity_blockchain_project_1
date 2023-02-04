/**
 *                          Blockchain Class
 *  The Blockchain class contain the basics functions to create your own private blockchain
 *  It uses libraries like `crypto-js` to create the hashes for each block and `bitcoinjs-message` 
 *  to verify a message signature. The chain is stored in the array
 *  `this.chain = [];`. Of course each time you run the application the chain will be empty because and array
 *  isn't a persisten storage method.
 *  
 */

const SHA256 = require('crypto-js/sha256');
const BlockClass = require('./block.js');
const bitcoinMessage = require('bitcoinjs-message');

function checkHash(block, search_hash) {
    return block.hash==search_hash;
  }

class Blockchain {

    /**
     * Constructor of the class, you will need to setup your chain array and the height
     * of your chain (the length of your chain array).
     * Also everytime you create a Blockchain class you will need to initialized the chain creating
     * the Genesis Block.
     * The methods in this class will always return a Promise to allow client applications or
     * other backends to call asynchronous functions.
     */
    constructor() {
        this.chain = [];
        this.height = -1;
        this.initializeChain();
    }

    /**
     * This method will check for the height of the chain and if there isn't a Genesis Block it will create it.
     * You should use the `addBlock(block)` to create the Genesis Block
     * Passing as a data `{data: 'Genesis Block'}`
     */
    async initializeChain() {
        if( this.height === -1){
            let block = new BlockClass.Block({data: 'Genesis Block'});
            await this._addBlock(block);
        }
    }

    /**
     * Utility method that return a Promise that will resolve with the height of the chain
     */
    getChainHeight() {
        return new Promise((resolve, reject) => {
            resolve(this.height);
        });
    }

    /**
     * _addBlock(block) will store a block in the chain
     * @param {*} block 
     * The method will return a Promise that will resolve with the block added
     * or reject if an error happen during the execution.
     * You will need to check for the height to assign the `previousBlockHash`,
     * assign the `timestamp` and the correct `height`...At the end you need to 
     * create the `block hash` and push the block into the chain array. Don't for get 
     * to update the `this.height`
     * Note: the symbol `_` in the method name indicates in the javascript convention 
     * that this method is a private method. 
     */
    _addBlock(block) {
        let self = this;
        return new Promise(async (resolve, reject) => {

           try {
                if (self.height >= 0) {
                    const previous_block = self.chain[self.height];
                    block.previousBlockHash = previous_block.hash;
                }
                const new_height = self.height + 1;
                //update block height
                block.height = new_height;
                //update timestamp
                const curr_timestamp = parseInt(new Date().getTime().toString().slice(0,-3));
                block.time = curr_timestamp;
                //update hash and push
                block.hash = SHA256(JSON.stringify(block)).toString();
                self.chain.push(block);
                //update chain height
                self.height = new_height;

                const error_log = await self.validateChain();
                if (error_log.length === 0) {
                    resolve(block);
                } else {
                    const error = new Error("invalid");
                    error.error_log = error_log;
                    throw error;
                }
            } catch(e) {
                reject(e);
            }
        });
    }




    /**
     * The requestMessageOwnershipVerification(address) method
     * will allow you  to request a message that you will use to
     * sign it with your Bitcoin Wallet (Electrum or Bitcoin Core)
     * This is the first step before submit your Block.
     * The method return a Promise that will resolve with the message to be signed
     * @param {*} address 
     */
    requestMessageOwnershipVerification(address) {
        return new Promise((resolve) => {
            resolve(`${address}:${new Date().getTime().toString().slice(0,-3)}:starRegistry`)
        });
    }

    /**
     * The submitStar(address, message, signature, star) method
     * will allow users to register a new Block with the star object
     * into the chain. This method will resolve with the Block added or
     * reject with an error.
     * Algorithm steps:
     * 1. Get the time from the message sent as a parameter example: `parseInt(message.split(':')[1])`
     * 2. Get the current time: `let currentTime = parseInt(new Date().getTime().toString().slice(0, -3));`
     * 3. Check if the time elapsed is less than 5 minutes
     * 4. Veify the message with wallet address and signature: `bitcoinMessage.verify(message, address, signature)`
     * 5. Create the block and add it to the chain
     * 6. Resolve with the block added.
     * @param {*} address 
     * @param {*} message 
     * @param {*} signature 
     * @param {*} star 
     */
    submitStar(address, message, signature, star) {
        let self = this;
        return new Promise(async (resolve, reject) => {
            
            let message_time = parseInt(message.split(':')[1]);
            let currentTime = parseInt(new Date().getTime().toString().slice(0,-3));
            const time_diff_min = (currentTime-message_time)/(60.);
            if (time_diff_min <= 5.) {
                const message_verified = bitcoinMessage.verify(message, address, signature);
                if (message_verified) {
                    const data = {
                        owner: address,
                        signature: signature,
                        message: message,
                        star: star,
                    }
                    const new_block = new BlockClass.Block(data);
                    // resolve(new_block);
                    resolve(await self._addBlock(new_block));
                }
                else {
                    reject('message not verified')
                }
            } else {
                reject('message timeout > 5min')
            }
            
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block
     *  with the hash passed as a parameter.
     * Search on the chain array for the block that has the hash.
     * @param {*} hash 
     */
    getBlockByHash(hash) {
        let self = this;
        return new Promise((resolve, reject) => {
            // const result = self.chain.filter(checkHash, hash);
            // resolve(result);
            let block = self.chain.filter(p => p.hash === hash)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }

    /**
     * This method will return a Promise that will resolve with the Block object 
     * with the height equal to the parameter `height`
     * @param {*} height 
     */
    getBlockByHeight(height) {
        let self = this;
        return new Promise((resolve, reject) => {
            let block = self.chain.filter(p => p.height === height)[0];
            if(block){
                resolve(block);
            } else {
                resolve(null);
            }
        });
    }


    /**
     * This method will return a Promise that will resolve with an array of Stars objects existing in the chain 
     * and are belongs to the owner with the wallet address passed as parameter.
     * Remember the star should be returned decoded.
     * @param {*} address 
     */
    getStarsByWalletAddress (address) {
        let self = this;
        let star_array = [];
        let error_array = [];
        // return new Promise(async (resolve, reject) => {
        return new Promise(async (resolve, reject) => {
            let block_array = [];
            for (let block of self.chain) {
                
                try {
                    const block_data = await block.getBData();
                    if (block_data.owner === address) {
                        star_array.push(block_data);
                    }
                }
                catch(e){
                    error_array.push(e);
                }

            }
            resolve(star_array);
        });
    }


    /**
     * This method will return a Promise that will resolve with the list of errors when validating the chain.
     * Steps to validate:
     * 1. You should validate each block using `validateBlock`
     * 2. Each Block should check the with the previousBlockHash
     */
    validateChain() {
        let self = this;
        return new Promise(async (resolve, reject) => {
            let error_array = [];
            let block_length = self.chain.length;
            if (block_length >= 1) {
                let latest_block = self.chain[block_length-1];
                while (latest_block.height > 0){
                    const block_valid = await latest_block.validate();
                    if (!block_valid) {
                        error_array.push(latest_block);
                    }
                    const latest_block_snapshot = latest_block;
                    latest_block = await self.getBlockByHash(latest_block.previousBlockHash);
                    if (latest_block_snapshot.previousBlockHash != latest_block.hash) {
                        error_array.push('previous hash does not equal hash of previous block');
                    }
                }
                //check the genesis block
                const block_valid = await latest_block.validate();
                if (!block_valid) {
                    error_array.push(latest_block);
                }

            }
            resolve(error_array);
        });
    }

}

module.exports.Blockchain = Blockchain;
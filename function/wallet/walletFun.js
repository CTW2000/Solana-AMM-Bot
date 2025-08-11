const { Keypair, Connection, PublicKey, Transaction, SystemProgram, sendAndConfirmTransaction } = require('@solana/web3.js');
const config = require('../../config');

//测试命令  node walletFun.js

/**
 * 创建一个新的Solana钱包密钥对
 * @returns {Object} 包含公钥和私钥的对象
 */
function createWalletKeypair() {
  // 生成一个新的密钥对
  const keypair = Keypair.generate();
  
  // 获取公钥（地址）
  const publicKey = keypair.publicKey.toString();
  
  // 获取私钥（转换为字节数组）
  const privateKey = Buffer.from(keypair.secretKey).toString('hex');
  
  return {
    publicKey,
    privateKey
  };
}

/**
 * 查询钱包余额
 * @param {string} publicKeyStr - 钱包公钥字符串
 * @returns {Promise<number>} 返回SOL余额
 */
async function getWalletBalance(publicKeyStr) {
  try {
    // 使用配置中的网络URL
    const connection = new Connection(config.SolanaNetwork, 'confirmed');
    
    // 将公钥字符串转换为PublicKey对象
    const publicKey = new PublicKey(publicKeyStr);
    
    // 查询余额（返回的是lamports，1 SOL = 1,000,000,000 lamports）
    const balanceInLamports = await connection.getBalance(publicKey);
    
    // 转换为SOL单位
    const balanceInSOL = balanceInLamports / 1000000000;
    
    return balanceInSOL;
  } catch (error) {
    console.error('查询余额出错:', error);
    throw error;
  }
}

/**
 * 发送SOL到指定钱包地址
 * @param {string} senderPrivateKeyHex - 发送方私钥（十六进制字符串）
 * @param {string} recipientPublicKeyStr - 接收方公钥字符串
 * @param {number} amountSOL - 发送的SOL数量
 * @returns {Promise<string>} 交易签名
 */
async function transferSOL(senderPrivateKeyHex, recipientPublicKeyStr, amountSOL) {
  try {
    // 创建连接对象
    const connection = new Connection(config.SolanaNetwork, 'confirmed');
    
    // 将私钥转换为Buffer，再创建发送方的Keypair
    const senderPrivateKeyBuffer = Buffer.from(senderPrivateKeyHex, 'hex');
    const senderKeypair = Keypair.fromSecretKey(senderPrivateKeyBuffer);
    
    // 检查发送方余额
    const balance = await connection.getBalance(senderKeypair.publicKey);
    const balanceInSOL = balance / 1000000000;
    
    // 检查余额是否足够
    if (balanceInSOL < amountSOL) {
      throw new Error(`余额不足: ${balanceInSOL} SOL, 需要: ${amountSOL} SOL`);
    }
    
    // 创建接收方的PublicKey对象
    const recipientPublicKey = new PublicKey(recipientPublicKeyStr);
    
    // SOL转换为lamports单位（1 SOL = 10^9 lamports）
    const lamports = amountSOL * 1000000000;
    
    // 创建转账指令
    const instruction = SystemProgram.transfer({
      fromPubkey: senderKeypair.publicKey,
      toPubkey: recipientPublicKey,
      lamports: lamports
    });
    
    // 创建交易并添加指令
    const transaction = new Transaction().add(instruction);
    
    // 获取最新的区块哈希，这是交易的唯一标识符
    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = senderKeypair.publicKey;
    
    // 发送和确认交易
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [senderKeypair]
    );
    
    console.log(`交易成功: ${signature}`);
    return signature;
    
  } catch (error) {
    console.error('交易失败:', error);
    throw error;
  }
}



// publicKey: '2pkqS8fDtR3vizXJcbVnTfeck2JvYZy3r6wzDH5T9NMv',
//privateKey: '1762a599b597f0c6b2cc0cac9fda0f8c6424abbd3fd0490790b0bbdc56f4cb8f1b178ca6215382b28196b363cc1081c9476c1215412fa451dcd14f30a6ebc711'}

//publicKey: 'xvHxkkPZ7sX2s2XKkCNWHpcgcBjFuThKrqxppTU1DA7',
//privateKey: 'c1a30a11188f7dc9a725390faf9fa94f556f1fb93ca9535a4fbd393ba87c63de0e5333d3a9c93065edf27c4da6854524a6b24fee4e714bca0a2666c99db810f0'}
async function main() {

  // 查询余额示例
  try {

    // 从指定钱包向另一个钱包转账0.5 SOL
    const senderPrivateKey = '1762a599b597f0c6b2cc0cac9fda0f8c6424abbd3fd0490790b0bbdc56f4cb8f1b178ca6215382b28196b363cc1081c9476c1215412fa451dcd14f30a6ebc711';
    const recipientPublicKey = 'xvHxkkPZ7sX2s2XKkCNWHpcgcBjFuThKrqxppTU1DA7';
    const amountToSend = 0.005; // SOL
    
    // 转账前查询发送方钱包余额
    const senderPublicKey = '2pkqS8fDtR3vizXJcbVnTfeck2JvYZy3r6wzDH5T9NMv';
    const senderBalance = await getWalletBalance(senderPublicKey);
    console.log(`发送方钱包余额: ${senderBalance} SOL`);
    
    // 执行转账
    try {
      const signature = await transferSOL(senderPrivateKey, recipientPublicKey, amountToSend);
      console.log(`转账成功，交易签名: ${signature}`);
      
      // 转账后查询两个钱包余额
      const newSenderBalance = await getWalletBalance(senderPublicKey);
      const recipientBalance = await getWalletBalance(recipientPublicKey);
      console.log(`转账后发送方余额: ${newSenderBalance} SOL`);
      console.log(`转账后接收方余额: ${recipientBalance} SOL`);
    } catch (error) {
      console.log(`转账失败: ${error.message}`);
    }
  } catch (error) {
    console.log('操作失败');
  }
}

main();


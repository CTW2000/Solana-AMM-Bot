const { Connection, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, sendAndConfirmTransaction, ComputeBudgetProgram, PublicKey } = require('@solana/web3.js');
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createInitializeMintInstruction,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  getAssociatedTokenAddress,
  MINT_SIZE,
  getMinimumBalanceForRentExemptMint,
} = require('@solana/spl-token');
const mplTokenMetadata = require('@metaplex-foundation/mpl-token-metadata');
const fs = require('fs');
const config = require('../../config');



//测试命令  node tokenFun.js


// Metaplex Token Metadata Program ID
const TOKEN_METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s');

const rpcEndpoint = config.SolanaNetwork;
const TOKEN_METADATA = config.TOKEN_METADATA;
const TOKEN_CONFIG = config.TOKEN_CONFIG;

/**
 * 创建代币并添加元数据（一个交易）
 * @param {String|Uint8Array|Array} privateKey - 钱包私钥，可以是十六进制字符串或字节数组
 * @returns {Promise<Object>} - 返回创建结果
 */
async function createTokenWithMetadata(privateKey) {
  try {
    console.log('🚀 开始创建代币并添加元数据（一个交易）...');
    
    // 从私钥参数创建钱包
    let secretKey;
    if (typeof privateKey === 'string') {
      // 如果输入是字符串，将十六进制字符串转换为字节数组
      secretKey = new Uint8Array(
        privateKey.match(/.{1,2}/g).map(byte => parseInt(byte, 16))
      );
    } else {
      // 如果已经是数组，直接使用
      secretKey = Uint8Array.from(privateKey);
    }
    
    const wallet = Keypair.fromSecretKey(secretKey);
    console.log(`钱包地址: ${wallet.publicKey.toString()}`);
    
    // 初始化连接
    const connection = new Connection(rpcEndpoint, 'confirmed');
    
    // 检查钱包余额
    const balance = await connection.getBalance(wallet.publicKey);
    console.log(`钱包余额: ${balance / LAMPORTS_PER_SOL} SOL`);
    
    if (balance < 0.05 * LAMPORTS_PER_SOL) {
      console.warn('警告: 钱包余额较低，可能无法完成交易');
    }
    
    // 生成新的mint账户
    const mintKeypair = Keypair.generate();
    const mint = mintKeypair.publicKey;
    console.log(`新Mint地址: ${mint.toString()}`);
    
    // 计算关联代币账户地址
    const associatedTokenAccount = await getAssociatedTokenAddress(
      mint,
      wallet.publicKey
    );
    console.log(`关联代币账户: ${associatedTokenAccount.toString()}`);
    
    // 计算元数据账户地址
    const [metadataAddress] = PublicKey.findProgramAddressSync(
      [
        Buffer.from('metadata'),
        TOKEN_METADATA_PROGRAM_ID.toBuffer(),
        mint.toBuffer(),
      ],
      TOKEN_METADATA_PROGRAM_ID
    );
    console.log(`元数据地址: ${metadataAddress.toString()}`);
    
    // 获取租金豁免金额
    const rentExemptBalance = await getMinimumBalanceForRentExemptMint(connection);
    
    // 创建交易
    const transaction = new Transaction();
    
    // 1. 设置计算单元限制
    transaction.add(
      ComputeBudgetProgram.setComputeUnitLimit({
        units: 250000,
      })
    );
    
    // 2. 设置计算单元价格
    transaction.add(
      ComputeBudgetProgram.setComputeUnitPrice({
        microLamports: 200000,
      })
    );
    
    // 3. 创建mint账户
    transaction.add(
      SystemProgram.createAccount({
        fromPubkey: wallet.publicKey,
        newAccountPubkey: mint,
        space: MINT_SIZE,
        lamports: rentExemptBalance,
        programId: TOKEN_PROGRAM_ID,
      })
    );
    
    // 4. 初始化mint
    transaction.add(
      createInitializeMintInstruction(
        mint,
        TOKEN_CONFIG.decimals,
        wallet.publicKey, // mint authority
        wallet.publicKey, // freeze authority
        TOKEN_PROGRAM_ID
      )
    );
    
    // 5. 创建关联代币账户
    transaction.add(
      createAssociatedTokenAccountInstruction(
        wallet.publicKey,      // payer
        associatedTokenAccount, // associatedToken
        wallet.publicKey,      // owner
        mint,                 // mint
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
    
    // 6. 铸造代币
    transaction.add(
      createMintToInstruction(
        mint,                 // mint
        associatedTokenAccount, // destination
        wallet.publicKey,      // authority
        TOKEN_CONFIG.initialSupply * Math.pow(10, TOKEN_CONFIG.decimals), // amount
        [],                   // multiSigners
        TOKEN_PROGRAM_ID
      )
    );
    
    // 7. 创建元数据
    transaction.add(
      createCreateMetadataAccountV3Instruction(
        {
          metadata: metadataAddress,
          mint: mint,
          mintAuthority: wallet.publicKey,
          payer: wallet.publicKey,
          updateAuthority: wallet.publicKey,
        },
        {
          createMetadataAccountArgsV3: {
            data: {
              name: TOKEN_METADATA.name,
              symbol: TOKEN_METADATA.symbol,
              uri: TOKEN_METADATA.uri,
              sellerFeeBasisPoints: TOKEN_METADATA.sellerFeeBasisPoints,
              creators: null,
              collection: null,
              uses: null,
            },
            isMutable: true,
            collectionDetails: null,
          },
        }
      )
    );
    
    console.log('发送交易...');
    console.log(`交易包含 ${transaction.instructions.length} 个指令`);
    
    // 发送交易
    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [wallet, mintKeypair], // 需要wallet和mintKeypair签名
      {
        commitment: 'confirmed',
        maxRetries: 3,
      }
    );
    
    console.log('\n✅ 代币创建成功！');
    console.log(`交易签名: ${signature}`);
    console.log(`交易链接: https://solscan.io/tx/${signature}`);
    console.log(`代币链接: https://solscan.io/token/${mint.toString()}`);
    
    console.log('\n代币信息:');
    console.log(`名称: ${TOKEN_METADATA.name}`);
    console.log(`符号: ${TOKEN_METADATA.symbol}`);
    console.log(`Mint地址: ${mint.toString()}`);
    console.log(`元数据地址: ${metadataAddress.toString()}`);
    console.log(`关联代币账户: ${associatedTokenAccount.toString()}`);
    console.log(`小数位数: ${TOKEN_CONFIG.decimals}`);
    console.log(`初始供应量: ${TOKEN_CONFIG.initialSupply.toLocaleString()}`);
    console.log(`元数据URI: ${TOKEN_METADATA.uri}`);
    
    return {
      success: true,
      signature,
      mint: mint.toString(),
      metadata: metadataAddress.toString(),
      tokenAccount: associatedTokenAccount.toString(),
      explorerUrl: `https://solscan.io/token/${mint.toString()}`,
      transactionUrl: `https://solscan.io/tx/${signature}`
    };
  } catch (error) {
    console.error('❌ 创建代币失败:', error.message);
    
    if (error.message.includes('insufficient funds')) {
      console.log('💡 余额不足，请确保钱包有足够的SOL');
    } else if (error.message.includes('blockhash')) {
      console.log('💡 交易超时，请重试');
    }
    
    return { success: false, error: error.message };
  }
}

async function main() {
  const result = await createTokenWithMetadata("1762a599b597f0c6b2cc0cac9fda0f8c6424abbd3fd0490790b0bbdc56f4cb8f1b178ca6215382b28196b363cc1081c9476c1215412fa451dcd14f30a6ebc711");
  console.log(result);
}

main();









// Simple Filecoin upload test - focuses on the actual upload process
import { Synapse, RPC_URLS, TOKENS, TIME_CONSTANTS } from "@filoz/synapse-sdk";
import { ethers } from "ethers";
import dotenv from 'dotenv';
dotenv.config();

async function testFilecoinUpload() {
  console.log("🚀 Simple Filecoin Upload Test");
  console.log("=".repeat(40));

  // Check environment
  const privateKey = process.env.FILECOIN_PRIVATE_KEY;
  if (!privateKey) {
    console.log("❌ FILECOIN_PRIVATE_KEY not set");
    console.log("💡 Set it in your .env file");
    return;
  }

  console.log("✅ Private key found");

  try {
    // Initialize Synapse
    console.log("🔄 Connecting to Filecoin Cloud...");
    const synapse = await Synapse.create({
      privateKey,
      rpcURL: process.env.FILECOIN_RPC_URL || RPC_URLS.calibration.http
    });
    console.log("✅ Connected to Filecoin Cloud");

    /*
    console.log("Funding Filecoin Cloud account...");
    const depositAmount = ethers.parseUnits("2.5", 18);
    const tx = await synapse.payments.depositWithPermitAndApproveOperator(
      depositAmount, // 2.5 USDFC (covers 1TiB of storage for 30 days)
      synapse.getWarmStorageAddress(),
      ethers.MaxUint256,
      ethers.MaxUint256,
      TIME_CONSTANTS.EPOCHS_PER_MONTH,
    )

    await tx.wait()

    console.log(`Funded Filecoin Cloud account with ${depositAmount} wei`);
    console.log(`Transaction: ${tx.hash}`);
    */

    // Prepare test data
    const timestamp = new Date().toISOString();
    const testData = new TextEncoder().encode(
      `🧪 Filecoin Cloud Plugin Test\n` +
      `Timestamp: ${timestamp}\n` +
      `Message: This data is stored on Filecoin!\n` +
      `Verification: Use the Piece CID below to find this data\n` +
      `Network: Calibration Testnet\n` +
      `${'x'.repeat(150)}\n` // Padding for minimum size
    );

    console.log(`📏 Test data size: ${testData.length} bytes`);

    // Attempt upload
    console.log("☁️  Uploading to Filecoin...");
    const startTime = Date.now();

    //const uploadResult = await synapse.createStorage(testData);
    const { pieceCid, size } = await synapse.storage.upload(testData);
    const endTime = Date.now();
    const uploadTime = endTime - startTime;

    // Extract Piece CID
    //const pieceCid = uploadResult.pieceCid || uploadResult;

    console.log("🎉 UPLOAD SUCCESSFUL!");
    console.log("=".repeat(40));
    console.log(`🔗 Piece CID: ${pieceCid}`);
    console.log(`⏱️  Upload time: ${uploadTime}ms`);
    console.log(`📅 Uploaded at: ${new Date().toISOString()}`);
    console.log(`📊 Data size: ${testData.length} bytes`);

    // Verification instructions
    console.log("\n📋 VERIFICATION INSTRUCTIONS:");
    console.log("=".repeat(40));
    console.log("1. Copy the Piece CID above");
    console.log("2. Visit: https://calibration.filfox.info/en/piece/" + pieceCid);
    console.log("3. Or visit: https://filscout.com/en/calibration/piece/" + pieceCid);
    console.log("4. Look for your test data in the piece information");
    console.log("5. Check that deals are active with storage providers");

    // Test download
    console.log("\n📥 Testing download...");
    const downloadedData = await synapse.storage.download(pieceCid);
    const decodedText = new TextDecoder().decode(downloadedData);

    if (decodedText.includes("Filecoin Cloud Plugin Test")) {
      console.log("✅ Download verification successful!");
      console.log("📄 Data integrity confirmed");
    } else {
      console.log("❌ Download verification failed");
    }

    console.log("\n🎯 NEXT STEPS:");
    console.log("=".repeat(40));
    console.log("1. 🌐 Verify on Filecoin explorer using the links above");
    console.log("2. ⏰ Wait 5-10 minutes for full network propagation");
    console.log("3. 📊 Check deal status and storage providers");
    console.log("4. 🎉 Your data is now on the Filecoin network!");

    return pieceCid;

  } catch (error) {
    console.log("\n❌ UPLOAD FAILED");
    console.log("=".repeat(40));
    console.log("Error:", error.message);

    if (error.message.includes("failed ping test")) {
      console.log("\n💡 PROVIDER ISSUE:");
      console.log("   Filecoin testnet providers are temporarily unavailable");
      console.log("   This is common - try again in a few minutes");
      console.log("   Or check: https://status.filecoin.io/");
    } else if (error.message.includes("insufficient funds")) {
      console.log("\n💡 FUNDS ISSUE:");
      console.log("   Your wallet needs testnet tokens (tFIL and USDFC)");
      console.log("   Get tFIL: https://faucet.calibnet.chainsafe-fil.io/");
      console.log("   Get USDFC: https://forest-explorer.chainsafe.dev/faucet/calibnet_usdfc");
    } else if (error.message.includes("private key")) {
      console.log("\n💡 PRIVATE KEY ISSUE:");
      console.log("   Check your private key is valid");
      console.log("   Ensure it has testnet tokens");
    } else {
      console.log("\n💡 OTHER ISSUE:");
      console.log("   Check internet connection");
      console.log("   Try a different RPC URL");
      console.log("   Check Filecoin testnet status");
    }

    return null;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testFilecoinUpload().then(pieceCid => {
    if (pieceCid) {
      console.log(`\n✨ Test completed successfully!`);
      console.log(`🔗 Your Piece CID: ${pieceCid}`);
    } else {
      console.log(`\n⚠️  Test failed - see troubleshooting above`);
    }
  }).catch(console.error);
}

export default testFilecoinUpload;

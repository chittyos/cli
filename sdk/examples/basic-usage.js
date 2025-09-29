/**
 * ChittyOS SDK Basic Usage Examples
 * Demonstrates how to use the ChittyOS MCP SDK
 */

const { ChittyOSSDK, ChittyOSUtils } = require("../chittyos-mcp-sdk");

async function basicUsageExamples() {
  // Initialize the SDK
  const chitty = new ChittyOSSDK({
    apiKey: process.env.CHITTY_API_KEY,
    debug: true,
  });

  try {
    console.log("🚀 ChittyOS SDK Basic Usage Examples\n");

    // Test connection
    console.log("1. Testing connection...");
    const pingResult = await chitty.ping();
    console.log("✅ Connected:", pingResult);

    // Generate ChittyID
    console.log("\n2. Generating ChittyID...");
    const idResult = await chitty.tools.generateId("DEMO");
    console.log("📝 Generated ID:", idResult);

    // Create a legal case
    console.log("\n3. Creating legal case...");
    const caseData = {
      title: "Demo Case - SDK Integration Test",
      client: "SDK Test Client",
      matter_type: "Software Development",
      jurisdiction: "US",
    };
    const newCase = await chitty.cases.create(caseData);
    console.log("⚖️  Created case:", newCase);

    // Search cases
    console.log("\n4. Searching cases...");
    const searchResults = await chitty.cases.search("SDK Test");
    console.log("🔍 Search results:", searchResults);

    // Process a payment
    console.log("\n5. Processing payment...");
    const paymentData = {
      amount: 1500.0,
      currency: "USD",
      client_id: "SDK-TEST-CLIENT-001",
      description: "SDK Integration Testing Fee",
    };
    const payment = await chitty.payments.process(paymentData);
    console.log("💳 Payment processed:", payment);

    // Run compliance check
    console.log("\n6. Running compliance check...");
    const complianceResult = await chitty.compliance.check("./", "all");
    console.log("✅ Compliance check:", complianceResult);

    // Execute workflow
    console.log("\n7. Executing workflow...");
    const workflowResult = await chitty.workflows.execute("intake", {
      client: "SDK Test Client",
      matter: "SDK Integration",
    });
    console.log("🔄 Workflow executed:", workflowResult);

    console.log("\n✅ All examples completed successfully!");
  } catch (error) {
    console.error("❌ Error:", error.message);
    if (error.details) {
      console.error("Details:", error.details);
    }
  }
}

async function utilityExamples() {
  console.log("\n🛠️  Utility Functions Examples\n");

  // Validate ChittyID format
  const testId = "CASE-20250928-ABC123";
  console.log(
    `ID "${testId}" is valid:`,
    ChittyOSUtils.validateChittyIdFormat(testId),
  );

  // Parse ChittyID
  const parsed = ChittyOSUtils.parseChittyId(testId);
  console.log("Parsed ID:", parsed);

  // Format currency
  const amount = 1234.56;
  console.log("Formatted amount:", ChittyOSUtils.formatCurrency(amount));

  // Validate email
  const email = "test@chitty.cc";
  console.log(`Email "${email}" is valid:`, ChittyOSUtils.validateEmail(email));

  // Generate secure ID
  const secureId = ChittyOSUtils.generateSecureId();
  console.log("Secure ID:", secureId);
}

async function errorHandlingExample() {
  console.log("\n🚨 Error Handling Example\n");

  const chitty = new ChittyOSSDK({
    apiKey: "invalid-key",
    debug: false,
  });

  // Set up error listeners
  chitty.on("error", (error) => {
    console.log("SDK Error Event:", error.message);
  });

  chitty.on("disconnected", (error) => {
    console.log("SDK Disconnected:", error.message);
  });

  try {
    await chitty.ping();
  } catch (error) {
    console.log("Caught error:", error.name, "-", error.message);
  }
}

async function advancedUsageExample() {
  console.log("\n🎯 Advanced Usage Example\n");

  const chitty = new ChittyOSSDK({
    apiKey: process.env.CHITTY_API_KEY,
    timeout: 60000, // 60 second timeout
    retries: 5, // Retry 5 times
    debug: false,
  });

  try {
    // Batch operations
    console.log("Performing batch operations...");

    const batchResults = await Promise.allSettled([
      chitty.tools.generateId("BATCH1"),
      chitty.tools.generateId("BATCH2"),
      chitty.tools.generateId("BATCH3"),
      chitty.compliance.getMetrics("7d"),
      chitty.workflows.getTemplates(),
    ]);

    batchResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        console.log(`✅ Batch operation ${index + 1} succeeded`);
      } else {
        console.log(
          `❌ Batch operation ${index + 1} failed:`,
          result.reason.message,
        );
      }
    });

    // Pagination example
    console.log("\nPagination example...");
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 3) {
      // Limit to 3 pages for demo
      const cases = await chitty.cases.list({ page, limit: 5 });
      console.log(`Page ${page}: Found ${cases.data?.length || 0} cases`);

      hasMore = cases.hasNext || false;
      page++;
    }
  } catch (error) {
    console.error("Advanced usage error:", error.message);
  }
}

// Run examples
async function runAllExamples() {
  if (!process.env.CHITTY_API_KEY) {
    console.log("⚠️  Set CHITTY_API_KEY environment variable to run examples");
    console.log("Example: CHITTY_API_KEY=your_key_here node basic-usage.js\n");
  }

  await basicUsageExamples();
  await utilityExamples();
  await errorHandlingExample();

  if (process.env.CHITTY_API_KEY) {
    await advancedUsageExample();
  }
}

// Run if called directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}

module.exports = {
  basicUsageExamples,
  utilityExamples,
  errorHandlingExample,
  advancedUsageExample,
};

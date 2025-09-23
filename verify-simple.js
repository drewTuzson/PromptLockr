// verify-simple.js
console.log("========================================");
console.log("   PromptLockr API Setup Verification   ");
console.log("========================================\n");

// Step 1: Check Environment Variables
console.log("📋 STEP 1: Checking Environment Variables...\n");

const requiredVars = [
  "CLAUDE_API_KEY",
  "ENHANCEMENT_RATE_LIMIT_FREE",
  "ENHANCEMENT_RATE_LIMIT_PREMIUM",
  "JWT_SECRET",
  "DATABASE_URL",
];

let allVarsPresent = true;

requiredVars.forEach((varName) => {
  const exists = !!process.env[varName];
  const status = exists ? "✅" : "❌";
  const value = exists
    ? varName.includes("KEY") || varName.includes("SECRET")
      ? `[SET - ${process.env[varName].length} chars]`
      : process.env[varName]
    : "NOT SET";

  console.log(`${status} ${varName}: ${value}`);
  if (!exists) allVarsPresent = false;
});

if (!allVarsPresent) {
  console.log("\n⚠️  Some environment variables are missing!");
  console.log("Go to Replit Secrets tab and add the missing variables.\n");
} else {
  console.log("\n✅ All environment variables are set!\n");
}

// Step 2: Test Anthropic API Key
console.log("📋 STEP 2: Testing Anthropic API Connection...\n");

async function testAnthropicAPI() {
  try {
    console.log("Calling Claude API with your key...");
    console.log(
      "API Key starts with:",
      process.env.CLAUDE_API_KEY?.substring(0, 10) + "...",
    );

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-3-haiku-20240307",
        max_tokens: 50,
        messages: [
          {
            role: "user",
            content: 'Say "Hello PromptLockr!" in exactly three words.',
          },
        ],
      }),
    });

    if (response.ok) {
      const data = await response.json();
      console.log("✅ SUCCESS! Claude responded:", data.content[0].text);
      console.log("✅ Your API key is valid and working!\n");
      return true;
    } else {
      const errorData = await response.text();
      console.log("❌ API Error Status:", response.status);
      console.log("❌ Error Details:", errorData);

      if (response.status === 401) {
        console.log(
          "\n⚠️  Invalid API Key! Please check your Anthropic API key in Replit Secrets.",
        );
        console.log(
          "   Make sure there are no extra spaces at the beginning or end.",
        );
      } else if (response.status === 429) {
        console.log(
          "\n⚠️  Rate limited! You may have exceeded your API quota.",
        );
      } else if (response.status === 400) {
        console.log("\n⚠️  Bad request. The API key format might be wrong.");
      }
      return false;
    }
  } catch (error) {
    console.log("❌ Connection Error:", error.message);
    console.log("\n⚠️  Could not connect to Anthropic API.");
    return false;
  }
}

// Step 3: Test Enhancement Service Configuration
console.log("📋 STEP 3: Testing Rate Limit Configuration...\n");

function testEnhancementConfig() {
  const freeLimit = parseInt(process.env.ENHANCEMENT_RATE_LIMIT_FREE);
  const premiumLimit = parseInt(process.env.ENHANCEMENT_RATE_LIMIT_PREMIUM);

  console.log(`Free User Limit: ${freeLimit || "NOT SET"} enhancements/hour`);
  console.log(
    `Premium User Limit: ${premiumLimit || "NOT SET"} enhancements/hour`,
  );

  if (freeLimit > 0 && premiumLimit > 0) {
    console.log("✅ Rate limits configured correctly!\n");
    return true;
  } else {
    console.log("❌ Rate limits not properly configured!\n");
    return false;
  }
}

// Run all tests
async function runVerification() {
  const configOk = testEnhancementConfig();
  const apiWorking = await testAnthropicAPI();

  console.log("========================================");
  console.log("         VERIFICATION SUMMARY           ");
  console.log("========================================\n");

  if (apiWorking && configOk && allVarsPresent) {
    console.log("🎉 SUCCESS! Your enhancement feature is ready!\n");
    console.log("Next steps:");
    console.log("1. Start your server if not running: npm run dev");
    console.log("2. Open your app in the browser");
    console.log("3. Create or edit a prompt");
    console.log('4. Click "Enhance with AI" button');
    console.log("5. You should see the enhanced version appear!\n");
  } else {
    console.log("⚠️  Please fix the issues above:\n");
    if (!allVarsPresent)
      console.log("- Add missing environment variables in Replit Secrets");
    if (!apiWorking)
      console.log("- Check your CLAUDE_API_KEY in Replit Secrets");
    if (!configOk)
      console.log("- Set ENHANCEMENT_RATE_LIMIT_FREE and _PREMIUM to numbers");
    console.log(
      "\nAfter fixing, run this verification again: node verify-simple.js",
    );
  }
}

// Start verification
runVerification();

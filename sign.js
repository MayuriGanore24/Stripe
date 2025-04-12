const crypto = require("crypto");
const fs = require("fs");

// Load the webhook payload
const payload = fs.readFileSync("webhook-payload.json", "utf8");
// Remove any whitespace that might cause signature issues
const cleanPayload = payload.trim();

// Use the secret from your webhook settings
const secret = "whsec_wrSBQFXpQtycnr9NOcc1NXOkOoHVPpxV";
const timestamp = Math.floor(Date.now() / 1000);

// Create the string to sign (timestamp + '.' + payload)
const signedPayload = `${timestamp}.${cleanPayload}`;

// Generate the signature
const signature = crypto
  .createHmac("sha256", secret)
  .update(signedPayload)
  .digest("hex");

// Output both the signature and a curl command
console.log(`Stripe-Signature: t=${timestamp},v1=${signature}`);
console.log(`\nPayload used for signing (${cleanPayload.length} bytes):`);
console.log(cleanPayload);

// Save the exact payload used for signing to a new file
fs.writeFileSync("exact-signed-payload.json", cleanPayload);

console.log(`\nCurl command (using the exact same payload that was signed):`);
console.log(`curl -X POST https://vtexai.kinsta.cloud/wp-json/custom/v1/enroll/ \\
  -H "Content-Type: application/json" \\
  -H "Stripe-Signature:t=${timestamp},v1=${signature}" \\
  -d @exact-signed-payload.json --trace-ascii -`);
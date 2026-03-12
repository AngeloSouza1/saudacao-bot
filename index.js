import { ensureInitialized, ensureService, runNow, runTest } from "./bot.js";
import { startDashboard } from "./dashboard-server.js";

const isNowMode = process.argv.includes("--now");
const isTestMode = process.argv.includes("--test");

async function main() {
  if (isNowMode) {
    await ensureInitialized();
    await runNow();
    process.exit(0);
  }

  if (isTestMode) {
    await ensureInitialized();
    await runTest();
    process.exit(0);
  }

  await startDashboard();
  ensureService()
    .then(() => {
      console.log("🤖 Bot ligado com painel. Use: node index.js --now ou node index.js --test para testar.");
    })
    .catch((error) => {
      console.error(error);
    });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

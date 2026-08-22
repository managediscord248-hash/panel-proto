import { initServer, isSetupComplete, completeSetup } from "../src/server/init.js";
import { createUser } from "../src/server/auth.js";
import { getUserByUsername } from "../src/server/store.js";

async function main() {
  initServer();
  const args = process.argv.slice(2);
  const username = args[0] || "admin";
  const password = args[1] || "changeme123";
  const role = (args[2] as "owner" | "admin" | "user") || "owner";

  if (getUserByUsername(username)) {
    console.log(`User '${username}' already exists.`);
    process.exit(1);
  }

  const user = await createUser(username, password, role);
  console.log(`Created user: ${user.username} (role: ${user.role})`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

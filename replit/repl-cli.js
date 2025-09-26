#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import inquirer from "inquirer";
import ora from "ora";
import fs from "fs-extra";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import { dirname } from "path";
import axios from "axios";
import WebSocket from "ws";
import { spawn } from "child_process";
import simpleGit from "simple-git";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Configuration
const CONFIG_DIR = path.join(os.homedir(), ".replit");
const CONFIG_FILE = path.join(CONFIG_DIR, "config.json");
const API_BASE = "https://replit.com/api/v1";

class ReplitCLI {
  constructor() {
    this.config = this.loadConfig();
    this.git = simpleGit();
  }

  loadConfig() {
    try {
      if (fs.existsSync(CONFIG_FILE)) {
        return fs.readJsonSync(CONFIG_FILE);
      }
    } catch (error) {
      console.error(chalk.yellow("Warning: Could not load config file"));
    }
    return { token: null, user: null, currentRepl: null };
  }

  saveConfig() {
    try {
      fs.ensureDirSync(CONFIG_DIR);
      fs.writeJsonSync(CONFIG_FILE, this.config, { spaces: 2 });
    } catch (error) {
      console.error(chalk.red("Error saving config:"), error.message);
    }
  }

  async makeRequest(endpoint, options = {}) {
    if (!this.config.token) {
      throw new Error("Not authenticated. Please run: repl-cli login");
    }

    try {
      const response = await axios({
        url: `${API_BASE}${endpoint}`,
        headers: {
          Authorization: `Bearer ${this.config.token}`,
          "Content-Type": "application/json",
          ...options.headers,
        },
        ...options,
      });
      return response.data;
    } catch (error) {
      if (error.response?.status === 401) {
        throw new Error("Authentication failed. Please login again.");
      }
      throw error;
    }
  }

  // Authentication commands
  async login() {
    console.log(chalk.cyan("🔐 Replit CLI Authentication"));
    console.log(
      chalk.gray("Please visit: https://replit.com/cli/authenticate"),
    );

    const answers = await inquirer.prompt([
      {
        type: "password",
        name: "token",
        message: "Enter your Replit API token:",
        validate: (input) => input.length > 0 || "Token cannot be empty",
      },
    ]);

    const spinner = ora("Verifying authentication...").start();

    try {
      this.config.token = answers.token;
      const userData = await this.makeRequest("/user");
      this.config.user = userData;
      this.saveConfig();

      spinner.succeed(
        chalk.green(`Successfully logged in as ${userData.username}!`),
      );
      console.log(chalk.gray(`User ID: ${userData.id}`));
      console.log(chalk.gray(`Email: ${userData.email || "Not provided"}`));
    } catch (error) {
      spinner.fail(chalk.red("Authentication failed"));
      this.config.token = null;
      this.saveConfig();
      throw error;
    }
  }

  async logout() {
    this.config = { token: null, user: null, currentRepl: null };
    this.saveConfig();
    console.log(chalk.green("✓ Successfully logged out"));
  }

  async showUser(username) {
    const spinner = ora("Fetching user information...").start();

    try {
      const endpoint = username ? `/users/${username}` : "/user";
      const userData = await this.makeRequest(endpoint);

      spinner.succeed("User information retrieved");
      console.log("\n" + chalk.cyan("User Details:"));
      console.log(chalk.white(`  Username: ${userData.username}`));
      console.log(
        chalk.white(
          `  Type: ${userData.isOrganization ? "Organization" : "Personal"}`,
        ),
      );
      console.log(chalk.white(`  ID: ${userData.id}`));
      console.log(chalk.white(`  Bio: ${userData.bio || "Not set"}`));
      console.log(chalk.white(`  Karma: ${userData.karma || 0}`));
      console.log(
        chalk.white(
          `  Created: ${userData.timeCreated ? new Date(userData.timeCreated).toLocaleDateString() : "Unknown"}`,
        ),
      );

      if (userData.replCount) {
        console.log(chalk.white(`  Repls: ${userData.replCount}`));
      }

      if (userData.organizations && userData.organizations.length > 0) {
        console.log(
          chalk.white(
            `  Organizations: ${userData.organizations.map((org) => org.name).join(", ")}`,
          ),
        );
      }
    } catch (error) {
      spinner.fail(chalk.red("Failed to fetch user information"));
      throw error;
    }
  }

  // List repls with organization/personal distinction
  async listRepls(options = {}) {
    const spinner = ora("Fetching repls...").start();

    try {
      const params = new URLSearchParams();
      if (options.organization) params.append("org", options.organization);
      if (options.search) params.append("search", options.search);
      if (options.language) params.append("language", options.language);

      const endpoint = options.organization
        ? `/orgs/${options.organization}/repls?${params}`
        : `/user/repls?${params}`;

      const repls = await this.makeRequest(endpoint);

      spinner.succeed(`Found ${repls.length} repls`);

      console.log("\n" + chalk.cyan("Your Repls:"));
      for (const repl of repls) {
        const owner =
          repl.owner ||
          (options.organization ? `@${options.organization}` : "You");
        const visibility = repl.isPrivate
          ? chalk.yellow("[Private]")
          : chalk.green("[Public]");
        console.log(
          `  ${chalk.white(repl.title)} ${visibility} - ${chalk.gray(`ID: ${repl.id}`)}
    Owner: ${owner} | Language: ${repl.language} | Updated: ${new Date(repl.timeUpdated).toLocaleDateString()}`,
        );
      }

      return repls;
    } catch (error) {
      spinner.fail(chalk.red("Failed to fetch repls"));
      throw error;
    }
  }

  // GitHub repository mapping
  async mapToGitHub(replId, githubUrl) {
    const spinner = ora("Mapping repl to GitHub repository...").start();

    try {
      // Parse GitHub URL
      const urlMatch = githubUrl.match(/github\.com[:/]([^/]+)\/([^/.]+)/);
      if (!urlMatch) {
        throw new Error("Invalid GitHub URL format");
      }

      const [, owner, repo] = urlMatch;

      // Update repl metadata with GitHub info
      const response = await this.makeRequest(`/repls/${replId}/github`, {
        method: "POST",
        data: {
          owner,
          repo,
          url: githubUrl,
          sync: true,
        },
      });

      spinner.succeed(chalk.green(`Mapped to GitHub: ${owner}/${repo}`));

      if (response.webhookUrl) {
        console.log(chalk.gray(`  Webhook: ${response.webhookUrl}`));
      }

      console.log(chalk.cyan("\nGitHub Integration:"));
      console.log(`  Repository: ${githubUrl}`);
      console.log(`  Auto-sync: ${response.autoSync ? "Enabled" : "Disabled"}`);
      console.log(`  Branch: ${response.branch || "main"}`);

      return response;
    } catch (error) {
      spinner.fail(chalk.red("Failed to map to GitHub"));
      throw error;
    }
  }

  // Map entire GitHub organization to Replit organization
  async mapGitHubOrg(replitOrg, githubOrg, options = {}) {
    const spinner = ora(
      `Mapping GitHub org ${githubOrg} to Replit org ${replitOrg}...`,
    ).start();

    try {
      spinner.text = "Fetching GitHub repositories...";

      // Get GitHub org repos
      const response = await this.makeRequest(
        `/github/orgs/${githubOrg}/repos`,
        {
          method: "GET",
        },
      );

      const repos = response.repositories || [];
      spinner.text = `Found ${repos.length} repositories. Starting mapping...`;

      const results = {
        successful: [],
        failed: [],
        skipped: [],
      };

      for (const repo of repos) {
        try {
          // Skip if filter is specified and doesn't match
          if (options.filter && !repo.name.includes(options.filter)) {
            results.skipped.push(repo.name);
            continue;
          }

          // Check if repl exists or create new one
          const replName = options.prefix
            ? `${options.prefix}-${repo.name}`
            : repo.name;

          const replResponse = await this.makeRequest(
            `/orgs/${replitOrg}/repls`,
            {
              method: "POST",
              data: {
                title: replName,
                language: repo.language || "nodejs",
                description: repo.description,
                isPrivate: repo.private,
                githubUrl: repo.html_url,
                autoImport: true,
              },
            },
          );

          results.successful.push({
            repo: repo.name,
            replId: replResponse.id,
            replSlug: replResponse.slug,
          });

          spinner.text = `Mapped ${results.successful.length}/${repos.length} repositories...`;
        } catch (error) {
          results.failed.push({
            repo: repo.name,
            error: error.message,
          });
        }
      }

      spinner.succeed(chalk.green(`Organization mapping completed`));

      console.log(chalk.cyan("\nMapping Results:"));
      console.log(chalk.green(`  ✓ Successful: ${results.successful.length}`));
      console.log(chalk.red(`  ✗ Failed: ${results.failed.length}`));
      console.log(chalk.yellow(`  ⊘ Skipped: ${results.skipped.length}`));

      if (results.successful.length > 0) {
        console.log(chalk.cyan("\nMapped Repositories:"));
        results.successful.forEach((item) => {
          console.log(`  ${item.repo} → ${item.replSlug} (${item.replId})`);
        });
      }

      if (results.failed.length > 0) {
        console.log(chalk.red("\nFailed Mappings:"));
        results.failed.forEach((item) => {
          console.log(`  ${item.repo}: ${item.error}`);
        });
      }

      return results;
    } catch (error) {
      spinner.fail(chalk.red("Failed to map GitHub organization"));
      throw error;
    }
  }

  // Deploy repl to production
  async deploy(replId, options = {}) {
    const spinner = ora("Preparing deployment...").start();

    try {
      // Get repl information
      spinner.text = "Fetching repl information...";
      const replData = await this.makeRequest(`/repls/${replId}`);

      spinner.text = "Creating deployment...";

      // Create deployment
      const deployment = await this.makeRequest(
        `/repls/${replId}/deployments`,
        {
          method: "POST",
          data: {
            type: options.type || "production",
            autoDeploy: options.autoDeploy !== false,
            env: options.env || "production",
            customDomain: options.domain,
            scale: {
              minInstances: options.minInstances || 1,
              maxInstances: options.maxInstances || 3,
              memory: options.memory || 512,
              cpu: options.cpu || 0.5,
            },
          },
        },
      );

      spinner.succeed(chalk.green("Deployment created successfully"));

      console.log(chalk.cyan("\nDeployment Details:"));
      console.log(`  ID: ${deployment.id}`);
      console.log(`  URL: ${deployment.url}`);
      console.log(`  Type: ${deployment.type}`);
      console.log(`  Status: ${deployment.status}`);

      if (deployment.customDomain) {
        console.log(`  Custom Domain: ${deployment.customDomain}`);
      }

      console.log(chalk.cyan("\nScaling Configuration:"));
      console.log(
        `  Instances: ${deployment.scale.minInstances}-${deployment.scale.maxInstances}`,
      );
      console.log(`  Memory: ${deployment.scale.memory}MB`);
      console.log(`  CPU: ${deployment.scale.cpu} cores`);

      // Monitor deployment status
      if (options.wait) {
        spinner.start("Waiting for deployment to complete...");

        let status = deployment.status;
        while (status === "pending" || status === "building") {
          await new Promise((resolve) => setTimeout(resolve, 3000));
          const statusCheck = await this.makeRequest(
            `/deployments/${deployment.id}`,
          );
          status = statusCheck.status;
          spinner.text = `Deployment status: ${status}...`;
        }

        if (status === "ready") {
          spinner.succeed(
            chalk.green(
              `Deployment successful! Available at: ${deployment.url}`,
            ),
          );
        } else {
          spinner.fail(chalk.red(`Deployment failed with status: ${status}`));
        }
      }

      return deployment;
    } catch (error) {
      spinner.fail(chalk.red("Failed to deploy repl"));
      throw error;
    }
  }

  // List deployments
  async listDeployments(replId) {
    const spinner = ora("Fetching deployments...").start();

    try {
      const deployments = await this.makeRequest(
        `/repls/${replId}/deployments`,
      );

      spinner.succeed(`Found ${deployments.length} deployments`);

      if (deployments.length === 0) {
        console.log(chalk.yellow("No deployments found for this repl"));
        return;
      }

      console.log(chalk.cyan("\nDeployments:"));
      deployments.forEach((dep) => {
        const statusColor =
          dep.status === "ready"
            ? chalk.green
            : dep.status === "failed"
              ? chalk.red
              : chalk.yellow;

        console.log(`\n  ${chalk.white(dep.id)}`);
        console.log(`    Status: ${statusColor(dep.status)}`);
        console.log(`    URL: ${dep.url}`);
        console.log(`    Type: ${dep.type}`);
        console.log(`    Created: ${new Date(dep.createdAt).toLocaleString()}`);

        if (dep.customDomain) {
          console.log(`    Custom Domain: ${dep.customDomain}`);
        }
      });

      return deployments;
    } catch (error) {
      spinner.fail(chalk.red("Failed to fetch deployments"));
      throw error;
    }
  }

  // Rollback deployment
  async rollback(deploymentId) {
    const spinner = ora("Rolling back deployment...").start();

    try {
      const response = await this.makeRequest(
        `/deployments/${deploymentId}/rollback`,
        {
          method: "POST",
        },
      );

      spinner.succeed(chalk.green("Rollback initiated"));

      console.log(chalk.cyan("\nRollback Details:"));
      console.log(`  Previous Version: ${response.fromVersion}`);
      console.log(`  Rolled Back To: ${response.toVersion}`);
      console.log(`  Status: ${response.status}`);

      return response;
    } catch (error) {
      spinner.fail(chalk.red("Failed to rollback deployment"));
      throw error;
    }
  }

  // Sync with GitHub
  async syncWithGitHub(replId, direction = "pull") {
    const spinner = ora(`Syncing with GitHub (${direction})...`).start();

    try {
      const response = await this.makeRequest(`/repls/${replId}/github/sync`, {
        method: "POST",
        data: { direction },
      });

      spinner.succeed(chalk.green(`GitHub sync completed (${direction})`));

      if (response.commits) {
        console.log(chalk.cyan("\nSynced commits:"));
        response.commits.forEach((commit) => {
          console.log(`  ${commit.sha.substring(0, 7)} - ${commit.message}`);
        });
      }

      if (response.filesChanged) {
        console.log(chalk.gray(`Files changed: ${response.filesChanged}`));
      }

      return response;
    } catch (error) {
      spinner.fail(chalk.red("Failed to sync with GitHub"));
      throw error;
    }
  }

  // Repl management commands
  async clone(replId, destination) {
    const spinner = ora("Fetching repl information...").start();

    try {
      const replData = await this.makeRequest(`/repls/${replId}`);
      spinner.text = "Cloning repl files...";

      const destPath = destination || replData.slug;
      await fs.ensureDir(destPath);

      // Download files
      const files = await this.makeRequest(`/repls/${replId}/files`);

      for (const file of files) {
        const filePath = path.join(destPath, file.path);
        await fs.ensureDir(path.dirname(filePath));
        await fs.writeFile(filePath, file.content);
      }

      // Save repl metadata
      const metaPath = path.join(destPath, ".replit-meta.json");
      await fs.writeJson(
        metaPath,
        {
          id: replData.id,
          slug: replData.slug,
          language: replData.language,
          owner: replData.owner,
          lastCloned: new Date().toISOString(),
        },
        { spaces: 2 },
      );

      spinner.succeed(chalk.green(`Successfully cloned repl to ${destPath}`));
      console.log(chalk.gray(`  Title: ${replData.title}`));
      console.log(chalk.gray(`  Language: ${replData.language}`));
      console.log(chalk.gray(`  Files: ${files.length}`));
    } catch (error) {
      spinner.fail(chalk.red("Failed to clone repl"));
      throw error;
    }
  }

  async pull() {
    const spinner = ora("Checking for repl metadata...").start();

    try {
      const metaPath = ".replit-meta.json";
      if (!fs.existsSync(metaPath)) {
        spinner.fail("Not a repl directory. Use clone first.");
        return;
      }

      const meta = await fs.readJson(metaPath);
      spinner.text = "Fetching latest changes...";

      const files = await this.makeRequest(`/repls/${meta.id}/files`);

      let updatedCount = 0;
      for (const file of files) {
        const filePath = file.path;
        const localPath = path.resolve(filePath);

        if (
          !fs.existsSync(localPath) ||
          fs.readFileSync(localPath, "utf-8") !== file.content
        ) {
          await fs.ensureDir(path.dirname(localPath));
          await fs.writeFile(localPath, file.content);
          updatedCount++;
        }
      }

      meta.lastPulled = new Date().toISOString();
      await fs.writeJson(metaPath, meta, { spaces: 2 });

      spinner.succeed(
        chalk.green(`Pull complete. ${updatedCount} files updated.`),
      );
    } catch (error) {
      spinner.fail(chalk.red("Failed to pull changes"));
      throw error;
    }
  }

  async push() {
    const spinner = ora("Checking for repl metadata...").start();

    try {
      const metaPath = ".replit-meta.json";
      if (!fs.existsSync(metaPath)) {
        spinner.fail("Not a repl directory. Use clone first.");
        return;
      }

      const meta = await fs.readJson(metaPath);
      spinner.text = "Uploading local changes...";

      // Get all local files
      const localFiles = await this.getLocalFiles(".");
      const filesToUpload = [];

      for (const file of localFiles) {
        if (file === ".replit-meta.json") continue;

        const content = await fs.readFile(file, "utf-8");
        filesToUpload.push({
          path: file,
          content: content,
        });
      }

      // Upload files
      await this.makeRequest(`/repls/${meta.id}/files`, {
        method: "POST",
        data: { files: filesToUpload },
      });

      meta.lastPushed = new Date().toISOString();
      await fs.writeJson(metaPath, meta, { spaces: 2 });

      spinner.succeed(
        chalk.green(`Push complete. ${filesToUpload.length} files uploaded.`),
      );
    } catch (error) {
      spinner.fail(chalk.red("Failed to push changes"));
      throw error;
    }
  }

  async getLocalFiles(dir, fileList = []) {
    const files = await fs.readdir(dir);

    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);

      if (stat.isDirectory()) {
        if (!file.startsWith(".") && file !== "node_modules") {
          await this.getLocalFiles(filePath, fileList);
        }
      } else {
        fileList.push(filePath);
      }
    }

    return fileList;
  }

  // Execution commands
  async run(replId, action = "start") {
    const spinner = ora(`${action}ing repl...`).start();

    try {
      const endpoint = `/repls/${replId}/run`;
      const response = await this.makeRequest(endpoint, {
        method: "POST",
        data: { action },
      });

      spinner.succeed(chalk.green(`Repl ${action}ed successfully`));

      if (response.url) {
        console.log(chalk.cyan(`  URL: ${response.url}`));
      }
      if (response.status) {
        console.log(chalk.gray(`  Status: ${response.status}`));
      }
    } catch (error) {
      spinner.fail(chalk.red(`Failed to ${action} repl`));
      throw error;
    }
  }

  async exec(replId, command) {
    const spinner = ora("Connecting to repl...").start();

    try {
      const response = await this.makeRequest(`/repls/${replId}/exec`, {
        method: "POST",
        data: { command },
      });

      spinner.stop();
      console.log(chalk.cyan("Command output:"));
      console.log(response.output);

      if (response.exitCode !== undefined) {
        console.log(chalk.gray(`Exit code: ${response.exitCode}`));
      }
    } catch (error) {
      spinner.fail(chalk.red("Failed to execute command"));
      throw error;
    }
  }

  async shell(replId) {
    console.log(chalk.cyan("Connecting to repl shell..."));
    console.log(chalk.gray('Type "exit" to disconnect\n'));

    try {
      // Get WebSocket URL for shell connection
      const response = await this.makeRequest(`/repls/${replId}/shell`);
      const ws = new WebSocket(response.wsUrl, {
        headers: {
          Authorization: `Bearer ${this.config.token}`,
        },
      });

      ws.on("open", () => {
        console.log(chalk.green("Connected to shell\n"));

        // Setup stdin
        process.stdin.setRawMode(true);
        process.stdin.resume();
        process.stdin.on("data", (data) => {
          ws.send(data);
        });
      });

      ws.on("message", (data) => {
        process.stdout.write(data);
      });

      ws.on("close", () => {
        console.log(chalk.yellow("\nDisconnected from shell"));
        process.stdin.setRawMode(false);
        process.exit(0);
      });

      ws.on("error", (error) => {
        console.error(chalk.red("Shell error:"), error.message);
        process.exit(1);
      });
    } catch (error) {
      console.error(chalk.red("Failed to connect to shell"));
      throw error;
    }
  }

  // Environment and database commands
  async env(replId, action, key, value) {
    const spinner = ora("Managing environment variables...").start();

    try {
      let response;

      switch (action) {
        case "list":
          response = await this.makeRequest(`/repls/${replId}/env`);
          spinner.stop();
          console.log(chalk.cyan("Environment Variables:"));
          for (const [k, v] of Object.entries(response.variables)) {
            console.log(`  ${k}=${v}`);
          }
          break;

        case "set":
          if (!key || !value) {
            spinner.fail("Key and value required for set operation");
            return;
          }
          await this.makeRequest(`/repls/${replId}/env`, {
            method: "POST",
            data: { key, value },
          });
          spinner.succeed(chalk.green(`Set ${key}=${value}`));
          break;

        case "delete":
          if (!key) {
            spinner.fail("Key required for delete operation");
            return;
          }
          await this.makeRequest(`/repls/${replId}/env/${key}`, {
            method: "DELETE",
          });
          spinner.succeed(chalk.green(`Deleted ${key}`));
          break;

        default:
          spinner.fail("Invalid action. Use: list, set, or delete");
      }
    } catch (error) {
      spinner.fail(chalk.red("Failed to manage environment variables"));
      throw error;
    }
  }

  async db(replId, action, key, value) {
    const spinner = ora("Managing database...").start();

    try {
      let response;

      switch (action) {
        case "list":
          response = await this.makeRequest(`/repls/${replId}/db`);
          spinner.stop();
          console.log(chalk.cyan("Database Keys:"));
          for (const key of response.keys) {
            console.log(`  ${key}`);
          }
          break;

        case "get":
          if (!key) {
            spinner.fail("Key required for get operation");
            return;
          }
          response = await this.makeRequest(`/repls/${replId}/db/${key}`);
          spinner.stop();
          console.log(chalk.cyan(`Value for ${key}:`));
          console.log(JSON.stringify(response.value, null, 2));
          break;

        case "set":
          if (!key || !value) {
            spinner.fail("Key and value required for set operation");
            return;
          }
          await this.makeRequest(`/repls/${replId}/db`, {
            method: "POST",
            data: { key, value: JSON.parse(value) },
          });
          spinner.succeed(chalk.green(`Set ${key}`));
          break;

        case "delete":
          if (!key) {
            spinner.fail("Key required for delete operation");
            return;
          }
          await this.makeRequest(`/repls/${replId}/db/${key}`, {
            method: "DELETE",
          });
          spinner.succeed(chalk.green(`Deleted ${key}`));
          break;

        default:
          spinner.fail("Invalid action. Use: list, get, set, or delete");
      }
    } catch (error) {
      spinner.fail(chalk.red("Failed to manage database"));
      throw error;
    }
  }
}

// CLI setup
const cli = new ReplitCLI();
const program = new Command();

program
  .name("repl-cli")
  .description("Replit CLI - Manage your repls from the command line")
  .version("1.0.0");

// Authentication commands
program
  .command("login")
  .description("Authenticate with your Replit account")
  .action(async () => {
    try {
      await cli.login();
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("logout")
  .description("Log out from your Replit account")
  .action(async () => {
    try {
      await cli.logout();
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("user [username]")
  .description("Display user information")
  .action(async (username) => {
    try {
      await cli.showUser(username);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// List repls command
program
  .command("list")
  .description("List all your repls")
  .option("-o, --org <organization>", "List organization repls")
  .option("-s, --search <query>", "Search repls by name")
  .option("-l, --language <language>", "Filter by language")
  .action(async (options) => {
    try {
      await cli.listRepls({
        organization: options.org,
        search: options.search,
        language: options.language,
      });
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// GitHub mapping commands
program
  .command("github-map <replId> <githubUrl>")
  .description("Map a repl to a GitHub repository")
  .action(async (replId, githubUrl) => {
    try {
      await cli.mapToGitHub(replId, githubUrl);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("github-sync <replId> [direction]")
  .description("Sync repl with GitHub (pull|push)")
  .action(async (replId, direction = "pull") => {
    try {
      await cli.syncWithGitHub(replId, direction);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("github-org-map <replitOrg> <githubOrg>")
  .description("Map entire GitHub organization to Replit organization")
  .option("-f, --filter <filter>", "Filter repos by name pattern")
  .option("-p, --prefix <prefix>", "Add prefix to repl names")
  .action(async (replitOrg, githubOrg, options) => {
    try {
      await cli.mapGitHubOrg(replitOrg, githubOrg, {
        filter: options.filter,
        prefix: options.prefix,
      });
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// Deployment commands
program
  .command("deploy <replId>")
  .description("Deploy a repl to production")
  .option("-t, --type <type>", "Deployment type (production|staging)")
  .option("-d, --domain <domain>", "Custom domain")
  .option("-w, --wait", "Wait for deployment to complete")
  .option("--min-instances <n>", "Minimum instances", parseInt)
  .option("--max-instances <n>", "Maximum instances", parseInt)
  .option("--memory <mb>", "Memory in MB", parseInt)
  .option("--cpu <cores>", "CPU cores", parseFloat)
  .action(async (replId, options) => {
    try {
      await cli.deploy(replId, {
        type: options.type,
        domain: options.domain,
        wait: options.wait,
        minInstances: options.minInstances,
        maxInstances: options.maxInstances,
        memory: options.memory,
        cpu: options.cpu,
      });
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("deployments <replId>")
  .description("List all deployments for a repl")
  .action(async (replId) => {
    try {
      await cli.listDeployments(replId);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("rollback <deploymentId>")
  .description("Rollback a deployment to previous version")
  .action(async (deploymentId) => {
    try {
      await cli.rollback(deploymentId);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// Repl management commands
program
  .command("clone <replId> [destination]")
  .description("Clone a repl to your local machine")
  .action(async (replId, destination) => {
    try {
      await cli.clone(replId, destination);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("pull")
  .description("Pull latest changes from remote repl")
  .action(async () => {
    try {
      await cli.pull();
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("push")
  .description("Push local changes to remote repl")
  .action(async () => {
    try {
      await cli.push();
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// Execution commands
program
  .command("run <replId> [action]")
  .description("Start, stop, or restart a repl")
  .action(async (replId, action) => {
    try {
      await cli.run(replId, action);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("exec <replId> <command>")
  .description("Execute a command on a remote repl")
  .action(async (replId, command) => {
    try {
      await cli.exec(replId, command);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("shell <replId>")
  .description("Connect to a bash shell in a remote repl")
  .action(async (replId) => {
    try {
      await cli.shell(replId);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// Environment and database commands
program
  .command("env <replId> <action> [key] [value]")
  .description("Manage repl environment variables (list|set|delete)")
  .action(async (replId, action, key, value) => {
    try {
      await cli.env(replId, action, key, value);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

program
  .command("db <replId> <action> [key] [value]")
  .description("Manage Replit Database (list|get|set|delete)")
  .action(async (replId, action, key, value) => {
    try {
      await cli.db(replId, action, key, value);
    } catch (error) {
      console.error(chalk.red("Error:"), error.message);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse(process.argv);

import env from "./config/env.config.js";
import { simpleGit } from "simple-git";
import fs from "node:fs";
import { exec } from "node:child_process";
import Docker from "dockerode";
import util from "util";
import services from "./config/services.config.js";

const docker = new Docker();
const execAsync = util.promisify(exec);

const { GITHUB_USERNAME, GITHUB_TOKEN } = env;
const OWNER = "LakshayManglani";

// Colorize the terminal output
const COLORS = {
  RESET: "\x1b[0m",
  GREEN: "\x1b[32m",
  RED: "\x1b[31m",
  YELLOW: "\x1b[33m",
  CYAN: "\x1b[36m",
};

// Function to fork a repository if needed
async function forkRepository(service) {
  const forkedRepoUrl = `https://github.com/${GITHUB_USERNAME}/${service.name}.git`;

  try {
    console.log(
      `${COLORS.CYAN}➤ Checking if ${service.name} repository is already forked...${COLORS.RESET}`,
    );
    const checkResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${service.name}`,
      {
        headers: { Authorization: `token ${GITHUB_TOKEN}` },
      },
    );

    if (checkResponse.ok) {
      console.log(
        `${COLORS.GREEN}✔ Repository ${service.name} is already forked.${COLORS.RESET}`,
      );
      return forkedRepoUrl;
    }

    console.log(
      `${COLORS.YELLOW}➤ Forking ${service.name} repository...${COLORS.RESET}`,
    );
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${service.name}/forks`,
      {
        method: "POST",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fork repository: ${service.name}`);
    }

    console.log(
      `${COLORS.GREEN}✔ Successfully forked ${service.name} repository.${COLORS.RESET}`,
    );
    return forkedRepoUrl;
  } catch (error) {
    console.error(
      `${COLORS.RED}✖ Error in forking repository ${service.name}: ${error.message}${COLORS.RESET}`,
    );
    throw error;
  }
}

// Function to clone or update the repository
async function cloneOrUpdateRepository(service, repoUrl) {
  const git = simpleGit();
  const serviceLocalPath = `services/${service.name}`;

  if (!fs.existsSync(serviceLocalPath)) {
    try {
      console.log(
        `${COLORS.CYAN}➤ Cloning ${service.name} repository...${COLORS.RESET}`,
      );
      await git.clone(repoUrl, serviceLocalPath, {
        "--branch": service.branch || "main",
      });
      console.log(
        `${COLORS.GREEN}✔ Successfully cloned ${service.name} repository.${COLORS.RESET}`,
      );
    } catch (error) {
      console.error(
        `${COLORS.RED}✖ Error in cloning ${service.name}: ${error.message}${COLORS.RESET}`,
      );
      throw error;
    }
  } else {
    try {
      console.log(
        `${COLORS.CYAN}➤ Pulling latest changes for ${service.name} repository...${COLORS.RESET}`,
      );
      await git.cwd(serviceLocalPath).pull();
      console.log(
        `${COLORS.GREEN}✔ Successfully pulled latest changes for ${service.name}.${COLORS.RESET}`,
      );
    } catch (error) {
      console.warn(
        `${COLORS.YELLOW}✖ Error in pulling ${service.name}: ${error.message}${COLORS.RESET}`,
      );
    }
  }
}

// Function to build the Docker image
async function buildDockerImage(service) {
  const serviceLocalPath = `services/${service.name}`;

  try {
    console.log(
      `${COLORS.YELLOW}➤ Building Docker image for ${service.name}...${COLORS.RESET}`,
    );
    await execAsync(
      `cd ${serviceLocalPath} && npm install && docker build -f Dockerfile.dev -t ${service.name}:development ./`,
    );
    console.log(
      `${COLORS.GREEN}✔ Docker image for ${service.name} built successfully.${COLORS.RESET}`,
    );
  } catch (error) {
    console.error(
      `${COLORS.RED}✖ Error in building Docker image for ${service.name}: ${error.message}${COLORS.RESET}`,
    );
    throw error;
  }
}

// Function to build and setup the service
async function buildService(service) {
  let repoUrl = service.repo;

  if (GITHUB_USERNAME !== OWNER) {
    repoUrl = await forkRepository(service);
  }

  await cloneOrUpdateRepository(service, repoUrl);
  await buildDockerImage(service);
}

// Run all services
async function run() {
  try {
    console.log(
      `${COLORS.CYAN}Starting build process for all services...${COLORS.RESET}`,
    );
    await Promise.all(
      services.map(async service => {
        console.log(
          `\n${COLORS.CYAN}➤ Starting build for service: ${service.name}${COLORS.RESET}`,
        );
        await buildService(service);
      }),
    );

    console.log(
      `${COLORS.CYAN}Starting Docker containers with docker-compose...${COLORS.RESET}`,
    );
    await execAsync(`docker compose -f docker-compose.dev.yml up -d`);
    console.log(
      `${COLORS.GREEN}✔ All Docker containers started successfully.${COLORS.RESET}`,
    );
  } catch (error) {
    console.error(
      `${COLORS.RED}✖ Error in running services: ${error.message}${COLORS.RESET}`,
    );
  }
}

run();

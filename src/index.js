import env from './config/env.config.js';
import {simpleGit} from 'simple-git';
import fs from 'node:fs';
import {exec} from 'node:child_process';
import Docker from 'dockerode';
import util from 'util';
import services from './config/services.config.js';

const docker = new Docker();
const execAsync = util.promisify(exec);

const {GITHUB_USERNAME, GITHUB_TOKEN} = env;
const OWNER = 'LakshayManglani';

// Function to fork a repository if needed
async function forkRepository(service) {
  const forkedRepoUrl = `https://github.com/${GITHUB_USERNAME}/${service.name}.git`;

  try {
    // Check if the repository is already forked
    const checkResponse = await fetch(
      `https://api.github.com/repos/${GITHUB_USERNAME}/${service.name}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
        },
      },
    );

    if (checkResponse.ok) {
      console.log(`Repository ${service.name} already forked.`);
      return forkedRepoUrl;
    }

    // Fork the repository if not already forked
    const response = await fetch(
      `https://api.github.com/repos/${OWNER}/${service.name}/forks`,
      {
        method: 'POST',
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (!response.ok) {
      throw new Error(`Failed to fork repository: ${service.name}`);
    }

    console.log(`Forked ${service.name} repository to ${GITHUB_USERNAME}.`);
    return forkedRepoUrl;
  } catch (error) {
    console.error(
      `Error in forking repository ${service.name}: ${error.message}`,
    );
    throw error;
  }
}

// Function to clone and build the service
async function buildService(service) {
  const git = simpleGit();
  const serviceLocalPath = `services/${service.name}`;
  let repoUrl = service.repo;

  // Fork if needed
  if (GITHUB_USERNAME !== OWNER) {
    repoUrl = await forkRepository(service);
  }

  try {
    // Clone or pull the latest changes
    if (!fs.existsSync(serviceLocalPath)) {
      await git.clone(repoUrl, serviceLocalPath, {
        '--branch': service.branch || 'main',
      });
      console.log(`Cloned ${service.name} repository.`);
    } else {
      await git.cwd(serviceLocalPath).pull();
      console.log(`Pulled latest changes for ${service.name}.`);
    }
  } catch (error) {
    console.error(`Error in cloning/pulling ${service.name}: ${error.message}`);
    throw error;
  }

  // Build the Docker image
  try {
    console.log(`Building Docker image for ${service.name}...`);
    await execAsync(
      `cd ${serviceLocalPath} && npm install && docker build -f Dockerfile.dev -t ${service.name}:development ./`,
    );
    console.log(`Built Docker image for ${service.name}.`);
  } catch (error) {
    console.error(
      `Error in building Docker image for ${service.name}: ${error.message}`,
    );
    throw error;
  }
}

// Run all services
const run = async () => {
  try {
    await Promise.all(
      services.map(async service => {
        await buildService(service);
      }),
    );

    console.log('Starting Docker containers...');
    await execAsync(`docker compose -f docker-compose.dev.yml up -d`);
    console.log('Docker containers started successfully.');
  } catch (error) {
    console.error(`Error in running services: ${error.message}`);
  }
};

run();

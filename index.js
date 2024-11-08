import {simpleGit} from 'simple-git';
import fs from 'node:fs';
import {exec} from 'node:child_process';
import Docker from 'dockerode';
import util from 'util';

const services = [
  {
    name: 'api-gateway',
    repo: 'https://github.com/LakshayManglani/api-gateway.git',
  },
  {
    name: 'email-service',
    repo: 'https://github.com/LakshayManglani/email-service.git',
  },
  {
    name: 'auth-service',
    repo: 'https://github.com/LakshayManglani/auth-service.git',
  },
  {
    name: 'user-service',
    repo: 'https://github.com/LakshayManglani/user-service.git',
  },
];

const docker = new Docker();
const execAsync = util.promisify(exec);

async function buildService(service) {
  const git = simpleGit();

  const serviceLocalPath = `services/${service.name}`;

  if (!fs.existsSync(serviceLocalPath)) {
    await git.clone(service.repo, serviceLocalPath, {
      '--branch': service.branch || 'main',
    });
  } else {
    await git.cwd(serviceLocalPath).pull();
  }

  // Build the docker image
  console.log(`Building ${service.name}`);
  await execAsync(
    `cd ${serviceLocalPath} && npm i && docker build -f Dockerfile.dev -t ${service.name}:development ./`,
  );
}

const run = async () => {
  for (const service of services) {
    await buildService(service);
  }

  await execAsync(`docker compose -f docker-compose.dev.yml up -d`);
};

run();

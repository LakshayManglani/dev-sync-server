import env from './config/env.config.js';
import simpleGit from 'simple-git';
import services from './config/services.config.js';
import {COLORS, OWNER} from './constants.js';

const {GITHUB_USERNAME, GITHUB_TOKEN} = env;

const getBranch = service => service.branch || 'main';

async function syncForkWithUpstream(servicePath, service) {
  const git = simpleGit(servicePath);
  const branch = getBranch(service);

  try {
    console.log(
      `${COLORS.CYAN}➤ Checking remotes for ${service.name}...${COLORS.RESET}`,
    );

    // Ensure 'upstream' remote exists, otherwise add it
    const remotes = await git.getRemotes();
    if (!remotes.some(remote => remote.name === 'upstream')) {
      await git.addRemote(
        'upstream',
        `https://github.com/${OWNER}/${service.name}.git`,
      );
      console.log(
        `${COLORS.GREEN}✔ Added 'upstream' remote for ${service.name}.${COLORS.RESET}`,
      );
    } else {
      console.log(
        `${COLORS.YELLOW}✔ 'upstream' remote already exists for ${service.name}.${COLORS.RESET}`,
      );
    }

    // Fetch and merge changes from upstream
    console.log(
      `${COLORS.CYAN}➤ Fetching latest changes from upstream for ${service.name}...${COLORS.RESET}`,
    );
    await git.fetch('upstream', branch);
    console.log(
      `${COLORS.GREEN}✔ Fetched latest changes from upstream for ${service.name}.${COLORS.RESET}`,
    );

    console.log(
      `${COLORS.CYAN}➤ Merging upstream changes into local branch for ${service.name}...${COLORS.RESET}`,
    );
    await git.mergeFromTo(`upstream/${branch}`, branch);
    console.log(
      `${COLORS.GREEN}✔ Merged upstream changes into ${service.name}.${COLORS.RESET}`,
    );

    // Set the remote to the forked repository
    const forkedRepoUrl = `https://${GITHUB_USERNAME}:${GITHUB_TOKEN}@github.com/${GITHUB_USERNAME}/${service.name}.git`;
    await git.remote(['set-url', 'origin', forkedRepoUrl]);

    // Push merged changes to the forked repository on GitHub
    console.log(
      `${COLORS.CYAN}➤ Pushing merged changes to forked repository for ${service.name}...${COLORS.RESET}`,
    );
    await git.push('origin', branch);
    console.log(
      `${COLORS.GREEN}✔ Successfully pushed changes to forked repository for ${service.name}.${COLORS.RESET}`,
    );
  } catch (error) {
    console.error(
      `${COLORS.RED}✖ Error syncing ${service.name}: ${error.message}${COLORS.RESET}`,
    );
    throw error;
  }
}

async function run() {
  try {
    console.log(
      `${COLORS.CYAN}Starting synchronization process for all services...${COLORS.RESET}`,
    );
    await Promise.all(
      services.map(service =>
        syncForkWithUpstream(`services/${service.name}`, service),
      ),
    );
    console.log(
      `${COLORS.GREEN}✔ All repositories synchronized successfully.${COLORS.RESET}`,
    );
  } catch (error) {
    console.error(
      `${COLORS.RED}✖ Error syncing repositories: ${error.message}${COLORS.RESET}`,
    );
  }
}

if (GITHUB_USERNAME !== OWNER) {
  run();
} else {
  console.log(
    `${COLORS.YELLOW}Skipping synchronization process because GITHUB_USERNAME and OWNER are the same.${COLORS.RESET}`,
  );
}

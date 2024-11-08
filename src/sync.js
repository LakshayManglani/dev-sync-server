import env from './config/env.config';
import simpleGit from 'simple-git';
import services from './config/services.config';

const {GITHUB_USERNAME} = env;
const OWNER = 'LakshayManglani';

const getBranch = service => service.branch || 'main';

async function syncForkWithUpstream(servicePath, service) {
  const git = simpleGit(servicePath);
  const branch = getBranch(service);

  try {
    // Ensure 'upstream' remote exists, otherwise add it
    const remotes = await git.getRemotes();
    if (!remotes.some(remote => remote.name === 'upstream')) {
      await git.addRemote(
        'upstream',
        `https://github.com/${OWNER}/${service.name}.git`,
      );
      console.log(`Added 'upstream' for ${service.name}`);
    }

    // Fetch and merge changes from upstream
    await git.fetch('upstream', branch);
    console.log(`Fetched latest changes from upstream for ${service.name}`);

    await git.mergeFromTo(`upstream/${branch}`, branch);
    console.log(`Merged upstream changes into ${service.name}`);

    // Push merged changes to the forked repository on GitHub
    await git.push('origin', branch);
    console.log(`Pushed changes to forked repository for ${service.name}`);
  } catch (error) {
    console.error(`Error syncing ${service.name}: ${error.message}`);
    throw error;
  }
}

async function run() {
  try {
    await Promise.all(
      services.map(service =>
        syncForkWithUpstream(`services/${service.name}`, service),
      ),
    );
  } catch (error) {
    console.error(`Error syncing repositories: ${error.message}`);
  }
}

if (GITHUB_USERNAME !== OWNER) {
  run();
}

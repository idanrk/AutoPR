const axios = require('axios');
const git = require('simple-git');
const OpenAI = require('openai');

// Configuration
const config = {
    githubToken: process.env.GITHUB_TOKEN,
    targetBranch: process.env.CREATE_PR_TARGET || 'master',
    chatGptApiKey: process.env.CHATGPT_API_KEY,
    chatGptModel: process.env.CHATGPT_MODEL || 'text-davinci-002',
};

async function createPr(){
    if(!config.chatGptApiKey) {
        console.error('CHATGPT_API_KEY environment variable is not set');
        return;
    }
    if (!config.githubToken) {
        console.error('GITHUB_TOKEN environment variable is not set');
        return;
    }
    try {
        // Get the current branch name
        const branchName = await getCurrentBranchName();

        // Get commit messages
        const commits = await getCommits();

        // Generate PR description
        const prDescription = await generatePrDescription(commits);

        // Get repository details
        const { repoOwner, repoName } = await getRepoDetails();

        // Create the PR
        await axios.post(
            `https://api.github.com/repos/${repoOwner}/${repoName}/pulls`,
            {
                title: `PR from ${branchName}`,
                head: branchName,
                base: config.targetBranch,
                body: prDescription,
            },
            {
                headers: {
                    'Authorization': `token ${config.githubToken}`,
                },
            }
        );

        console.log('PR created successfully');
    } catch (err) {
        console.error('Failed to create PR', err);
    }
}

async function getCurrentBranchName() {
    const gitStatus = await git().status();
    return gitStatus.current;
}

async function getCommits() {
    const log = await git().log();
    return log.all.map(commit => commit.message).join('\n');
}

async function generatePrDescription(commits) {
    const openai = new OpenAI(config.chatGptApiKey);
    const result = await openai.ChatCompletion.create({
        model: config.chatGptModel,
        messages: [
            {
                "role": "system",
                "content": "You are a helpful assistant."
            },
            {
                "role": "user",
                "content": `Generate a PR description from these commits: ${commits}`
            }
        ]
    });
    return result.data.choices[0].message.content;
}

async function getRepoDetails() {
    const remote = await git().getRemotes(true);
    const url = remote[0].refs.fetch;
    const match = /github\.com[\/:]([^/]+)\/([^/]+)\.git/.exec(url);
    return {
        repoOwner: match[1],
        repoName: match[2]
    };
}

createPr();
